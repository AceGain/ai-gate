<script setup lang="ts">
import type {
  SysModel,
  SysModelInput,
  SysModelReasoning,
  SysModelStatus,
  SysModelType
} from '~/utils/providers'

const props = defineProps<{
  providerId: string
  modelItem: SysModel | null
}>()

const emit = defineEmits<{saved: [modelItem: SysModel]}>()

const open = defineModel<boolean>('open', {default: false})

const {t} = useI18n()
const toast = useToast()
const {createModel, updateModel} = useProviderConfig()

const form = reactive({
  code: '',
  name: '',
  category: '',
  type: 'GenText' as SysModelType,
  status: 'ACTIVE' as SysModelStatus,
  enabled: true,
  inputModalText: 'text',
  outputModalText: 'text',
  protocolsText: '',
  maxContext: 128000,
  maxInput: 128000,
  maxOutput: 4096,
  reasoning: 'TOGGLE' as SysModelReasoning,
  effortLevelText: '',
  description: ''
})

const showErrors = ref(false)
const saving = ref(false)

const typeOptions = computed<{label: string, value: SysModelType}[]>(() => [
  {label: t('providerModels.typeGenText'), value: 'GenText'},
  {label: t('providerModels.typeGenImage'), value: 'GenImage'},
  {label: t('providerModels.typeGenAudio'), value: 'GenAudio'},
  {label: t('providerModels.typeGenVideo'), value: 'GenVideo'},
  {label: t('providerModels.typeEmbedding'), value: 'Embedding'},
  {label: t('providerModels.typeRerank'), value: 'Rerank'}
])

const statusOptions = computed(() => [
  {label: t('providerModels.statusActive'), value: 'ACTIVE'},
  {label: t('providerModels.statusInvalid'), value: 'INVALID'}
])

const reasoningOptions = computed(() => [
  {label: t('providerModels.reasoningToggle'), value: 'TOGGLE'},
  {label: t('providerModels.reasoningSwitch'), value: 'SWITCH'},
  {label: t('providerModels.reasoningAlways'), value: 'ALWAYS'},
  {label: t('providerModels.reasoningDisable'), value: 'DISABLE'}
])

watch(open, (v) => {
  if (!v) return
  form.code = props.modelItem?.code ?? ''
  form.name = props.modelItem?.name ?? ''
  form.category = props.modelItem?.category ?? ''
  form.type = props.modelItem?.type ?? 'GenText'
  form.status = props.modelItem?.status ?? 'ACTIVE'
  form.enabled = props.modelItem?.enabled ?? true
  form.inputModalText = props.modelItem ? props.modelItem.inputModal.join(', ') : 'text'
  form.outputModalText = props.modelItem ? props.modelItem.outputModal.join(', ') : 'text'
  form.protocolsText = props.modelItem ? props.modelItem.protocols.join(', ') : ''
  form.maxContext = props.modelItem?.maxContext ?? 128000
  form.maxInput = props.modelItem?.maxInput ?? 128000
  form.maxOutput = props.modelItem?.maxOutput ?? 4096
  form.reasoning = props.modelItem?.reasoning ?? 'TOGGLE'
  form.effortLevelText = props.modelItem ? props.modelItem.effortLevel.join(', ') : ''
  form.description = props.modelItem?.description ?? ''
  showErrors.value = false
})

const codeError = computed(() =>
  showErrors.value && !form.code.trim() ? t('providerModels.codeRequired') : undefined
)

const canSave = computed(() => !!form.code.trim() && !saving.value)

function parseTags(text: string): string[] {
  return text
    .split(/[,，\s]+/)
    .map(s => s.trim())
    .filter(Boolean)
}

