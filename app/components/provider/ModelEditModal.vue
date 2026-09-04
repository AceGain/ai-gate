<script setup lang="ts">
import type {
  ProviderConfig,
  ProviderModality,
  ProviderModelType,
  ProviderProtocolId,
  ProviderReasoningEffort
} from '~/utils/providers'
import {maskKey} from '~/utils/providers'

/**
 * 新增/编辑模型弹窗：
 * 新增时手动输入模型 ID；配置显示名称、分组、类型、协议、模态、推理、上下文上限、限定密钥等
 */
const props = defineProps<{
  provider: ProviderConfig
  /** 编辑的模型 ID；null 表示新增 */
  modelId: string | null
}>()

const {t} = useI18n()
const toast = useToast()

const open = defineModel<boolean>('open', {default: false})

const isEdit = computed(() => !!props.modelId)

const selectedModel = ref('')

const form = reactive({
  enabled: true,
  displayName: '',
  group: '',
  type: 'textToText' as ProviderModelType,
  protocols: [] as ProviderProtocolId[],
  inputModalities: ['text'] as ProviderModality[],
  outputModalities: ['text'] as ProviderModality[],
  reasoning: false,
  reasoningEfforts: [] as ProviderReasoningEffort[],
  maxContext: 0,
  maxInput: 0,
  maxOutput: 0,
  allowedKeyIds: [] as string[]
})

/** 打开时按模式初始化表单 */
watch(open, (v) => {
  if (!v) return
  selectedModel.value = ''
  const existing = props.modelId ? props.provider.models[props.modelId] : undefined
  if (existing) {
    form.enabled = existing.enabled
    form.displayName = existing.displayName
    form.group = existing.group
    form.type = existing.type
    form.protocols = [...existing.protocols]
    form.inputModalities = [...existing.inputModalities]
    form.outputModalities = [...existing.outputModalities]
    form.reasoning = existing.reasoning
    form.reasoningEfforts = [...existing.reasoningEfforts]
    form.maxContext = existing.maxContext
    form.maxInput = existing.maxInput
    form.maxOutput = existing.maxOutput
    form.allowedKeyIds = [...existing.allowedKeyIds]
  } else {
    form.enabled = true
    form.displayName = ''
    form.group = ''
    form.type = 'textToText'
    // 默认关联供应商首个协议
    form.protocols = props.provider.protocols.slice(0, 1)
    form.inputModalities = ['text']
    form.outputModalities = ['text']
    form.reasoning = false
    form.reasoningEfforts = []
    form.maxContext = 0
    form.maxInput = 0
    form.maxOutput = 0
    form.allowedKeyIds = []
  }
})

const typeItems = computed(() =>
  providerModelTypes.map(ty => ({label: t(ty.labelKey), value: ty.id}))
)

const modalityItems = computed(() =>
  (['text', 'image', 'audio', 'video'] as ProviderModality[]).map(m => ({
    label: t(`providers.modality.${m}`),
    value: m
  }))
)

/** 模型可选协议 = 供应商已配置的协议 */
const protocolItems = computed(() =>
  props.provider.protocols.map(p => ({label: t('providers.protocol.' + p), value: p}))
)

/** 限定密钥选项：全部密钥（不选 = 全部可用） */
const keyItems = computed(() =>
  props.provider.keys.map(k => ({
    label: k.name || maskKey(k.value) || t('providers.keyEmptyMask'),
    value: k.id
  }))
)

const effortItems = computed(() =>
  (['low', 'medium', 'high'] as ProviderReasoningEffort[]).map(e => ({
    label: t(`providers.reasoningEffortLevel.${e}`),
    value: e
  }))
)

