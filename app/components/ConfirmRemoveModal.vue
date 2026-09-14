<script lang="ts" setup>
/**
 * 通用删除确认框：由 useConfirmDialog() 调用，close 事件回传布尔值
 */
const props = defineProps<{
  title?: string
  description?: string
}>()

const {t} = useI18n()

const emits = defineEmits<{
  close: [value: boolean]
}>()
</script>

<template>
  <UModal
    :title="props.title"
    :description="props.description"
    icon="i-lucide-trash-2"
    :ui="{ footer: 'justify-end' }"
  >
    <template #footer>
      <UButton
        :label="t('common.cancel')"
        color="neutral"
        variant="solid"
        @click="emits('close', false)"
      />
      <UButton
        :label="t('common.confirm')"
        color="error"
        icon="i-lucide-trash-2"
        @click="emits('close', true)"
      />
    </template>
  </UModal>
</template>
