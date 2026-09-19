<script setup lang="ts">
import type {
  SysModel,
  SysModelInput,
  SysModelReasoning,
  SysModelStatus,
  SysModelType,
  SysModelModality,
  SysModelEffortLevel,
  SysEndpoint
} from '~/utils/providers'
import {
  SYS_MODEL_MODALITIES,
  SYS_MODEL_EFFORT_LEVELS,
  SYS_MODEL_DEFAULT_CATEGORY,
  splitUrl
} from '~/utils/providers'

const props = defineProps<{
  providerId: string
  modelItem: SysModel | null
  existingEndpoints?: SysEndpoint[]
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
  type: 'TEXT' as SysModelType,
  status: 'ACTIVE' as SysModelStatus,
  enabled: true,
  inputModal: ['text'] as SysModelModality[],
  outputModal: ['text'] as SysModelModality[],
  generates: [] as string[],
  maxContext: null as number | null,
  maxInput: null as number | null,
  maxOutput: null as number | null,
  reasoning: 'TOGGLE' as SysModelReasoning,
  effortLevel: [] as SysModelEffortLevel[],
  description: ''
})

const showErrors = ref(false)
const saving = ref(false)

const typeOptions = computed<{label: string, value: SysModelType, icon: string}[]>(() => [
  {label: t('providerModels.typeText'), value: 'TEXT', icon: 'i-lucide-type'},
  {label: t('providerModels.typeImage'), value: 'IMAGE', icon: 'i-lucide-image'},
  {label: t('providerModels.typeVideo'), value: 'VIDEO', icon: 'i-lucide-video'},
  {label: t('providerModels.typeAudio'), value: 'AUDIO', icon: 'i-lucide-music'},
  {label: t('providerModels.typeEmbedding'), value: 'EMBEDDING', icon: 'i-lucide-binary'},
  {label: t('providerModels.typeRerank'), value: 'RERANK', icon: 'i-lucide-arrow-up-down'}
])

const reasoningOptions = computed(() => [
  {label: t('providerModels.reasoningToggle'), value: 'TOGGLE'},
  {label: t('providerModels.reasoningSwitch'), value: 'SWITCH'},
  {label: t('providerModels.reasoningAlways'), value: 'ALWAYS'},
  {label: t('providerModels.reasoningDisable'), value: 'DISABLE'}
])

