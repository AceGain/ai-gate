<script setup lang="ts">
/**
 * 图标选择器：支持上传图片（存为 data URL）或选择内置品牌图标；空值 = 首字母 fallback
 */
const props = withDefaults(defineProps<{
  /** 用于首字母 fallback 预览的名称 */
  name?: string
}>(), {
  name: ''
})

const model = defineModel<string>({default: ''})

const {t} = useI18n()
const toast = useToast()

const AUTO_ICON = 'auto'
const CUSTOM_ICON = 'custom'
const MAX_UPLOAD_SIZE = 1024 * 1024

const isCustom = computed(() => isCustomIcon(model.value))

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

const iconItems = computed(() => {
  const items = [
    {label: t('providers.iconAuto'), value: AUTO_ICON},
    ...providerIconOptions.filter(o => o.value).map(o => ({label: o.label, value: o.value}))
  ]
  // 当前为自定义图片时补充对应选项，避免下拉框空显
  if (isCustom.value) items.splice(1, 0, {label: t('providers.iconCustom'), value: CUSTOM_ICON})
  return items
})

const selected = computed({
  get: () => {
    if (isCustom.value) return CUSTOM_ICON
    return model.value || AUTO_ICON
  },
  set: (v: string) => {
    if (v === CUSTOM_ICON) return // 自定义图片只能通过上传设置
    model.value = v === AUTO_ICON ? '' : v
  }
})

const fileInput = ref<HTMLInputElement | null>(null)

function pickFile() {
  fileInput.value?.click()
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    toast.add({color: 'error', title: t('providers.iconNotImage')})
    return
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    toast.add({color: 'error', title: t('providers.iconTooLarge')})
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    model.value = String(reader.result)
  }
  reader.readAsDataURL(file)
}
</script>

<template>
  <div class="flex items-center gap-2">
    <!-- 预览 -->
    <ProviderIcon :icon="model" :name="props.name || '?'" size="lg"/>

    <!-- 内置图标选择 -->
    <USelectMenu
      v-model="selected"
      :items="iconItems"
      value-key="value"
      class="min-w-0 flex-1"
    >
      <template #leading>
        <img
          v-if="brandIconUrl(model, isDark)"
          :src="brandIconUrl(model, isDark)"
          alt=""
          class="size-4.5 shrink-0 object-contain"
        >
        <span v-else class="text-xs font-semibold text-primary">A</span>
      </template>
      <template #item="{ item }">
        <span class="flex items-center gap-2">
          <img
            v-if="item.value !== AUTO_ICON"
            :src="isCustom && item.value === CUSTOM_ICON ? model : brandIconUrl(item.value, isDark)"
            alt=""
            class="size-4.5 object-contain"
          >
          <span v-else
                class="flex size-4.5 items-center justify-center rounded bg-elevated text-[10px] font-semibold text-primary">A</span>
          {{ item.label }}
        </span>
      </template>
    </USelectMenu>

    <!-- 上传图片 -->
    <UButton
      icon="i-lucide-image-up"
      variant="outline"
      color="neutral"
      :aria-label="t('providers.iconUpload')"
      @click="pickFile"
    />
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onFileChange"
    >
  </div>
</template>
