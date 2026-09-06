<script setup lang="ts">
import type {SysEndpoint, SysEndpointInput, SysEndpointType} from '~/utils/providers'

const props = defineProps<{
  providerId: string
  endpoint: SysEndpoint | null
}>()

const emit = defineEmits<{saved: [endpoint: SysEndpoint]}>()

const open = defineModel<boolean>('open', {default: false})

const {t} = useI18n()
const toast = useToast()
const {createEndpoint, updateEndpoint} = useProviderConfig()

const form = reactive({
  type: 'base' as SysEndpointType,
  protocol: '',
  path: '',
  isDefault: false
})

const showErrors = ref(false)
const saving = ref(false)

const typeOptions = computed(() => [
  {label: t('providerEndpoints.typeBase'), value: 'base'},
  {label: t('providerEndpoints.typeModels'), value: 'models'},
  {label: t('providerEndpoints.typeProtocol'), value: 'protocol'}
])

watch(open, (v) => {
  if (!v) return
  form.type = props.endpoint?.type ?? 'base'
  form.protocol = props.endpoint?.protocol ?? ''
  form.path = props.endpoint?.path ?? ''
  form.isDefault = props.endpoint?.isDefault ?? false
  showErrors.value = false
})

const pathError = computed(() =>
  showErrors.value && !form.path.trim() ? t('providerEndpoints.pathRequired') : undefined
)

const canSave = computed(() => !!form.path.trim() && !saving.value)

async function save() {
  if (!canSave.value) {
    showErrors.value = true
    toast.add({color: 'error', title: t('providers.invalidForm')})
    return
  }
  saving.value = true
  const input: SysEndpointInput = {
    type: form.type,
    protocol: form.protocol.trim(),
    path: form.path.trim(),
    isDefault: form.isDefault
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
    :title="props.endpoint ? t('providerEndpoints.editTitle') : t('providerEndpoints.newTitle')"
    :ui="{ content: 'max-w-md', footer: 'justify-end' }"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField :label="t('providerEndpoints.type')">
          <USelect
            v-model="form.type"
            :items="typeOptions"
            class="w-full"
          />
        </UFormField>

        <UFormField
          v-if="form.type === 'protocol'"
          :label="t('providerEndpoints.protocol')"
        >
          <UInput
            v-model="form.protocol"
            :placeholder="t('providerEndpoints.protocolPlaceholder')"
            class="w-full font-mono"
          />
        </UFormField>

        <UFormField :label="t('providerEndpoints.path')" :error="pathError">
          <UInput
            v-model="form.path"
            :placeholder="t('providerEndpoints.pathPlaceholder')"
            class="w-full font-mono"
          />
        </UFormField>

        <div class="flex items-center justify-between rounded-lg border border-default p-3">
          <span class="text-sm font-medium">{{ t('providerEndpoints.isDefault') }}</span>
          <USwitch v-model="form.isDefault" />
        </div>
      </div>
    </template>

    <template #footer>
      <UButton variant="solid" color="neutral" :disabled="saving" @click="open = false">
        {{ t('common.cancel') }}
      </UButton>
      <UButton icon="i-lucide-save" :loading="saving" :disabled="!canSave" @click="save">
        {{ t('providers.save') }}
      </UButton>
    </template>
  </UModal>
</template>