const modalityOptions = computed<{label: string, value: SysModelModality, icon: string}[]>(() => [
  {label: t('providerModels.modalityText'), value: 'text', icon: 'i-lucide-type'},
  {label: t('providerModels.modalityImage'), value: 'image', icon: 'i-lucide-image'},
  {label: t('providerModels.modalityVideo'), value: 'video', icon: 'i-lucide-video'},
  {label: t('providerModels.modalityAudio'), value: 'audio', icon: 'i-lucide-music'},
  {label: t('providerModels.modalityPdf'), value: 'pdf', icon: 'i-lucide-file-text'}
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

const effectiveEndpoints = computed(() => props.existingEndpoints ?? endpoints.value)

const baseEndpoint = computed(() => {
  return effectiveEndpoints.value.find(e => e.type === 'base')
})

interface GenerateEndpointItem {
  id: string
  type: string
  path: string
  fullUrl: string
  isDefault: boolean
}

const generateEndpointList = computed<GenerateEndpointItem[]>(() => {
  return effectiveEndpoints.value
    .filter(e => e.type === 'generate')
    .map(ep => ({
      id: ep.id,
      type: ep.generate || ep.path,
      path: ep.path,
      fullUrl: splitUrl(baseEndpoint.value?.path, ep.path).fullUrl,
      isDefault: ep.isDefault
    }))
})

function toggleGenerate(genType: string) {
  const idx = form.generates.indexOf(genType)
  if (idx >= 0) {
    form.generates.splice(idx, 1)
  } else {
    form.generates.push(genType)
  }
}

function toggleModality(field: 'inputModal' | 'outputModal', value: SysModelModality) {
  const list = form[field]
  const idx = list.indexOf(value)
  if (idx >= 0) {
    list.splice(idx, 1)
  } else {
    list.push(value)
  }
}

watch(open, (v) => {
  if (!v) return
  form.code = props.modelItem?.code ?? ''
  form.name = props.modelItem?.name ?? ''
  // 分组留空时回退到默认分组 Default（含历史空分组数据）
  form.category = props.modelItem?.category || SYS_MODEL_DEFAULT_CATEGORY
  form.type = props.modelItem?.type ?? 'TEXT'
  form.status = props.modelItem?.status ?? 'ACTIVE'
  form.enabled = props.modelItem?.enabled ?? true
  form.inputModal = props.modelItem?.inputModal?.length
    ? props.modelItem.inputModal.filter((m): m is SysModelModality => (SYS_MODEL_MODALITIES as readonly string[]).includes(m))
    : ['text']
  form.outputModal = props.modelItem?.outputModal?.length
    ? props.modelItem.outputModal.filter((m): m is SysModelModality => (SYS_MODEL_MODALITIES as readonly string[]).includes(m))
    : ['text']

  const availableGenerates = effectiveEndpoints.value
    .filter(e => e.type === 'generate')
    .map(e => e.generate || e.path)
  const availableSet = new Set(availableGenerates)

  if (props.modelItem?.generates?.length) {
    form.generates = props.modelItem.generates.filter(g => availableSet.has(g))
  } else if (!props.modelItem) {
    const defaultEp = effectiveEndpoints.value.find(e => e.type === 'generate' && e.isDefault)
    const firstGen = effectiveEndpoints.value.find(e => e.type === 'generate')
    const initialGen = (defaultEp?.generate || defaultEp?.path) || (firstGen?.generate || firstGen?.path)
    form.generates = initialGen ? [initialGen] : []
  } else {
    form.generates = []
  }

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
    // 显示名允许为空，列表展示时回退到模型编码
    name: form.name.trim(),
    category: form.category.trim() || SYS_MODEL_DEFAULT_CATEGORY,
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
          <!-- 模型编码全局唯一，创建后不可修改：编辑态只读禁用（与端点类型字段同范式） -->
          <UFormField :label="t('providerModels.code')" required :error="codeError">
            <UInput
              v-model="form.code"
              :placeholder="t('providerModels.codePlaceholder')"
              :disabled="!!props.modelItem"
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
            <div class="flex flex-wrap items-center gap-1.5">
              <UButton
                v-for="item in typeOptions"
                :key="item.value"
                type="button"
                :icon="item.icon"
                :label="item.label"
                :variant="form.type === item.value ? 'subtle' : 'outline'"
                :color="form.type === item.value ? 'primary' : 'neutral'"
                class="cursor-pointer select-none"
                @click="form.type = item.value"
              />
            </div>
          </UFormField>
        </div>

        <!-- 额外配置：模态、Token限制、推理、生成端点等可选扩展 -->
        <div class="pt-1">
          <UCollapsible v-model:open="isAdvancedOpen" :unmount-on-hide="false" class="w-full">
            <UButton
              color="neutral"
              variant="ghost"
              block
              class="group justify-between px-0 py-2 border-b border-default cursor-pointer transition-colors hover:bg-transparent"
              :trailing-icon="isAdvancedOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              :ui="{
                trailingIcon: 'text-muted transition-colors group-hover:text-default'
              }"
            >
              <div class="flex items-center gap-2">
                <UIcon
                  name="i-lucide-sliders-horizontal"
                  class="size-5 text-muted transition-colors group-hover:text-default"
                />
                <span
                  class="text-sm font-medium text-default transition-colors group-hover:text-highlighted"
                >
                  {{ t('providerModels.advancedConfig') }}
                </span>
              </div>
            </UButton>

            <template #content>
              <div class="pt-3 space-y-4">
                <!-- 1. 模态支持：平铺图标+文字切换按钮（与模型类型同款交互） -->
                <UFormField :label="t('providerModels.inputModal')">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <UButton
                      v-for="item in modalityOptions"
                      :key="item.value"
                      type="button"
                      :icon="item.icon"
                      :label="item.label"
                      :variant="form.inputModal.includes(item.value) ? 'subtle' : 'outline'"
                      :color="form.inputModal.includes(item.value) ? 'primary' : 'neutral'"
                      :aria-pressed="form.inputModal.includes(item.value)"
                      class="cursor-pointer select-none"
                      @click="toggleModality('inputModal', item.value)"
                    />
                  </div>
                </UFormField>

                <UFormField :label="t('providerModels.outputModal')">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <UButton
                      v-for="item in modalityOptions"
                      :key="item.value"
                      type="button"
                      :icon="item.icon"
                      :label="item.label"
                      :variant="form.outputModal.includes(item.value) ? 'subtle' : 'outline'"
                      :color="form.outputModal.includes(item.value) ? 'primary' : 'neutral'"
                      :aria-pressed="form.outputModal.includes(item.value)"
                      class="cursor-pointer select-none"
                      @click="toggleModality('outputModal', item.value)"
                    />
                  </div>
                </UFormField>

                <!-- 2. Token 限制与快捷输入（标题行右侧预设按钮） -->
                <!-- 上下文 -->
                <UFormField :label="t('providerModels.maxContext')">
                  <template #hint>
                    <div class="flex items-center gap-1">
                      <UButton
                        v-for="p in contextPresets"
                        :key="p.value"
                        type="button"
                        :variant="form.maxContext === p.value ? 'subtle' : 'ghost'"
                        :color="form.maxContext === p.value ? 'primary' : 'neutral'"
                        class="px-1.5 py-0.5 text-xs font-mono cursor-pointer"
                        @click="form.maxContext = form.maxContext === p.value ? null : p.value"
                      >
                        {{ p.label }}
                      </UButton>
                    </div>
                  </template>
                  <UInput
                    v-model.number="form.maxContext"
                    type="number"
                    :placeholder="t('providerModels.tokenPlaceholder')"
                    class="w-full"
                  />
                </UFormField>

                <!-- 最大输入 -->
                <UFormField :label="t('providerModels.maxInput')">
                  <template #hint>
                    <div class="flex items-center gap-1">
                      <UButton
                        v-for="p in inputPresets"
                        :key="p.value"
                        type="button"
                        :variant="form.maxInput === p.value ? 'subtle' : 'ghost'"
                        :color="form.maxInput === p.value ? 'primary' : 'neutral'"
                        class="px-1.5 py-0.5 text-xs font-mono cursor-pointer"
                        @click="form.maxInput = form.maxInput === p.value ? null : p.value"
                      >
                        {{ p.label }}
                      </UButton>
                    </div>
                  </template>
                  <UInput
                    v-model.number="form.maxInput"
                    type="number"
                    :placeholder="t('providerModels.tokenPlaceholder')"
                    class="w-full"
                  />
                </UFormField>

                <!-- 最大输出 -->
                <UFormField :label="t('providerModels.maxOutput')">
                  <template #hint>
                    <div class="flex items-center gap-1">
                      <UButton
                        v-for="p in outputPresets"
                        :key="p.value"
                        type="button"
                        :variant="form.maxOutput === p.value ? 'subtle' : 'ghost'"
                        :color="form.maxOutput === p.value ? 'primary' : 'neutral'"
                        class="px-1.5 py-0.5 text-xs font-mono cursor-pointer"
                        @click="form.maxOutput = form.maxOutput === p.value ? null : p.value"
                      >
                        {{ p.label }}
                      </UButton>
                    </div>
                  </template>
                  <UInput
                    v-model.number="form.maxOutput"
                    type="number"
                    :placeholder="t('providerModels.tokenPlaceholder')"
                    class="w-full"
                  />
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
                  <div v-if="generateEndpointList.length" class="space-y-2 pt-0.5">
                    <!-- UCheckbox card 变体：根节点渲染为原生 label，整卡可点、Space 键盘切换、焦点环与选中态由主题自带；单行紧凑布局（类型名 + URL 同行） -->
                    <UCheckbox
                      v-for="ep in generateEndpointList"
                      :key="ep.id"
                      :model-value="form.generates.includes(ep.type)"
                      variant="card"
                      :ui="{
                        root: 'cursor-pointer select-none items-center px-2.5 py-1.5',
                        wrapper: 'flex flex-row items-center gap-2 min-w-0 flex-1',
                        label: 'text-xs font-semibold shrink-0',
                        description: 'min-w-0 flex-1 truncate text-xs font-mono'
                      }"
                      @update:model-value="() => toggleGenerate(ep.type)"
                    >
                      <template #label>
                        <span
                          class="flex items-center gap-2"
                          :class="form.generates.includes(ep.type) ? 'text-highlighted' : 'text-default'"
                        >
                          {{ ep.type }}
                          <UBadge
                            v-if="ep.isDefault"
                            variant="subtle"
                            color="primary"
                          >
                            {{ t('providerEndpoints.defaultBadge') }}
                          </UBadge>
                        </span>
                      </template>

                      <template #description>
                        <span class="select-all" :title="ep.fullUrl">
                          {{ ep.path || t('common.empty') }}
                        </span>
                      </template>
                    </UCheckbox>
                  </div>
                  <div
                    v-else
                    class="flex items-center justify-center p-4 border border-dashed border-default bg-elevated/10 text-xs text-muted"
                  >
                    {{ t('providerModels.noGenerateEndpoints') }}
                  </div>
                </UFormField>

              </div>
            </template>
          </UCollapsible>
        </div>

        <!-- 描述：识别性补充说明，不属能力配置；恒可见收尾于表单（与供应商弹窗同范式） -->
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
