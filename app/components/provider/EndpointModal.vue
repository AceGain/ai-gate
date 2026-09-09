<script setup lang="ts">
import {useClipboard} from '@vueuse/core'
import type {SysEndpoint, SysEndpointInput, SysEndpointProtocol, SysEndpointType} from '~/utils/providers'
import {SYS_ENDPOINT_PROTOCOLS, SYS_ENDPOINT_PROTOCOL_DEFAULT_PATHS} from '~/utils/providers'

const props = withDefaults(defineProps<{
  providerId: string
  endpoint: SysEndpoint | null
  defaultType?: SysEndpointType
  existingEndpoints?: SysEndpoint[]
}>(), {
  defaultType: 'protocol'
})

const emit = defineEmits<{saved: [endpoint: SysEndpoint]}>()

const open = defineModel<boolean>('open', {default: false})

const {t} = useI18n()
const toast = useToast()
const {createEndpoint, updateEndpoint, endpoints} = useProviderConfig()
const {copy} = useClipboard()

const targetType = computed<SysEndpointType>(() => {
  return props.endpoint?.type ?? props.defaultType ?? 'protocol'
})

const form = reactive({
  type: 'protocol' as SysEndpointType,
  protocol: '',
  path: '',
  isDefault: false
})

const showErrors = ref(false)
const saving = ref(false)

/** 基地址端点（用于拼接完整端点预览） */
const baseEndpoint = computed(() => {
  const eps = props.existingEndpoints ?? endpoints.value
  return eps.find(e => e.type === 'base')
})

/** 当前已配置的协议集合（排除当前正在编辑的端点） */
const configuredProtocols = computed(() => {
  const eps = props.existingEndpoints ?? endpoints.value
  return new Set(
    eps
      .filter(e => e.type === 'protocol' && (!props.endpoint || e.id !== props.endpoint.id))
      .map(e => e.protocol)
  )
})

/** 尚未配置的协议列表 */
const availableProtocols = computed(() => {
  return SYS_ENDPOINT_PROTOCOLS.filter(p => !configuredProtocols.value.has(p))
})

const protocolOptions = computed<{label: string; value: string}[]>(() => {
  if (props.endpoint) {
    return [{label: props.endpoint.protocol, value: props.endpoint.protocol}]
  }
  const list: {label: string; value: string}[] = availableProtocols.value.map(p => ({label: p, value: p}))
  if (form.protocol && !configuredProtocols.value.has(form.protocol) && !availableProtocols.value.includes(form.protocol as any)) {
    list.unshift({label: form.protocol, value: form.protocol})
  }
  return list
})

watch(open, (v) => {
  if (!v) return
  form.type = targetType.value
  const initialProtocol = props.endpoint?.protocol
    || (form.type === 'protocol' ? (availableProtocols.value[0] ?? '') : '')
  form.protocol = initialProtocol
  const defaultPath = form.type === 'protocol' && form.protocol in SYS_ENDPOINT_PROTOCOL_DEFAULT_PATHS
    ? SYS_ENDPOINT_PROTOCOL_DEFAULT_PATHS[form.protocol as SysEndpointProtocol]
    : ''
  form.path = props.endpoint?.path || (form.type === 'protocol' ? defaultPath : '')
  form.isDefault = form.type === 'protocol' ? (props.endpoint?.isDefault ?? false) : false
  showErrors.value = false
})

watch(() => form.protocol, (newProto, oldProto) => {
  if (form.type !== 'protocol') return
  const oldDefault = oldProto && oldProto in SYS_ENDPOINT_PROTOCOL_DEFAULT_PATHS
    ? SYS_ENDPOINT_PROTOCOL_DEFAULT_PATHS[oldProto as SysEndpointProtocol]
    : ''
  if (!form.path || form.path === oldDefault) {
    if (newProto && newProto in SYS_ENDPOINT_PROTOCOL_DEFAULT_PATHS) {
      form.path = SYS_ENDPOINT_PROTOCOL_DEFAULT_PATHS[newProto as SysEndpointProtocol]
    }
  }
})

const protocolError = computed(() => {
  if (form.type !== 'protocol') return undefined
  if (showErrors.value && !form.protocol.trim()) return t('providerEndpoints.protocolRequired')
  if (!props.endpoint && configuredProtocols.value.has(form.protocol.trim())) {
    return t('providerEndpoints.protocolDuplicate')
  }
  return undefined
})

const pathError = computed(() =>
  showErrors.value && !form.path.trim() ? t('providerEndpoints.pathRequired') : undefined
)

const canSave = computed(() => {
  if (saving.value) return false
  if (!form.path.trim()) return false
  if (form.type === 'protocol') {
    if (!form.protocol.trim()) return false
    if (!props.endpoint && configuredProtocols.value.has(form.protocol.trim())) return false
  }
  return true
})

/** 弹窗标题：修改端点统一为「修改端点」，新增端点为「新增端点」 */
const modalTitle = computed(() => {
  return props.endpoint ? t('providerEndpoints.editTitle') : t('providerEndpoints.newTitle')
})

/** 端点类型只读显示文本 */
const endpointTypeDisplay = computed(() => {
  if (form.type === 'base') return 'Base URL'
  if (form.type === 'models') return 'Models'
  if (form.type === 'protocol') return form.protocol || t('providerEndpoints.typeProtocol')
  return form.type
})

const pathPlaceholder = computed(() => {
  if (form.type === 'base') return t('providers.baseUrlPlaceholder')
  if (form.type === 'models') return '/v1/models'
  if (form.type === 'protocol' && form.protocol in SYS_ENDPOINT_PROTOCOL_DEFAULT_PATHS) {
    return SYS_ENDPOINT_PROTOCOL_DEFAULT_PATHS[form.protocol as SysEndpointProtocol]
  }
  return t('providerEndpoints.pathPlaceholder')
})

