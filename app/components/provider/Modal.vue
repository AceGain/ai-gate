<script setup lang="ts">
import type {SysProvider, SysProviderInput} from '~/utils/providers'

/**
 * 供应商新增/编辑弹窗：基本信息（图标、编码、名称、描述、启用）
 * 编码 code 为对外模型标识前缀；排序不在弹窗编辑，由列表拖拽调整
 */
const props = defineProps<{
  /** 编辑目标；null = 新增 */
  provider: SysProvider | null
}>()

const emit = defineEmits<{saved: [provider: SysProvider]}>()

const open = defineModel<boolean>('open', {default: false})

const {t} = useI18n()
const toast = useToast()
const {providers, createProvider, updateProvider} = useProviders()

const form = reactive({
  code: '',
  name: '',
  icon: defaultProviderIcon,
  description: '',
  enabled: true
})

/** 服务端 409 冲突信息（客户端校验通过但与并发写入冲突时展示） */
const serverCodeError = ref('')

/** 是否展示校验错误：仅在尝试保存后置真，避免弹窗一打开就红字 */
const showErrors = ref(false)

/** 打开时按模式重置表单 */
watch(open, (v) => {
  if (!v) return
  form.code = props.provider?.code ?? ''
  form.name = props.provider?.name ?? ''
  form.icon = props.provider?.icon ?? defaultProviderIcon
  form.description = props.provider?.description ?? ''
  form.enabled = props.provider?.enabled ?? true
  serverCodeError.value = ''
  showErrors.value = false
})

/** 编码格式：小写字母/数字/中划线，字母或数字开头结尾（对外模型标识前缀） */
const CODE_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

/** 编码实际校验结果（与错误展示解耦，供 canSave 使用） */
const codeInvalidReason = computed(() => {
  const v = form.code.trim()
  if (!v) return t('providers.codeRequired')
  if (!CODE_PATTERN.test(v)) return t('providers.codeInvalid')
  if (providers.value.some(p => p.code === v && p.id !== props.provider?.id)) {
    return t('providers.codeDuplicate')
  }
  return undefined
})

const codeError = computed(() => {
  if (serverCodeError.value) return serverCodeError.value
  if (!showErrors.value) return undefined
  return codeInvalidReason.value
})

const nameError = computed(() =>
  showErrors.value && !form.name.trim() ? t('providers.nameRequired') : undefined
)

const saving = ref(false)
const canSave = computed(() => !codeInvalidReason.value && !!form.name.trim() && !saving.value)

async function save() {
  if (!canSave.value) {
    showErrors.value = true
    toast.add({color: 'error', title: t('providers.invalidForm')})
    return
  }
  saving.value = true
  const input: SysProviderInput = {
    code: form.code.trim(),
    name: form.name.trim(),
    icon: form.icon,
    description: form.description.trim(),
    enabled: form.enabled
  }
  try {
    const saved = props.provider
      ? await updateProvider(props.provider.id, input)
      : await createProvider(input)
    toast.add({color: 'success', title: t('providers.saved')})
    open.value = false
    emit('saved', saved)
  } catch (err) {
    const status = (err as {statusCode?: number}).statusCode
    const message = (err as {data?: {error?: string}}).data?.error ?? ''
    if (status === 409 || message.includes('Duplicate provider code')) {
      serverCodeError.value = t('providers.codeDuplicate')
    } else {
      console.warn('[ai-gate] 保存供应商失败', err)
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
    :title="props.provider ? t('providers.editTitle') : t('providers.newTitle')"
    :ui="{ content: 'max-w-md', footer: 'justify-end' }"
  >
    <template #body>
      <div class="space-y-4">
        <!-- 显示图标：居中展示，点击选择/上传 -->
        <div class="flex justify-center pb-1">
          <ProviderIconPicker v-model="form.icon" :name="form.name"/>
        </div>

        <UFormField :label="t('providers.code')" :error="codeError">
          <UInput
            v-model="form.code"
            :placeholder="t('providers.codePlaceholder')"
            class="w-full font-mono"
          />
        </UFormField>

        <UFormField :label="t('providers.name')" :error="nameError">
          <UInput
            v-model="form.name"
            :placeholder="t('providers.namePlaceholder')"
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
