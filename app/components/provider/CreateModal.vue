<script setup lang="ts">
import type {ProviderConfig, ProviderProtocolConfig, ProviderProtocolId} from '~/utils/providers'

/**
 * 新增供应商弹窗：仅配置基本信息（图标、预置供应商、ID、名称、URL、备注）
 * 保存后进入详情页继续配置端点 / 密钥 / 模型；编辑一律在详情页「基本信息」进行
 */
const emits = defineEmits<{
  close: [value: boolean]
}>()

const {t} = useI18n()
const toast = useToast()
const {addProvider, providers} = useProviders()

const open = defineModel<boolean>('open', {default: false})

/** 预置供应商选项：首项为"自定义"，其余来自预置表；SelectMenu 默认支持输入过滤 */
const presetItems = computed(() => [
  {label: t('providers.presetCustom'), value: 'custom'},
  ...providerPresets.map(p => ({label: p.name, value: p.id, description: p.baseUrl}))
])

const selectedPreset = ref<string>('custom')

const form = reactive({
  providerId: '',
  name: '',
  icon: defaultProviderIcon,
  baseUrl: '',
  remark: '',
  // 协议端点不在弹窗编辑：预置供应商自动携带，自定义时在详情页配置
  protocols: [] as ProviderProtocolId[],
  endpoints: {} as Partial<Record<ProviderProtocolId, ProviderProtocolConfig>>,
  modelsEndpoint: ''
})

/** 打开时重置表单 */
watch(open, (v) => {
  if (!v) return
  selectedPreset.value = 'custom'
  form.providerId = ''
  form.name = ''
  form.icon = defaultProviderIcon
  form.baseUrl = ''
  form.remark = ''
  form.protocols = []
  form.endpoints = {}
  form.modelsEndpoint = ''
})

/** 选择预置供应商后自动填充基本信息 */
function onPresetChange(value: string) {
  selectedPreset.value = value
  applyPreset(form, value)
  form.remark = ''
}

const providerIdExists = computed(() =>
  providers.value.some(p => p.providerId === form.providerId.trim())
)

/** 必填与格式校验：字段级红字 + 保存按钮禁用 */
const providerIdError = computed(() => {
  if (providerIdExists.value) return t('providers.providerIdDuplicate')
  if (!form.providerId.trim()) return t('providers.providerIdRequired')
  return undefined
})

const nameError = computed(() =>
  form.name.trim() ? undefined : t('providers.nameRequired')
)

const baseUrlError = computed(() => {
  const v = form.baseUrl.trim()
  if (!v) return t('providers.baseUrlRequired')
  try {
    const u = new URL(v)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return t('providers.baseUrlInvalid')
    return undefined
  } catch {
    return t('providers.baseUrlInvalid')
  }
})

const canSave = computed(() =>
  !providerIdError.value && !nameError.value && !baseUrlError.value
)

function save() {
  const trimmedId = form.providerId.trim()
  if (!trimmedId || !form.name.trim() || !form.baseUrl.trim()) {
    toast.add({color: 'error', title: t('providers.invalidForm')})
    return
  }
  if (providerIdExists.value) {
    toast.add({color: 'error', title: t('providers.providerIdDuplicate')})
    return
  }

  const provider: ProviderConfig = {
    id: newId(),
    presetId: providerPresets.find(p => p.id === selectedPreset.value)?.id ?? null,
    enabled: true,
    providerId: trimmedId,
    name: form.name.trim(),
    icon: form.icon,
    baseUrl: form.baseUrl.trim(),
    remark: form.remark.trim(),
    protocols: [...form.protocols],
    defaultProtocol: form.protocols[0] ?? null,
    endpoints: structuredClone(toRaw(form.endpoints)),
    modelsEndpoint: form.modelsEndpoint,
    keyStrategy: 'failover',
    keys: [],
    models: {}
  }
  addProvider(provider)
  toast.add({color: 'success', title: t('providers.saved')})
  open.value = false
  emits('close', true)
  // 保存后进入详情页的配置引导模式，继续配置端点 / 密钥 / 模型
  navigateTo(`/providers/${provider.id}?setup=1`)
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('providers.newTitle')"
    :description="t('providers.newPageHint')"
    :ui="{ footer: 'justify-end gap-2' }"
  >
    <template #body>
      <div class="space-y-4">
        <!-- 显示图标：上传图片 / 内置品牌图标 -->
        <UFormField :label="t('providers.icon')">
          <ProviderIconPicker v-model="form.icon" :name="form.name"/>
        </UFormField>

        <!-- 预置供应商 -->
        <UFormField :label="t('providers.preset')">
          <USelectMenu
            :model-value="selectedPreset"
            :items="presetItems"
            value-key="value"
            :placeholder="t('providers.presetPlaceholder')"
            class="w-full"
            @update:model-value="onPresetChange"
          />
        </UFormField>

        <!-- 基本信息：每个字段独占一行 -->
        <UFormField
          :label="t('providers.providerId')"
          :error="providerIdError"
        >
          <UInput
            v-model="form.providerId"
            :placeholder="t('providers.providerIdPlaceholder')"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('providers.name')" :error="nameError">
          <UInput
            v-model="form.name"
            :placeholder="t('providers.namePlaceholder')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('providers.baseUrl')" :error="baseUrlError">
          <UInput
            v-model="form.baseUrl"
            :placeholder="t('providers.baseUrlPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('providers.remark')">
          <UTextarea
            v-model="form.remark"
            autoresize
            :rows="2"
            :placeholder="t('providers.remarkPlaceholder')"
            class="w-full"
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <UButton variant="solid" color="neutral" @click="open = false">
        {{ t('providers.cancel') }}
      </UButton>
      <UButton icon="i-lucide-check" :disabled="!canSave" @click="save">
        {{ t('providers.save') }}
      </UButton>
    </template>
  </UModal>
</template>
