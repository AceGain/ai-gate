<script setup lang="ts">
import type {SysEndpointGenerate, SysProvider, SysProviderInput} from '~/utils/providers'
import {SYS_ENDPOINT_GENERATES, SYS_ENDPOINT_GENERATE_DEFAULT_PATHS} from '~/utils/providers'
import {defaultProviderIcon} from '~/utils/brandIcons'

/**
 * 供应商新增/编辑弹窗：基本信息（图标、编码、名称、描述、启用）
 * 新增模式额外初始化端点（端点类型 + 端点地址，默认路径自动填充）与首个密钥；
 * 编辑模式仅维护基本信息，端点/密钥在供应商详情页管理
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
  baseUrl: '',
  generate: SYS_ENDPOINT_GENERATES[0] as SysEndpointGenerate,
  generatePath: '',
  secret: '',
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
  form.baseUrl = ''
  form.generate = SYS_ENDPOINT_GENERATES[0]
  form.generatePath = SYS_ENDPOINT_GENERATE_DEFAULT_PATHS[SYS_ENDPOINT_GENERATES[0]]
  form.secret = ''
  form.description = props.provider?.description ?? ''
  form.enabled = props.provider?.enabled ?? true
  serverCodeError.value = ''
  showErrors.value = false
})

/** 生成端点类型选项（固定三种） */
const generateOptions = computed(() =>
  SYS_ENDPOINT_GENERATES.map(p => ({label: p, value: p}))
)

/** 端点地址占位符：当前生成端点类型的默认路径 */
const generatePathPlaceholder = computed(() =>
  SYS_ENDPOINT_GENERATE_DEFAULT_PATHS[form.generate]
)

/** 切换生成端点类型时，端点地址为空或仍是上一生成端点类型的默认路径则自动填充新生成端点类型默认路径 */
watch(() => form.generate, (newGen, oldGen) => {
  const oldDefault = oldGen && oldGen in SYS_ENDPOINT_GENERATE_DEFAULT_PATHS
    ? SYS_ENDPOINT_GENERATE_DEFAULT_PATHS[oldGen as SysEndpointGenerate]
    : ''
  if (!form.generatePath || form.generatePath === oldDefault) {
    if (newGen in SYS_ENDPOINT_GENERATE_DEFAULT_PATHS) {
      form.generatePath = SYS_ENDPOINT_GENERATE_DEFAULT_PATHS[newGen as SysEndpointGenerate]
    }
  }
})

/** 编码格式：大小写字母/数字/中划线，字母或数字开头结尾（对外模型标识前缀） */
const CODE_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/

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

/** Base URL 校验结果：仅新增模式下校验必填 */
const baseUrlInvalidReason = computed(() => {
  if (props.provider) return undefined
  const v = form.baseUrl.trim()
  if (!v) return t('providers.baseUrlRequired')
  return undefined
})

const baseUrlError = computed(() => {
  if (!showErrors.value) return undefined
  return baseUrlInvalidReason.value
})

/** 生成端点地址校验结果：仅新增模式下校验必填（生成端点类型由选择器保证有值） */
const generatePathInvalidReason = computed(() => {
  if (props.provider) return undefined
  return form.generatePath.trim() ? undefined : t('providerEndpoints.pathRequired')
})

const generatePathError = computed(() => {
  if (!showErrors.value) return undefined
  return generatePathInvalidReason.value
})

/** 密钥校验结果：仅新增模式下校验必填 */
const secretInvalidReason = computed(() => {
  if (props.provider) return undefined
  return form.secret.trim() ? undefined : t('providerKeys.secretRequired')
})

const secretError = computed(() => {
  if (!showErrors.value) return undefined
  return secretInvalidReason.value
})

const saving = ref(false)
const canSave = computed(() =>
  !codeInvalidReason.value &&
  !!form.name.trim() &&
  !baseUrlInvalidReason.value &&
  !generatePathInvalidReason.value &&
  !secretInvalidReason.value &&
  !saving.value
)

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
    enabled: form.enabled,
    ...(!props.provider ? {
      baseUrl: form.baseUrl.trim(),
      generateEndpoint: {generate: form.generate, path: form.generatePath.trim()},
      // 首个密钥名称固定为 default（标识符，不随界面语言本地化）
      apiKey: {name: 'default', secret: form.secret.trim()}
    } : {})
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

        <!-- 编码全局唯一，创建后不可修改：编辑态只读禁用（与端点类型字段同范式） -->
        <UFormField :label="t('providers.code')" required :error="codeError">
          <UInput
            v-model="form.code"
            :placeholder="t('providers.codePlaceholder')"
            :disabled="!!props.provider"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('providers.name')" required :error="nameError">
          <UInput
            v-model="form.name"
            :placeholder="t('providers.namePlaceholder')"
            class="w-full"
          />
        </UFormField>

        <UFormField
          v-if="!props.provider"
          :label="t('providers.baseUrl')"
          required
          :error="baseUrlError"
        >
          <UInput
            v-model="form.baseUrl"
            :placeholder="t('providers.baseUrlPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <template v-if="!props.provider">
          <!-- 初始生成端点：生成端点类型 + 端点地址（默认路径自动填充） -->
          <UFormField :label="t('providerEndpoints.type')">
            <USelect
              v-model="form.generate"
              :items="generateOptions"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('providerEndpoints.path')" required :error="generatePathError">
            <UInput
              v-model="form.generatePath"
              :placeholder="generatePathPlaceholder"
              class="w-full"
            />
          </UFormField>

          <!-- 初始密钥：创建后可在供应商详情页管理 -->
          <UFormField :label="t('providers.secret')" required :error="secretError">
            <UInput
              v-model="form.secret"
              type="password"
              :placeholder="t('providerKeys.secretPlaceholder')"
              class="w-full"
            />
          </UFormField>
        </template>

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
