<script setup lang="ts">
import { apiErrorMessage } from '@/lib/apiErrorMessage'
import type {
  SEndpoint,
  SModel,
  SModelInput,
  ModelEffortLevel,
  ModelReasoning,
  ModelStatus,
  ModelType,
} from '@ai-gate/shared'
import { MODEL_EFFORT_LEVELS, MODEL_DEFAULT_CATEGORY, isModelType } from '@ai-gate/shared'
import { computed, reactive, ref, watch, useId } from 'vue'
import {
  PhArrowsDownUp,
  PhBracketsAngle,
  PhCaretDown,
  PhFileText,
  PhFloppyDisk,
  PhImage,
  PhIntersectThree,
  PhSlidersHorizontal,
  PhTag,
  PhTextT,
  PhVideoCamera,
  PhWaveform,
  PhX,
} from '@phosphor-icons/vue'
import { toast } from 'vue-sonner'
import { ApiError } from '@/lib/api'
import { useProvidersStore } from '@/stores/providers'
import { splitUrl } from '@/utils/url'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet, FieldLegend } from '@/components/ui/field'
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const formId = useId()

const props = defineProps<{
  providerId: number
  modelItem: SModel | null
  existingEndpoints?: SEndpoint[]
}>()

const emit = defineEmits<{saved: [modelItem: SModel]}>()

const open = defineModel<boolean>('open', {default: false})

const store = useProvidersStore()

const isAdvancedOpen = ref(false)

const form = reactive({
  code: '',
  name: '',
  category: '',
  // 模型类型保持共享枚举，单选组的宽类型返回值由更新函数校验。
  type: 'TEXT' as ModelType,
  status: 'ACTIVE' as ModelStatus,
  enabled: true,
  inputModal: ['text'] as string[],
  outputModal: ['text'] as string[],
  generates: [] as string[],
  maxContext: '' as number | '',
  maxInput: '' as number | '',
  maxOutput: '' as number | '',
  reasoning: 'TOGGLE' as ModelReasoning,
  effortLevel: [] as ModelEffortLevel[],
  remark: '',
})

const showErrors = ref(false)
const saving = ref(false)
const formBody = ref<InstanceType<typeof DialogBody> | null>(null)

const typeOptions = computed(() => [
  {label: t('models.types.text'), value: 'TEXT', icon: PhTextT},
  {label: t('models.types.image'), value: 'IMAGE', icon: PhImage},
  {label: t('models.types.audio'), value: 'AUDIO', icon: PhWaveform},
  {label: t('models.types.video'), value: 'VIDEO', icon: PhVideoCamera},
  {label: t('models.types.omni'), value: 'OMNI', icon: PhIntersectThree},
  {label: t('models.types.embedding'), value: 'EMBEDDING', icon: PhBracketsAngle},
  {label: t('models.types.rerank'), value: 'RERANK', icon: PhArrowsDownUp},
  {label: t('models.types.class'), value: 'CLASS', icon: PhTag},
] as const)

function updateModelType(value: unknown) {
  // 单选组再次点击已选项时会发出空值，模型类型必须保留一个有效选项。
  if (isModelType(value)) form.type = value
}

const reasoningOptions = computed(() => [
  {label: t('models.reasoningModes.levels'), value: 'TOGGLE'},
  {label: t('models.reasoningModes.toggle'), value: 'SWITCH'},
  {label: t('models.reasoningModes.always'), value: 'ALWAYS'},
  {label: t('models.reasoningModes.unsupported'), value: 'DISABLE'},
] as const)

const modalityOptions = computed(() => [
  {label: t('models.types.text'), value: 'text', icon: PhTextT},
  {label: t('models.types.image'), value: 'image', icon: PhImage},
  {label: t('models.types.video'), value: 'video', icon: PhVideoCamera},
  {label: t('models.types.audio'), value: 'audio', icon: PhWaveform},
  {label: 'PDF', value: 'pdf', icon: PhFileText},
] as const)