function save() {
  const model = isEdit.value ? props.modelId! : selectedModel.value.trim()
  if (!model) {
    toast.add({color: 'error', title: t('providers.modelRequired')})
    return
  }
  if (!isEdit.value && model in props.provider.models) {
    toast.add({color: 'error', title: t('providers.modelIdExists')})
    return
  }
  props.provider.models[model] = {
    enabled: form.enabled,
    displayName: form.displayName.trim(),
    group: form.group.trim(),
    type: form.type,
    inputModalities: [...form.inputModalities],
    outputModalities: [...form.outputModalities],
    reasoning: form.reasoning,
    reasoningEfforts: [...form.reasoningEfforts],
    maxContext: form.maxContext,
    maxInput: form.maxInput,
    maxOutput: form.maxOutput,
    protocols: [...form.protocols] as ProviderProtocolId[],
    allowedKeyIds: [...form.allowedKeyIds]
  }
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="isEdit ? t('providers.editModelTitle') : t('providers.addModelTitle')"
    :ui="{ content: 'sm:max-w-2xl', footer: 'justify-end gap-2' }"
  >
    <template #body>
      <div class="space-y-4">
        <!-- 模型：新增时手动输入 ID，编辑时只读 -->
        <UFormField :label="t('providers.modelId')">
          <UInput
            v-if="!isEdit"
            v-model="selectedModel"
            :placeholder="t('providers.modelIdPlaceholder')"
            class="w-full"
          />
          <div
            v-else
            class="flex h-8 items-center rounded-md bg-elevated px-2.5 font-mono text-sm text-highlighted"
          >
            {{ modelId }}
          </div>
        </UFormField>

        <!-- 启用开关 -->
        <div class="flex items-center justify-between">
          <span class="text-sm text-highlighted">{{ t('providers.enableModel') }}</span>
          <USwitch v-model="form.enabled"/>
        </div>

        <UFormField :label="t('providers.displayName')">
          <UInput v-model="form.displayName" :placeholder="modelId || t('providers.displayName')" class="w-full"/>
        </UFormField>

        <UFormField :label="t('providers.group')">
          <UInput v-model="form.group" :placeholder="t('providers.groupPlaceholder')" class="w-full"/>
        </UFormField>

        <UFormField :label="t('providers.modelType')">
          <USelectMenu v-model="form.type" :items="typeItems" value-key="value" class="w-full"/>
        </UFormField>

        <UFormField :label="t('providers.modelProtocols')" :hint="t('providers.modelProtocolsHint')">
          <USelectMenu
            v-model="form.protocols"
            multiple
            :items="protocolItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <!-- 限定密钥：不选 = 全部密钥可用 -->
        <UFormField :label="t('providers.allowedKeys')" :hint="t('providers.allowedKeysHint')">
          <USelectMenu
            v-model="form.allowedKeyIds"
            multiple
            :items="keyItems"
            value-key="value"
            :placeholder="t('providers.allowedKeysPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('providers.inputModalities')">
          <UCheckboxGroup
            v-model="form.inputModalities"
            :items="modalityItems"
            orientation="horizontal"
          />
        </UFormField>

        <UFormField :label="t('providers.outputModalities')">
          <UCheckboxGroup
            v-model="form.outputModalities"
            :items="modalityItems"
            orientation="horizontal"
          />
        </UFormField>

        <!-- 推理配置 -->
        <div class="space-y-4 rounded-lg border border-default p-4">
          <div class="flex items-center justify-between">
            <span class="text-sm text-highlighted">{{ t('providers.reasoning') }}</span>
            <USwitch v-model="form.reasoning"/>
          </div>
          <UFormField v-if="form.reasoning" :label="t('providers.reasoningEffort')"
                      :hint="t('providers.reasoningEffortHint')">
            <USelectMenu
              v-model="form.reasoningEfforts"
              multiple
              :items="effortItems"
              value-key="value"
              :placeholder="t('providers.reasoningEffortPlaceholder')"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- 上下文上限：一行三列，纯手输（无加减按钮） -->
        <div class="grid grid-cols-3 gap-4">
          <UFormField :label="t('providers.maxContext')">
            <UInputNumber
              v-model="form.maxContext"
              :min="0"
              :increment="false"
              :decrement="false"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('providers.maxInput')">
            <UInputNumber
              v-model="form.maxInput"
              :min="0"
              :increment="false"
              :decrement="false"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('providers.maxOutput')">
            <UInputNumber
              v-model="form.maxOutput"
              :min="0"
              :increment="false"
              :decrement="false"
              class="w-full"
            />
          </UFormField>
        </div>
      </div>
    </template>

    <template #footer>
      <UButton variant="solid" color="neutral" @click="open = false">
        {{ t('providers.cancel') }}
      </UButton>
      <UButton
        icon="i-lucide-check"
        :disabled="!isEdit && !selectedModel"
        @click="save"
      >
        {{ t('providers.save') }}
      </UButton>
    </template>
  </UModal>
</template>
