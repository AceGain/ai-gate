<script setup lang="ts">
import {
  providerIconOptions,
  brandIconUrl
} from '~/utils/brandIcons'

/**
 * 图标选择器：
 * 1. 头像居中展示，悬浮有相机遮罩提示
 * 2. 点击弹出选择面板：支持关键词搜索、上传图片、自动首字母
 * 3. 图标平铺展示，不区分常用品牌
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

const MAX_UPLOAD_SIZE = 1024 * 1024

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

const open = ref(false)
const search = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const allIcons = computed(() => providerIconOptions.filter(o => o.value))

/** 展示的图标列表（有搜索时过滤，无搜索时展示全部，不区分常用） */
const displayedIcons = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return allIcons.value
  return allIcons.value.filter(o =>
    o.value.toLowerCase().includes(q) || o.label.toLowerCase().includes(q)
  )
})

function selectIcon(val: string) {
  model.value = val
  open.value = false
}

function resetToAuto() {
  model.value = ''
  open.value = false
}

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
    open.value = false
  }
  reader.readAsDataURL(file)
}

// 弹窗关闭时清空搜索关键词
watch(open, (v) => {
  if (!v) search.value = ''
})
</script>

<template>
  <div class="flex flex-col items-center justify-center">
    <!-- 居中头像/图标按钮，点击弹出可视化选择器 -->
    <UPopover
      v-model:open="open"
      :content="{ side: 'bottom', align: 'center', sideOffset: 8 }"
      :ui="{ content: 'w-84 p-3 shadow-xl' }"
    >
      <button
        type="button"
        class="group relative flex size-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-default bg-elevated transition-all hover:border-primary/60 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        :aria-label="t('providers.iconChange')"
      >
        <ProviderIcon :icon="model" :name="props.name || '?'" size="xl"/>
        <!-- 悬停半透明遮罩与相机提示 -->
        <div class="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <UIcon name="i-lucide-camera" class="size-4.5 text-white drop-shadow"/>
        </div>
      </button>

      <!-- 弹出的网格选择面板 -->
      <template #content>
        <div class="flex flex-col gap-2.5">
          <!-- 搜索框 -->
          <UInput
            v-model="search"
            icon="i-lucide-search"
            :placeholder="t('providers.iconSearch')"
            size="sm"
            class="w-full"
            autofocus
          >
            <template v-if="search" #trailing>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                color="neutral"
                size="xs"
                @click="search = ''"
              />
            </template>
          </UInput>

          <!-- 顶部快捷操作：自动首字母 / 上传图片 -->
          <div class="flex items-center gap-2 border-b border-default pb-2.5 text-xs">
            <button
              type="button"
              class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 transition-colors"
              :class="!model ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-default bg-elevated text-default hover:bg-accented'"
              @click="resetToAuto"
            >
              <UIcon name="i-lucide-sparkles" class="size-3.5"/>
              <span>{{ t('providers.iconAuto') }}</span>
            </button>
            <button
              type="button"
              class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-default bg-elevated px-2.5 py-1.5 text-default transition-colors hover:bg-accented"
              @click="pickFile"
            >
              <UIcon name="i-lucide-upload" class="size-3.5"/>
              <span>{{ t('providers.iconUpload') }}</span>
            </button>
          </div>

          <!-- 图标网格展示区（不区分常用品牌，单一平铺网格） -->
          <div class="max-h-64 overflow-y-auto overscroll-contain pr-0.5">
            <div v-if="displayedIcons.length" class="grid grid-cols-6 gap-1.5">
              <button
                v-for="item in displayedIcons"
                :key="item.value"
                type="button"
                class="flex size-10 cursor-pointer items-center justify-center rounded-lg border p-1 transition-all hover:border-primary/50 hover:bg-elevated"
                :class="model === item.value ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-transparent bg-elevated/60'"
                :title="item.label"
                @click="selectIcon(item.value)"
              >
                <img
                  :src="brandIconUrl(item.value, isDark)"
                  alt=""
                  class="size-6 object-contain"
                >
              </button>
            </div>
            <div v-else class="py-8 text-center text-xs text-muted">
              {{ t('providers.iconNotFound') }}
            </div>
          </div>
        </div>
      </template>
    </UPopover>

    <!-- 隐藏的本地文件输入 -->
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onFileChange"
    >
  </div>
</template>