const effortLevelOptions = computed(() => [
  {label: t('models.effort.none'), value: 'none'},
  {label: t('models.effort.minimal'), value: 'minimal'},
  {label: t('models.effort.low'), value: 'low'},
  {label: t('models.effort.medium'), value: 'medium'},
  {label: t('models.effort.high'), value: 'high'},
  {label: t('models.effort.xhigh'), value: 'xhigh'},
  {label: t('models.effort.max'), value: 'max'},
] as const satisfies readonly {label: string, value: ModelEffortLevel}[])

const contextPresets = [
  {label: '128k', value: 128000},
  {label: '256k', value: 256000},
  {label: '512k', value: 512000},
  {label: '1m', value: 1000000},
]

const inputPresets = [
  {label: '128k', value: 128000},
  {label: '256k', value: 256000},
  {label: '512k', value: 512000},
  {label: '1m', value: 1000000},
]

const outputPresets = [
  {label: '32k', value: 32000},
  {label: '64k', value: 64000},
  {label: '128k', value: 128000},
  {label: '256k', value: 256000},
]

const effectiveEndpoints = computed(() => props.existingEndpoints ?? store.endpoints)

const baseEndpoint = computed(() => effectiveEndpoints.value.find(e => e.type === 'base'))

interface GenerateEndpointItem {
  id: number
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
      isDefault: ep.isDefault,
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

watch(open, (v) => {
  if (!v) return
  form.code = props.modelItem?.code ?? ''
  form.name = props.modelItem?.name ?? ''
  // 分组留空时回退到默认分组 Default（含历史空分组数据）
  form.category = props.modelItem?.category || MODEL_DEFAULT_CATEGORY
  form.type = props.modelItem?.type ?? 'TEXT'
  form.status = props.modelItem?.status ?? 'ACTIVE'
  form.enabled = props.modelItem?.enabled ?? true
  form.inputModal = props.modelItem?.inputModal?.length
    ? [...props.modelItem.inputModal]
    : ['text']
  form.outputModal = props.modelItem?.outputModal?.length
    ? [...props.modelItem.outputModal]
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

  form.maxContext = props.modelItem?.maxContext || ''
  form.maxInput = props.modelItem?.maxInput || ''
  form.maxOutput = props.modelItem?.maxOutput || ''
  form.reasoning = props.modelItem?.reasoning ?? 'TOGGLE'
  form.effortLevel = props.modelItem?.effortLevel
    ? props.modelItem.effortLevel.filter((e): e is ModelEffortLevel => (MODEL_EFFORT_LEVELS as readonly string[]).includes(e))
    : []
  form.remark = props.modelItem?.remark ?? ''
  isAdvancedOpen.value = !!props.modelItem
  showErrors.value = false
})

watch(() => form.reasoning, (val) => {
  if (val !== 'TOGGLE') {
    form.effortLevel = []
  }
})

const codeError = computed(() =>
  showErrors.value && !form.code.trim() ? t('validation.modelCodeRequired') : undefined,
)

const canSave = computed(() => !!form.code.trim() && isModelType(form.type) && !saving.value)

async function save() {
  if (!canSave.value) {
    showErrors.value = true
    await formBody.value?.focusFirstInvalid()
    toast.error(t('validation.checkForm'))
    return
  }
  saving.value = true
  const input: SModelInput = {
    code: form.code.trim(),
    // 显示名允许为空，列表展示时回退到模型编码
    name: form.name.trim(),
    category: form.category.trim() || MODEL_DEFAULT_CATEGORY,
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
    remark: form.remark.trim(),
  }
  try {
    const saved = props.modelItem
      ? await store.updateModel(props.providerId, props.modelItem.id, input)
      : await store.createModel(props.providerId, input)
    toast.success(t('common.saved'))
    open.value = false
    emit('saved', saved)
  } catch (err) {
    if (err instanceof ApiError && (err.status === 409 || err.code === 'DUPLICATE_MODEL_CODE')) {
      toast.error(t('validation.duplicateModelCode'))
    } else {
      console.warn('[ai-gate] 保存模型失败', err)
      toast.error(apiErrorMessage(err))
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="v => open = v"
  >
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ props.modelItem ? t('models.edit') : t('models.create') }}</DialogTitle>
      </DialogHeader>

      <DialogBody ref="formBody" :aria-label="props.modelItem ? t('models.edit') : t('models.create')">
        <FieldGroup>
          <!-- 基础配置：常用必要项 -->
          <!-- 模型编码供应商内唯一，创建后不可修改：编辑态只读禁用 -->
          <Field :data-invalid="!!codeError">
            <FieldLabel :for="`${formId}-code`">{{ t('models.code') }} <span class="text-destructive">*</span></FieldLabel>
            <Input
              v-model="form.code"
              :aria-invalid="!!codeError || undefined"
              :placeholder="t('models.codePlaceholder')"
              :disabled="!!props.modelItem"
              :id="`${formId}-code`"
            />
            <FieldError v-if="codeError">
              {{ codeError }}
            </FieldError>
          </Field>

          <Field>
            <FieldLabel :for="`${formId}-name`">{{ t('models.displayName') }}</FieldLabel>
            <Input
              v-model="form.name"
              :placeholder="t('models.namePlaceholder')"
              :id="`${formId}-name`"
            />
          </Field>

          <Field>
            <FieldLabel :for="`${formId}-category`">{{ t('models.category') }}</FieldLabel>
            <Input
              v-model="form.category"
              :placeholder="t('models.categoryPlaceholder')"
              :id="`${formId}-category`"
            />
          </Field>

          <Field>
            <FieldLabel :id="`${formId}-type`">{{ t('models.type') }}</FieldLabel>
            <ToggleGroup
              :aria-labelledby="`${formId}-type`"
              :model-value="form.type"
              type="single"
              variant="outline"
              :spacing="2"
              class="grid w-full grid-cols-2 sm:grid-cols-4"
              @update:model-value="updateModelType"
            >
              <ToggleGroupItem
                v-for="item in typeOptions"
                :key="item.value"
                :value="item.value"
              >
                <component :is="item.icon" data-icon="inline-start" />
                {{ item.label }}
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>

          <!-- 额外配置：模态、Token 限制、推理、生成端点等可选扩展 -->
          <Collapsible v-model:open="isAdvancedOpen">
            <CollapsibleTrigger as-child>
              <Button variant="outline" class="group w-full justify-start text-left">
                <PhSlidersHorizontal data-icon="inline-start" class="text-muted-foreground" />
                <span class="min-w-0 flex-1">{{ t('models.advanced') }}</span>
                <PhCaretDown data-icon="inline-end" class="text-muted-foreground transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <FieldGroup class="pt-3">
                <!-- 1. 模态支持：ToggleGroup 多选（与模型类型同款交互） -->
                <Field>
                  <FieldLabel :id="`${formId}-inputModal`">{{ t('models.inputModalities') }}</FieldLabel>
                  <ToggleGroup
                    v-model="form.inputModal"
                    type="multiple"
                    variant="outline"
                    :spacing="2"
                    class="grid w-full grid-cols-3 sm:grid-cols-5"
                    :aria-labelledby="`${formId}-inputModal`"
                  >
                    <ToggleGroupItem
                      v-for="item in modalityOptions"
                      :key="item.value"
                      :value="item.value"
                    >
                      <component :is="item.icon" data-icon="inline-start" />
                      {{ item.label }}
                    </ToggleGroupItem>
                  </ToggleGroup>
                </Field>

                <Field>
                  <FieldLabel :id="`${formId}-outputModal`">{{ t('models.outputModalities') }}</FieldLabel>
                  <ToggleGroup
                    v-model="form.outputModal"
                    type="multiple"
                    variant="outline"
                    :spacing="2"
                    class="grid w-full grid-cols-3 sm:grid-cols-5"
                    :aria-labelledby="`${formId}-outputModal`"
                  >
                    <ToggleGroupItem
                      v-for="item in modalityOptions"
                      :key="item.value"
                      :value="item.value"
                    >
                      <component :is="item.icon" data-icon="inline-start" />
                      {{ item.label }}
                    </ToggleGroupItem>
                  </ToggleGroup>
                </Field>

                <!-- 2. Token 限制：标题右侧放置预设，输入框独占一行。 -->
                <Field>
                  <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <FieldLabel class="shrink-0" :for="`${formId}-maxContext`">{{ t('models.contextWindow') }}</FieldLabel>
                    <ToggleGroup :model-value="form.maxContext" type="single" :spacing="1" :aria-label="t('models.contextWindow')" class="ml-auto shrink-0" @update:model-value="v => form.maxContext = typeof v === 'number' ? v : ''">
                      <ToggleGroupItem
                        v-for="p in contextPresets"
                        :key="p.value"
                        :value="p.value"
                        as-child
                        class="h-6 min-w-0 px-2 font-mono data-[state=on]:bg-secondary data-[state=on]:text-secondary-foreground data-[state=on]:hover:bg-secondary/80 focus-visible:ring-1"
                      >
                        <Button size="xs" :variant="form.maxContext === p.value ? 'secondary' : 'ghost'">{{ p.label }}</Button>
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  <Input
                    v-model.number="form.maxContext"
                    :id="`${formId}-maxContext`"
                    type="number"
                    :placeholder="t('models.tokenPlaceholder')"
                    :min="0"
                  >
                  </Input>
                </Field>

                <Field>
                  <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <FieldLabel class="shrink-0" :for="`${formId}-maxInput`">{{ t('models.maxInputTokens') }}</FieldLabel>
                    <ToggleGroup :model-value="form.maxInput" type="single" :spacing="1" :aria-label="t('models.maxInputTokens')" class="ml-auto shrink-0" @update:model-value="v => form.maxInput = typeof v === 'number' ? v : ''">
                      <ToggleGroupItem
                        v-for="p in inputPresets"
                        :key="p.value"
                        :value="p.value"
                        as-child
                        class="h-6 min-w-0 px-2 font-mono data-[state=on]:bg-secondary data-[state=on]:text-secondary-foreground data-[state=on]:hover:bg-secondary/80 focus-visible:ring-1"
                      >
                        <Button size="xs" :variant="form.maxInput === p.value ? 'secondary' : 'ghost'">{{ p.label }}</Button>
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  <Input
                    v-model.number="form.maxInput"
                    :id="`${formId}-maxInput`"
                    type="number"
                    :placeholder="t('models.tokenPlaceholder')"
                    :min="0"
                  >
                  </Input>
                </Field>

                <Field>
                  <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <FieldLabel class="shrink-0" :for="`${formId}-maxOutput`">{{ t('models.maxOutputTokens') }}</FieldLabel>
                    <ToggleGroup :model-value="form.maxOutput" type="single" :spacing="1" :aria-label="t('models.maxOutputTokens')" class="ml-auto shrink-0" @update:model-value="v => form.maxOutput = typeof v === 'number' ? v : ''">
                      <ToggleGroupItem
                        v-for="p in outputPresets"
                        :key="p.value"
                        :value="p.value"
                        as-child
                        class="h-6 min-w-0 px-2 font-mono data-[state=on]:bg-secondary data-[state=on]:text-secondary-foreground data-[state=on]:hover:bg-secondary/80 focus-visible:ring-1"
                      >
                        <Button size="xs" :variant="form.maxOutput === p.value ? 'secondary' : 'ghost'">{{ p.label }}</Button>
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  <Input
                    v-model.number="form.maxOutput"
                    :id="`${formId}-maxOutput`"
                    type="number"
                    :placeholder="t('models.tokenPlaceholder')"
                    :min="0"
                  >
                  </Input>
                </Field>

                <!-- 推理模式 -->
                <Field>
                  <FieldLabel :for="`${formId}-reasoning`">{{ t('models.reasoningMode') }}</FieldLabel>
                  <Select v-model="form.reasoning">
                    <SelectTrigger
                      class="w-full"
                      :id="`${formId}-reasoning`"
                    >
                      <SelectValue :placeholder="t('models.selectReasoningMode')" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem
                          v-for="item in reasoningOptions"
                          :key="item.value"
                          :value="item.value"
                        >
                          {{ item.label }}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <!-- 推理档位：平铺复选，仅档位调节模式下动态展示 -->
                <FieldSet v-if="form.reasoning === 'TOGGLE'" class="min-w-0 gap-2">
                  <FieldLegend variant="label" class="mb-2 font-normal leading-snug">{{ t('models.reasoningEffort') }}</FieldLegend>
                  <div class="flex flex-wrap items-center gap-x-4 gap-y-2 pt-0.5">
                    <FieldLabel
                      v-for="item in effortLevelOptions"
                      :key="item.value"
                      :for="`${formId}-effort-${item.value}`"
                      class="cursor-pointer gap-1.5 text-xs leading-4"
                    >
                      <Checkbox
                        :id="`${formId}-effort-${item.value}`"
                        :model-value="form.effortLevel.includes(item.value)"
                        @update:model-value="() => {
                          const idx = form.effortLevel.indexOf(item.value)
                          if (idx >= 0) form.effortLevel.splice(idx, 1)
                          else form.effortLevel.push(item.value)
                        }"
                      />
                      {{ item.label }}
                    </FieldLabel>
                  </div>
                </FieldSet>

