<script setup lang="ts">
import {useClipboard} from '@vueuse/core'
import type {SysEndpoint, SysEndpointInput, SysEndpointGenerate, SysEndpointType} from '~/utils/providers'
import {SYS_ENDPOINT_GENERATES, SYS_ENDPOINT_GENERATE_DEFAULT_PATHS} from '~/utils/providers'

const props = withDefaults(defineProps<{
  providerId: string
  endpoint: SysEndpoint | null
  defaultType?: SysEndpointType
  existingEndpoints?: SysEndpoint[]
}>(), {
  defaultType: 'generate'
})

const emit = defineEmits<{saved: [endpoint: SysEndpoint]}>()

const open = defineModel<boolean>('open', {default: false})

const {t} = useI18n()
const toast = useToast()
const {createEndpoint, updateEndpoint, endpoints} = useProviderConfig()
const {copy} = useClipboard()

const targetType = computed<SysEndpointType>(() => {
  return props.endpoint?.type ?? props.defaultType ?? 'generate'
})

const form = reactive({
  type: 'generate' as SysEndpointType,
  generate: '',
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

/** 当前已配置的生成端点类型集合（排除当前正在编辑的端点） */
const configuredGenerates = computed(() => {
  const eps = props.existingEndpoints ?? endpoints.value
  return new Set(
    eps
      .filter(e => e.type === 'generate' && (!props.endpoint || e.id !== props.endpoint.id))
      .map(e => e.generate)
  )
})

/** 尚未配置的生成端点类型列表 */
const availableGenerates = computed(() => {
  return SYS_ENDPOINT_GENERATES.filter(p => !configuredGenerates.value.has(p))
})

const generateOptions = computed<{label: string; value: string}[]>(() => {
  if (props.endpoint) {
    return [{label: props.endpoint.generate, value: props.endpoint.generate}]
  }
  const list: {label: string; value: string}[] = availableGenerates.value.map(p => ({label: p, value: p}))
  if (form.generate && !configuredGenerates.value.has(form.generate) && !availableGenerates.value.includes(form.generate as any)) {
    list.unshift({label: form.generate, value: form.generate})
  }
  return list
})

watch(open, (v) => {
  if (!v) return
  form.type = targetType.value
  const initialGenerate = props.endpoint?.generate
    || (form.type === 'generate' ? (availableGenerates.value[0] ?? '') : '')
  form.generate = initialGenerate
  const defaultPath = form.type === 'generate' && form.generate in SYS_ENDPOINT_GENERATE_DEFAULT_PATHS
    ? SYS_ENDPOINT_GENERATE_DEFAULT_PATHS[form.generate as SysEndpointGenerate]
    : ''
  form.path = props.endpoint?.path || (form.type === 'generate' ? defaultPath : '')
  form.isDefault = form.type === 'generate' ? (props.endpoint?.isDefault ?? false) : false
  showErrors.value = false
})

watch(() => form.generate, (newGen, oldGen) => {
  if (form.type !== 'generate') return
  const oldDefault = oldGen && oldGen in SYS_ENDPOINT_GENERATE_DEFAULT_PATHS
    ? SYS_ENDPOINT_GENERATE_DEFAULT_PATHS[oldGen as SysEndpointGenerate]
    : ''
  if (!form.path || form.path === oldDefault) {
    if (newGen && newGen in SYS_ENDPOINT_GENERATE_DEFAULT_PATHS) {
      form.path = SYS_ENDPOINT_GENERATE_DEFAULT_PATHS[newGen as SysEndpointGenerate]
    }
  }
})

const generateError = computed(() => {
  if (form.type !== 'generate') return undefined
  if (showErrors.value && !form.generate.trim()) return t('providerEndpoints.generateRequired')
  if (!props.endpoint && configuredGenerates.value.has(form.generate.trim())) {
    return t('providerEndpoints.generateDuplicate')
  }
  return undefined
})

const pathError = computed(() =>
  showErrors.value && !form.path.trim() ? t('providerEndpoints.pathRequired') : undefined
)

const canSave = computed(() => {
  if (saving.value) return false
  if (!form.path.trim()) return false
  if (form.type === 'generate') {
    if (!form.generate.trim()) return false
    if (!props.endpoint && configuredGenerates.value.has(form.generate.trim())) return false
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
  if (form.type === 'generate') return form.generate || t('providerEndpoints.typeGenerate')
  return form.type
})

const pathPlaceholder = computed(() => {
  if (form.type === 'base') return t('providers.baseUrlPlaceholder')
  if (form.type === 'models') return '/v1/models'
  if (form.type === 'generate' && form.generate in SYS_ENDPOINT_GENERATE_DEFAULT_PATHS) {
    return SYS_ENDPOINT_GENERATE_DEFAULT_PATHS[form.generate as SysEndpointGenerate]
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
    generate: form.type === 'generate' ? form.generate.trim() : '',
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
        <!-- 当没有可用生成端点类型时展示友好提示 -->
        <UAlert
          v-if="form.type === 'generate' && !props.endpoint && availableGenerates.length === 0"
          color="warning"
          variant="subtle"
          :title="t('providerEndpoints.noGeneratesAvailable')"
        />

        <!-- 端点类型：修改时只读不可操作；新增 generate 时展示下拉选择 -->
        <UFormField
          :label="t('providerEndpoints.type')"
          :error="!props.endpoint ? generateError : undefined"
        >
          <UInput
            v-if="props.endpoint"
            :model-value="endpointTypeDisplay"
            disabled
            class="w-full"
          />
          <USelect
            v-else
            v-model="form.generate"
            :items="generateOptions"
            :placeholder="t('providerEndpoints.generatePlaceholder')"
            :disabled="availableGenerates.length === 0"
            class="w-full"
          />
        </UFormField>

        <!-- 端点地址输入框 -->
        <UFormField :label="t('providerEndpoints.path')" :error="pathError">
          <UInput
            v-model="form.path"
            :placeholder="pathPlaceholder"
            :disabled="form.type === 'generate' && !props.endpoint && availableGenerates.length === 0"
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
        :disabled="form.type === 'generate' && !props.endpoint && availableGenerates.length === 0"
        @click="save"
      >
        {{ t('providers.save') }}
      </UButton>
    </template>
  </UModal>
</template>
