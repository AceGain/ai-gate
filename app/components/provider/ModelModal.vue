<script setup lang="ts">
import type {
  SysModel,
  SysModelInput,
  SysModelReasoning,
  SysModelStatus,
  SysModelType,
  SysModelModality,
  SysModelEffortLevel
} from '~/utils/providers'
import {
  SYS_MODEL_MODALITIES,
  SYS_MODEL_EFFORT_LEVELS,
  SYS_ENDPOINT_GENERATES,
  SYS_ENDPOINT_GENERATE_DEFAULT_PATHS,
  splitUrl
} from '~/utils/providers'

const props = defineProps<{
  providerId: string
  modelItem: SysModel | null
}>()

const emit = defineEmits<{saved: [modelItem: SysModel]}>()

const open = defineModel<boolean>('open', {default: false})

const {t} = useI18n()
const toast = useToast()
const {createModel, updateModel, endpoints} = useProviderConfig()

const isAdvancedOpen = ref(false)

const form = reactive({
  code: '',
  name: '',
  category: '',
  type: 'GenText' as SysModelType,
  status: 'ACTIVE' as SysModelStatus,
  enabled: true,
  inputModal: ['text'] as SysModelModality[],
  outputModal: ['text'] as SysModelModality[],
  generates: ['Chat Completions'] as string[],
  maxContext: null as number | null,
  maxInput: null as number | null,
  maxOutput: null as number | null,
  reasoning: 'TOGGLE' as SysModelReasoning,
  effortLevel: [] as SysModelEffortLevel[],
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

const reasoningOptions = computed(() => [
  {label: t('providerModels.reasoningToggle'), value: 'TOGGLE'},
  {label: t('providerModels.reasoningSwitch'), value: 'SWITCH'},
  {label: t('providerModels.reasoningAlways'), value: 'ALWAYS'},
  {label: t('providerModels.reasoningDisable'), value: 'DISABLE'}
])

const modalityCheckboxItems = computed<{label: string, value: SysModelModality}[]>(() => [
  {label: t('providerModels.modalityText'), value: 'text'},
  {label: t('providerModels.modalityImage'), value: 'image'},
  {label: t('providerModels.modalityVideo'), value: 'video'},
  {label: t('providerModels.modalityAudio'), value: 'audio'},
  {label: t('providerModels.modalityPdf'), value: 'pdf'}
])

const effortLevelOptions = computed<{label: string, value: SysModelEffortLevel}[]>(() => [
  {label: t('providerModels.effortNone'), value: 'none'},
  {label: t('providerModels.effortMinimal'), value: 'minimal'},
  {label: t('providerModels.effortLow'), value: 'low'},
  {label: t('providerModels.effortMedium'), value: 'medium'},
  {label: t('providerModels.effortHigh'), value: 'high'},
  {label: t('providerModels.effortXhigh'), value: 'xhigh'},
  {label: t('providerModels.effortMax'), value: 'max'}
])

const contextPresets = [
  {label: '128k', value: 128000},
  {label: '256k', value: 256000},
  {label: '512k', value: 512000},
  {label: '1m', value: 1000000}
]

const inputPresets = [
  {label: '128k', value: 128000},
  {label: '256k', value: 256000},
  {label: '512k', value: 512000},
  {label: '1m', value: 1000000}
]

const outputPresets = [
  {label: '32k', value: 32000},
  {label: '64k', value: 64000},
  {label: '128k', value: 128000},
  {label: '256k', value: 256000}
]

const baseEndpoint = computed(() => {
  return endpoints.value.find(e => e.type === 'base')
})

interface GenerateEndpointItem {
  type: string
  path: string
  fullUrl: string
  isCustom: boolean
}

const generateEndpointList = computed<GenerateEndpointItem[]>(() => {
  return SYS_ENDPOINT_GENERATES.map(genType => {
    const configuredEp = endpoints.value.find(
      e => e.type === 'generate' && e.generate === genType
    )
    const rawPath = configuredEp?.path || SYS_ENDPOINT_GENERATE_DEFAULT_PATHS[genType]
    const fullUrl = splitUrl(baseEndpoint.value?.path, rawPath).fullUrl
    return {
      type: genType,
      path: rawPath,
      fullUrl,
      isCustom: !!configuredEp
    }
  })
})

function toggleGenerate(genType: string) {
  const idx = form.generates.indexOf(genType)
  if (idx >= 0) {
    form.generates.splice(idx, 1)
  } else {
    form.generates.push(genType)
  }
}

watch(open, (v) => {
  if (!v) return
  form.code = props.modelItem?.code ?? ''
  form.name = props.modelItem?.name ?? ''
  form.category = props.modelItem?.category ?? ''
  form.type = props.modelItem?.type ?? 'GenText'
  form.status = props.modelItem?.status ?? 'ACTIVE'
  form.enabled = props.modelItem?.enabled ?? true
  form.inputModal = props.modelItem?.inputModal?.length
    ? props.modelItem.inputModal.filter((m): m is SysModelModality => (SYS_MODEL_MODALITIES as readonly string[]).includes(m))
    : ['text']
  form.outputModal = props.modelItem?.outputModal?.length
    ? props.modelItem.outputModal.filter((m): m is SysModelModality => (SYS_MODEL_MODALITIES as readonly string[]).includes(m))
    : ['text']
  form.generates = props.modelItem?.generates?.length
    ? props.modelItem.generates.filter((g): g is string => (SYS_ENDPOINT_GENERATES as readonly string[]).includes(g))
    : ['Chat Completions']
  form.maxContext = props.modelItem?.maxContext || null
  form.maxInput = props.modelItem?.maxInput || null
  form.maxOutput = props.modelItem?.maxOutput || null
  form.reasoning = props.modelItem?.reasoning ?? 'TOGGLE'
  form.effortLevel = props.modelItem?.effortLevel
    ? props.modelItem.effortLevel.filter((e): e is SysModelEffortLevel => (SYS_MODEL_EFFORT_LEVELS as readonly string[]).includes(e))
    : []
  form.description = props.modelItem?.description ?? ''
  isAdvancedOpen.value = !!props.modelItem
  showErrors.value = false
})

watch(() => form.reasoning, (val) => {
  if (val !== 'TOGGLE') {
    form.effortLevel = []
  }
})

const codeError = computed(() =>
  showErrors.value && !form.code.trim() ? t('providerModels.codeRequired') : undefined
)

const canSave = computed(() => !!form.code.trim() && !saving.value)

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
    inputModal: form.inputModal,
    outputModal: form.outputModal,
    generates: form.generates,
    maxContext: Number(form.maxContext) || 0,
    maxInput: Number(form.maxInput) || 0,
    maxOutput: Number(form.maxOutput) || 0,
    reasoning: form.reasoning,
    effortLevel: form.reasoning === 'TOGGLE' ? form.effortLevel : [],
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
    :ui="{ content: 'sm:max-w-lg', body: 'no-scrollbar', footer: 'justify-end' }"
  >
    <template #body>
      <div class="space-y-3">
        <!-- 基础配置：常用必要项（纯单列垂直排列） -->
        <div class="space-y-4">
          <UFormField :label="t('providerModels.code')" required :error="codeError">
            <UInput
              v-model="form.code"
              :placeholder="t('providerModels.codePlaceholder')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('providerModels.name')">
            <UInput
              v-model="form.name"
              :placeholder="t('providerModels.namePlaceholder')"
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

          <UFormField :label="t('providerModels.type')">
            <USelect
              v-model="form.type"
              :items="typeOptions"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('providers.description')">
            <UTextarea
              v-model="form.description"
              autoresize
              :rows="2"
              :placeholder="t('providers.descriptionPlaceholder')"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- 额外配置：模态、Token限制、推理、生成端点等可选扩展 -->
        <div class="border-t border-default pt-3">
          <UCollapsible v-model:open="isAdvancedOpen" :unmount-on-hide="false" class="w-full">
            <UButton
              color="neutral"
              variant="subtle"
              block
              class="justify-between px-3 py-2 cursor-pointer"
              :trailing-icon="isAdvancedOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            >
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-sliders-horizontal" class="size-4 text-primary" />
                <span class="text-xs font-semibold text-highlighted">
                  {{ t('providerModels.advancedConfig') }}
                </span>
              </div>
            </UButton>

            <template #content>
              <div class="pt-3 space-y-4">
                <!-- 1. 模态支持：平铺 CheckboxGroup -->
                <UFormField :label="t('providerModels.inputModal')">
                  <UCheckboxGroup
                    v-model="form.inputModal"
                    :items="modalityCheckboxItems"
                    orientation="horizontal"
                    class="pt-1"
                  />
                </UFormField>

                <UFormField :label="t('providerModels.outputModal')">
                  <UCheckboxGroup
                    v-model="form.outputModal"
                    :items="modalityCheckboxItems"
                    orientation="horizontal"
                    class="pt-1"
                  />
                </UFormField>

                <!-- 2. Token 限制与快捷输入（纯单列垂直排列） -->
                <!-- 上下文 -->
                <UFormField :label="t('providerModels.maxContext')">
                  <div class="space-y-1.5">
                    <UInput
                      v-model.number="form.maxContext"
                      type="number"
                      :placeholder="t('providerModels.tokenPlaceholder')"
                      class="w-full"
                    />
                    <div class="flex flex-wrap items-center gap-1.5">
                      <UButton
                        v-for="p in contextPresets"
                        :key="p.value"
                        size="xs"
                        :variant="form.maxContext === p.value ? 'subtle' : 'ghost'"
                        :color="form.maxContext === p.value ? 'primary' : 'neutral'"
                        class="px-2 py-0.5 text-xs font-mono cursor-pointer"
                        @click="form.maxContext = form.maxContext === p.value ? null : p.value"
                      >
                        {{ p.label }}
                      </UButton>
                    </div>
                  </div>
                </UFormField>

                <!-- 最大输入 -->
                <UFormField :label="t('providerModels.maxInput')">
                  <div class="space-y-1.5">
                    <UInput
                      v-model.number="form.maxInput"
                      type="number"
                      :placeholder="t('providerModels.tokenPlaceholder')"
                      class="w-full"
                    />
                    <div class="flex flex-wrap items-center gap-1.5">
                      <UButton
                        v-for="p in inputPresets"
                        :key="p.value"
                        size="xs"
                        :variant="form.maxInput === p.value ? 'subtle' : 'ghost'"
                        :color="form.maxInput === p.value ? 'primary' : 'neutral'"
                        class="px-2 py-0.5 text-xs font-mono cursor-pointer"
                        @click="form.maxInput = form.maxInput === p.value ? null : p.value"
                      >
                        {{ p.label }}
                      </UButton>
                    </div>
                  </div>
                </UFormField>

                <!-- 最大输出 -->
                <UFormField :label="t('providerModels.maxOutput')">
                  <div class="space-y-1.5">
                    <UInput
                      v-model.number="form.maxOutput"
                      type="number"
                      :placeholder="t('providerModels.tokenPlaceholder')"
                      class="w-full"
                    />
                    <div class="flex flex-wrap items-center gap-1.5">
                      <UButton
                        v-for="p in outputPresets"
                        :key="p.value"
                        size="xs"
                        :variant="form.maxOutput === p.value ? 'subtle' : 'ghost'"
                        :color="form.maxOutput === p.value ? 'primary' : 'neutral'"
                        class="px-2 py-0.5 text-xs font-mono cursor-pointer"
                        @click="form.maxOutput = form.maxOutput === p.value ? null : p.value"
                      >
                        {{ p.label }}
                      </UButton>
                    </div>
                  </div>
                </UFormField>

                <!-- 推理模式 -->
                <UFormField :label="t('providerModels.reasoning')">
                  <USelect
                    v-model="form.reasoning"
                    :items="reasoningOptions"
                    class="w-full"
                  />
                </UFormField>

                <!-- 推理档位：平铺 CheckboxGroup，仅 TOGGLE 模式下动态展示 -->
                <UFormField
                  v-if="form.reasoning === 'TOGGLE'"
                  :label="t('providerModels.effortLevel')"
                >
                  <UCheckboxGroup
                    v-model="form.effortLevel"
                    :items="effortLevelOptions"
                    orientation="horizontal"
                    class="pt-1"
                  />
                </UFormField>

                <!-- 3. 支持生成端点列表（展示完整路径） -->
                <UFormField :label="t('providerModels.generates')">
                  <div class="space-y-2 pt-0.5">
                    <div
                      v-for="ep in generateEndpointList"
                      :key="ep.type"
                      class="flex items-center gap-3 p-3 rounded-sm border transition-colors cursor-pointer select-none"
                      :class="form.generates.includes(ep.type)
                        ? 'border-primary/50 bg-elevated/40'
                        : 'border-default bg-default hover:bg-elevated/20'"
                      @click="toggleGenerate(ep.type)"
                    >
                      <UCheckbox
                        :model-value="form.generates.includes(ep.type)"
                        :aria-label="ep.type"
                        class="pointer-events-none"
                      />
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <span
                            class="text-xs font-semibold"
                            :class="form.generates.includes(ep.type) ? 'text-highlighted' : 'text-default'"
                          >
                            {{ ep.type }}
                          </span>
                          <UBadge v-if="ep.isCustom" size="xs" variant="subtle" color="neutral">
                            {{ t('providerModels.configuredEndpoint') }}
                          </UBadge>
                        </div>
                        <div class="mt-1 truncate text-xs text-muted font-mono select-all" :title="ep.fullUrl">
                          {{ ep.fullUrl || t('common.empty') }}
                        </div>
                      </div>
                    </div>
                  </div>
                </UFormField>
              </div>
            </template>
          </UCollapsible>
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
