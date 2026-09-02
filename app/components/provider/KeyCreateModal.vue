<script setup lang="ts">
import type {ProviderKeyConfig} from '~/utils/providers'

/**
 * 新增/编辑密钥弹窗：填写密钥名称（可选）、密钥值与有效日期
 * 新增保存后向 provider.keys 追加一条记录；编辑模式原地更新
 */
const props = defineProps<{
  /** 传入则为编辑模式 */
  editKey?: ProviderKeyConfig | null
}>()

const emits = defineEmits<{
  /** 新增保存并返回新密钥；编辑模式返回 false */
  close: [key: ProviderKeyConfig | null]
}>()

const {t} = useI18n()
const toast = useToast()

const open = defineModel<boolean>('open', {default: false})

const isEdit = computed(() => !!props.editKey)

const form = reactive({
  name: '',
  value: '',
  expiresAt: ''
})

/** 打开时按模式初始化表单 */
watch(open, (v) => {
  if (!v) return
  if (props.editKey) {
    form.name = props.editKey.name
    form.value = props.editKey.value
    form.expiresAt = props.editKey.expiresAt
  } else {
    form.name = ''
    form.value = ''
    form.expiresAt = ''
  }
})

function save() {
  if (!form.value.trim()) {
    toast.add({color: 'error', title: t('providers.keyValueRequired')})
    return
  }
  if (props.editKey) {
    // 编辑模式：原地更新
    props.editKey.name = form.name.trim()
    props.editKey.value = form.value.trim()
    props.editKey.expiresAt = form.expiresAt
    emits('close', null)
    return
  }
  const key: ProviderKeyConfig = {
    id: newId(),
    name: form.name.trim(),
    value: form.value.trim(),
    expiresAt: form.expiresAt,
    fetchedModels: [],
    enabledModels: []
  }
  emits('close', key)
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="isEdit ? t('providers.editKeyTitle') : t('providers.addKeyTitle')"
    :description="isEdit ? undefined : t('providers.addKeyDesc')"
    :ui="{ footer: 'justify-end gap-2' }"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField :label="t('providers.keyName')" :help="t('providers.keyNameHint')">
          <UInput
            v-model="form.name"
            :placeholder="t('providers.keyNamePlaceholder')"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('providers.keyValue')">
          <UTextarea
            v-model="form.value"
            type="password"
            autoresize
            :rows="2"
            :placeholder="t('providers.keyPlaceholder')"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('providers.keyExpiresAt')" :help="t('providers.keyExpiresAtHint')">
          <UInput
            v-model="form.expiresAt"
            type="date"
            class="w-full"
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <UButton variant="solid" color="neutral" @click="open = false">
        {{ t('providers.cancel') }}
      </UButton>
      <UButton icon="i-lucide-check" :disabled="!form.value.trim()" @click="save">
        {{ t('providers.save') }}
      </UButton>
    </template>
  </UModal>
</template>