/** 完整端点地址拆分与预览 */
const previewUrlParts = computed(() => {
  const trimmedPath = form.path.trim()
  if (!trimmedPath) {
    return {basePart: '', pathPart: '', fullUrl: ''}
  }

  if (form.type === 'base') {
    return {basePart: '', pathPart: trimmedPath, fullUrl: trimmedPath}
  }

  if (/^https?:\/\//i.test(trimmedPath)) {
    try {
      const u = new URL(trimmedPath)
      const origin = u.origin
      const pathname = trimmedPath.slice(origin.length)
      return {basePart: origin, pathPart: pathname, fullUrl: trimmedPath}
    } catch {
      return {basePart: '', pathPart: trimmedPath, fullUrl: trimmedPath}
    }
  }

  const baseUrl = baseEndpoint.value?.path?.trim()
  if (!baseUrl) {
    return {basePart: '', pathPart: trimmedPath, fullUrl: trimmedPath}
  }

  const baseNormalized = baseUrl.replace(/\/+$/, '')
  const subNormalized = trimmedPath.replace(/^\/+/, '')
  const full = `${baseNormalized}/${subNormalized}`
  return {basePart: baseNormalized, pathPart: `/${subNormalized}`, fullUrl: full}
})

const previewFullUrl = computed(() => previewUrlParts.value.fullUrl)

async function handleCopyPreview() {
  if (!previewFullUrl.value) return
  await copy(previewFullUrl.value)
  toast.add({color: 'success', title: t('providerEndpoints.copied')})
}

async function save() {
  if (!canSave.value) {
    showErrors.value = true
    toast.add({color: 'error', title: t('providers.invalidForm')})
    return
  }
  saving.value = true
  const isDefault = props.endpoint ? props.endpoint.isDefault : false
  const input: SysEndpointInput = {
    type: form.type,
    protocol: form.type === 'protocol' ? form.protocol.trim() : '',
    path: form.path.trim(),
    isDefault
  }
  try {
    const saved = props.endpoint
      ? await updateEndpoint(props.providerId, props.endpoint.id, input)
      : await createEndpoint(props.providerId, input)
    toast.add({color: 'success', title: t('providers.saved')})
    open.value = false
    emit('saved', saved)
  } catch (err: any) {
    console.warn('[ai-gate] 保存端点失败', err)
    const msg = err?.data?.error || err?.message
    toast.add({color: 'error', title: msg || t('providers.backendUnavailable')})
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="modalTitle"
    :ui="{ content: 'max-w-md', footer: 'justify-end' }"
  >
    <template #body>
      <div class="space-y-4">
        <!-- 当没有可用协议时展示友好提示 -->
        <UAlert
          v-if="form.type === 'protocol' && !props.endpoint && availableProtocols.length === 0"
          color="warning"
          variant="subtle"
          :title="t('providerEndpoints.noProtocolsAvailable')"
        />

        <!-- 端点类型：修改时只读不可操作；新增 protocol 时展示下拉选择 -->
        <UFormField
          :label="t('providerEndpoints.type')"
          :error="!props.endpoint ? protocolError : undefined"
        >
          <UInput
            v-if="props.endpoint"
            :model-value="endpointTypeDisplay"
            disabled
            class="w-full"
          />
          <USelect
            v-else
            v-model="form.protocol"
            :items="protocolOptions"
            :placeholder="t('providerEndpoints.protocolPlaceholder')"
            :disabled="availableProtocols.length === 0"
            class="w-full"
          />
        </UFormField>

        <!-- 端点地址输入框 -->
        <UFormField :label="t('providerEndpoints.path')" :error="pathError">
          <UInput
            v-model="form.path"
            :placeholder="pathPlaceholder"
            :disabled="form.type === 'protocol' && !props.endpoint && availableProtocols.length === 0"
            class="w-full"
          />
        </UFormField>

        <!-- 完整端点地址预览 -->
        <UFormField :label="t('providerEndpoints.fullUrlPreview')">
          <div
            class="flex items-center justify-between gap-2 rounded-sm border border-default bg-elevated/30 px-2.5 py-1.5 min-h-9"
          >
            <code
              class="truncate text-xs select-all flex-1 min-w-0"
              :title="previewFullUrl || t('common.empty')"
            >
              <span v-if="previewUrlParts.basePart" class="text-dimmed">
                {{ previewUrlParts.basePart }}
              </span>
              <span :class="previewUrlParts.basePart ? 'text-highlighted font-medium' : (previewFullUrl ? 'text-highlighted' : 'text-muted')">
                {{ previewUrlParts.pathPart || (previewFullUrl ? '' : t('common.empty')) }}
              </span>
            </code>
            <UButton
              v-if="previewFullUrl"
              icon="i-lucide-copy"
              variant="ghost"
              color="neutral"
              size="xs"
              class="shrink-0"
              :title="t('common.copy')"
              :aria-label="t('common.copy')"
              @click="handleCopyPreview"
            />
          </div>
        </UFormField>
      </div>
    </template>

    <template #footer>
      <UButton variant="solid" color="neutral" :disabled="saving" @click="open = false">
        {{ t('common.cancel') }}
      </UButton>
      <UButton
        icon="i-lucide-save"
        :loading="saving"
        :disabled="form.type === 'protocol' && !props.endpoint && availableProtocols.length === 0"
        @click="save"
      >
        {{ t('providers.save') }}
      </UButton>
    </template>
  </UModal>
</template>
