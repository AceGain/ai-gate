<script setup lang="ts">
import type {SysEndpoint, SysEndpointInput, SysEndpointProtocol, SysEndpointType} from '~/utils/providers'
import {SYS_ENDPOINT_PROTOCOLS, SYS_ENDPOINT_PROTOCOL_DEFAULT_PATHS} from '~/utils/providers'

const props = withDefaults(defineProps<{
  providerId: string
  endpoint: SysEndpoint | null
  defaultType?: SysEndpointType
}>(), {
  defaultType: 'protocol'
})

const emit = defineEmits<{saved: [endpoint: SysEndpoint]}>()

const open = defineModel<boolean>('open', {default: false})

const {t} = useI18n()
const toast = useToast()
const {createEndpoint, updateEndpoint} = useProviderConfig()

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

const protocolOptions = computed<{label: string; value: string}[]>(() => {
  const list: {label: string; value: string}[] = SYS_ENDPOINT_PROTOCOLS.map(p => ({label: p, value: p}))
  if (form.protocol && !SYS_ENDPOINT_PROTOCOLS.includes(form.protocol as any)) {
    list.unshift({label: form.protocol, value: form.protocol})
  }
  return list
})

watch(open, (v) => {
  if (!v) return
  form.type = targetType.value
  form.protocol = props.endpoint?.protocol || (form.type === 'protocol' ? SYS_ENDPOINT_PROTOCOLS[0] : '')
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
  return showErrors.value && !form.protocol.trim() ? t('providerEndpoints.protocolRequired') : undefined
})

const pathError = computed(() =>
  showErrors.value && !form.path.trim() ? t('providerEndpoints.pathRequired') : undefined
)

const canSave = computed(() => {
  if (saving.value) return false
  if (!form.path.trim()) return false
  if (form.type === 'protocol' && !form.protocol.trim()) return false
  return true
})

const modalTitle = computed(() => {
  if (form.type === 'base') return t('providerEndpoints.editBaseTitle')
  if (form.type === 'models') return t('providerEndpoints.editModelsTitle')
  return props.endpoint ? t('providerEndpoints.editProtocolTitle') : t('providerEndpoints.newProtocolTitle')
})

const pathLabel = computed(() => {
  if (form.type === 'base') return t('providers.baseUrl')
  if (form.type === 'models') return t('providerEndpoints.typeModels')
  return t('providerEndpoints.path')
})

const pathPlaceholder = computed(() => {
  if (form.type === 'base') return t('providers.baseUrlPlaceholder')
  if (form.type === 'models') return '/v1/models'
  return t('providerEndpoints.pathPlaceholder')
})

async function save() {
  if (!canSave.value) {
    showErrors.value = true
    toast.add({color: 'error', title: t('providers.invalidForm')})
    return
  }
  saving.value = true
  const isDefault = form.type === 'protocol' ? form.isDefault : false
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
  } catch (err) {
    console.warn('[ai-gate] 保存端点失败', err)
    toast.add({color: 'error', title: t('providers.backendUnavailable')})
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
        <!-- 协议标识：仅 protocol 类型展示，固定类型下拉选择 -->
        <UFormField
          v-if="form.type === 'protocol'"
          :label="t('providerEndpoints.protocol')"
          :error="protocolError"
        >
          <USelect
            v-model="form.protocol"
            :items="protocolOptions"
            :placeholder="t('providerEndpoints.protocolPlaceholder')"
            class="w-full font-mono"
          />
        </UFormField>

        <!-- 路径输入框 -->
        <UFormField :label="pathLabel" :error="pathError">
          <UInput
            v-model="form.path"
            :placeholder="pathPlaceholder"
            class="w-full font-mono"
          />
        </UFormField>

        <!-- 设为默认开关：仅针对 protocol 类型生效与展示 -->
        <div
          v-if="form.type === 'protocol'"
          class="flex items-center justify-between rounded-lg border border-default p-3"
        >
          <span class="text-sm font-medium">{{ t('providerEndpoints.isDefault') }}</span>
          <USwitch v-model="form.isDefault" />
        </div>
      </div>
    </template>

    <template #footer>
      <UButton variant="solid" color="neutral" :disabled="saving" @click="open = false">
        {{ t('common.cancel') }}
      </UButton>
      <UButton icon="i-lucide-save" :loading="saving" @click="save">
        {{ t('providers.save') }}
      </UButton>
    </template>
  </UModal>
</template>