async function save() {
  if (!canSave.value) {
    showErrors.value = true
    toast.add({color: 'error', title: t('providers.invalidForm')})
    return
  }
  saving.value = true
  const input: SysModelInput = {
    code: form.code.trim(),
    name: form.name.trim() || form.code.trim(),
    category: form.category.trim(),
    type: form.type,
    status: form.status,
    enabled: form.enabled,
    inputModal: parseTags(form.inputModalText),
    outputModal: parseTags(form.outputModalText),
    protocols: parseTags(form.protocolsText),
    maxContext: Number(form.maxContext) || 0,
    maxInput: Number(form.maxInput) || 0,
    maxOutput: Number(form.maxOutput) || 0,
    reasoning: form.reasoning,
    effortLevel: parseTags(form.effortLevelText),
    description: form.description.trim()
  }
  try {
    const saved = props.modelItem
      ? await updateModel(props.providerId, props.modelItem.id, input)
      : await createModel(props.providerId, input)
    toast.add({color: 'success', title: t('providers.saved')})
    open.value = false
    emit('saved', saved)
  } catch (err) {
    const status = (err as {statusCode?: number}).statusCode
    const message = (err as {data?: {error?: string}}).data?.error ?? ''
    if (status === 409 || message.includes('Duplicate model code')) {
      toast.add({color: 'error', title: t('providerModels.codeDuplicate')})
    } else {
      console.warn('[ai-gate] 保存模型失败', err)
      toast.add({color: 'error', title: t('providers.backendUnavailable')})
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="props.modelItem ? t('providerModels.editTitle') : t('providerModels.newTitle')"
    :ui="{ content: 'max-w-lg', footer: 'justify-end' }"
  >
    <template #body>
      <div class="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div class="grid grid-cols-2 gap-3">
          <UFormField :label="t('providerModels.code')" :error="codeError">
            <UInput
              v-model="form.code"
              :placeholder="t('providerModels.codePlaceholder')"
              class="w-full font-mono"
            />
          </UFormField>

          <UFormField :label="t('providerModels.name')">
            <UInput
              v-model="form.name"
              :placeholder="t('providerModels.namePlaceholder')"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <UFormField :label="t('providerModels.type')">
            <USelect
              v-model="form.type"
              :items="typeOptions"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('providerModels.category')">
            <UInput
              v-model="form.category"
              :placeholder="t('providerModels.categoryPlaceholder')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('providerModels.status')">
            <USelect
              v-model="form.status"
              :items="statusOptions"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <UFormField :label="t('providerModels.inputModal')">
            <UInput
              v-model="form.inputModalText"
              :placeholder="t('providerModels.inputModalPlaceholder')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('providerModels.outputModal')">
            <UInput
              v-model="form.outputModalText"
              :placeholder="t('providerModels.outputModalPlaceholder')"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField :label="t('providerModels.protocols')">
          <UInput
            v-model="form.protocolsText"
            :placeholder="t('providerModels.protocolsPlaceholder')"
            class="w-full font-mono"
          />
        </UFormField>

        <div class="grid grid-cols-3 gap-3">
          <UFormField :label="t('providerModels.maxContext')">
            <UInput
              v-model.number="form.maxContext"
              type="number"
              class="w-full font-mono"
            />
          </UFormField>

          <UFormField :label="t('providerModels.maxInput')">
            <UInput
              v-model.number="form.maxInput"
              type="number"
              class="w-full font-mono"
            />
          </UFormField>

          <UFormField :label="t('providerModels.maxOutput')">
            <UInput
              v-model.number="form.maxOutput"
              type="number"
              class="w-full font-mono"
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <UFormField :label="t('providerModels.reasoning')">
            <USelect
              v-model="form.reasoning"
              :items="reasoningOptions"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('providerModels.effortLevel')">
            <UInput
              v-model="form.effortLevelText"
              :placeholder="t('providerModels.effortLevelPlaceholder')"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField :label="t('providers.description')">
          <UTextarea
            v-model="form.description"
            autoresize
            :rows="2"
            :placeholder="t('providers.descriptionPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <div class="flex items-center justify-between rounded-lg border border-default p-3">
          <span class="text-sm font-medium">{{ t('providers.enable') }}</span>
          <USwitch v-model="form.enabled" />
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