                <!-- 3. 支持生成端点列表（展示完整路径）：整卡可点的复选行 -->
                <FieldSet class="min-w-0 gap-2">
                  <FieldLegend variant="label" class="mb-2 font-normal leading-snug">{{ t('endpoints.type') }}</FieldLegend>
                  <div
                    v-if="generateEndpointList.length"
                    class="flex flex-col gap-1.5 pt-0.5"
                  >
                    <FieldLabel
                      v-for="ep in generateEndpointList"
                      :key="ep.id"
                      :for="`${formId}-generate-${ep.id}`"
                      class="hover:bg-muted/50 has-data-checked:border-primary/40 dark:has-data-checked:border-primary/40 dark:has-data-checked:bg-primary/5 w-full cursor-pointer leading-4 transition-colors [&>[data-slot=field]]:px-2.5 [&>[data-slot=field]]:py-1.5"
                    >
                      <Field orientation="horizontal" class="gap-2.5">
                        <Checkbox
                          :id="`${formId}-generate-${ep.id}`"
                          :model-value="form.generates.includes(ep.type)"
                          @update:model-value="() => toggleGenerate(ep.type)"
                        />
                        <span class="flex min-w-0 flex-1 items-center gap-2">
                          <span class="text-xs font-semibold shrink-0">{{ ep.type }}</span>
                          <Badge
                            v-if="ep.isDefault"
                            variant="secondary"
                            class="shrink-0"
                          >
                            {{ t('common.default') }}
                          </Badge>
                          <span
                            class="text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs select-all"
                            :title="ep.fullUrl"
                          >{{ ep.path || t('common.noData') }}</span>
                        </span>
                      </Field>
                    </FieldLabel>
                  </div>
                  <Empty
                    v-else
                    class="text-muted-foreground flex-none gap-0 border border-dashed bg-muted/20 p-4 text-wrap"
                  >
                    <EmptyHeader class="max-w-none gap-0">
                      <EmptyTitle class="text-xs font-normal">{{ t('models.noGenerateEndpoints') }}</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                </FieldSet>
              </FieldGroup>
            </CollapsibleContent>
          </Collapsible>

          <!-- 描述：识别性补充说明，不属能力配置；恒可见收尾于表单 -->
          <Field>
            <FieldLabel :for="`${formId}-remark`">{{ t('common.description') }}</FieldLabel>
            <Textarea
              v-model="form.remark"
              :rows="2"
              :placeholder="t('common.optional')"
              :id="`${formId}-remark`"
            />
          </Field>
        </FieldGroup>
      </DialogBody>

      <DialogFooter>
        <Button
          variant="outline"
          :disabled="saving"
          @click="open = false"
        >
          <PhX data-icon="inline-start" aria-hidden="true" />
          {{ t('common.cancel') }}
        </Button>
        <Button
          :disabled="saving"
          @click="save"
        >
          <Spinner v-if="saving" data-icon="inline-start" />
          <PhFloppyDisk
            v-else
            data-icon="inline-start"
          />
          {{ t('common.save') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
