<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDark } from '@vueuse/core'
import {
  PhCamera,
  PhMagnifyingGlass,
  PhSparkle,
  PhUploadSimple,
  PhX,
} from '@phosphor-icons/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { brandIconUrl, providerIconOptions } from '@/utils/brandIcons'
import ProviderIcon from './ProviderIcon.vue'

/**
 * 图标选择器：头像居中展示，悬浮相机遮罩提示；
 * 点击弹窗内支持关键词搜索、上传图片、自动首字母
 */
const props = withDefaults(defineProps<{
  /** 用于首字母 fallback 预览的名称 */
  name?: string
}>(), {
  name: '',
})

const model = defineModel<string>({default: ''})


const MAX_UPLOAD_SIZE = 1024 * 1024

const isDark = useDark()
const open = ref(false)
const search = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const allIcons = computed(() => providerIconOptions.filter(o => o.value))

/** 展示的图标列表（有搜索时过滤，无搜索时展示全部，不区分常用） */
const displayedIcons = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return allIcons.value
  return allIcons.value.filter(o =>
    o.value.toLowerCase().includes(q) || o.label.toLowerCase().includes(q),
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
    toast.error('请选择图片文件')
    return
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    toast.error('图片不能超过 1MB')
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
    <Button
      variant="outline"
      size="icon-lg"
      class="group relative size-14 shrink-0 p-0"
      aria-label="更换图标"
      @click="open = true"
    >
      <ProviderIcon
        :icon="model"
        :name="props.name || '?'"
        size="xl"
      />
      <!-- 悬停半透明遮罩与相机提示 -->
      <span class="bg-muted/80 absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
        <PhCamera class="size-4" />
      </span>
    </Button>

    <Dialog
      :open="open"
      @update:open="v => open = v"
    >
      <DialogContent class="max-h-[calc(100%-4rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>更换图标</DialogTitle>
        </DialogHeader>

        <div class="flex min-h-0 flex-col gap-2.5 overflow-y-auto">
          <!-- 搜索框 -->
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <PhMagnifyingGlass />
            </InputGroupAddon>
            <InputGroupInput
              v-model="search"
              placeholder="搜索品牌图标..."
            />
            <InputGroupAddon align="inline-end">
              <Button
                v-if="search"
                variant="ghost"
                size="icon-xs"
                aria-label="清空"
                @click="search = ''"
              >
                <PhX />
              </Button>
            </InputGroupAddon>
          </InputGroup>

          <!-- 顶部快捷操作：自动首字母 / 上传图片 -->
          <div class="flex items-center gap-2 border-b pb-2.5">
            <Button
              :variant="!model ? 'secondary' : 'outline'"
              class="flex-1 justify-center"
              @click="resetToAuto"
            >
              <PhSparkle data-icon="inline-start" />
              自动（首字母）
            </Button>
            <Button
              variant="outline"
              class="flex-1 justify-center"
              @click="pickFile"
            >
              <PhUploadSimple data-icon="inline-start" />
              上传图片
            </Button>
          </div>

          <!-- 图标网格展示区（单一平铺网格） -->
          <div class="max-h-64 overflow-y-auto overscroll-contain pr-0.5">
            <div
              v-if="displayedIcons.length"
              class="grid grid-cols-6 gap-1.5"
            >
              <button
                v-for="item in displayedIcons"
                :key="item.value"
                type="button"
                class="bg-muted/60 hover:border-primary/50 hover:bg-muted flex size-10 items-center justify-center border p-1 transition-all"
                :class="model === item.value ? 'border-primary bg-primary/10' : 'border-transparent'"
                :title="item.label"
                :aria-label="item.label"
                @click="selectIcon(item.value)"
              >
                <img
                  :src="brandIconUrl(item.value, isDark)"
                  alt=""
                  class="size-6 object-contain"
                >
              </button>
            </div>
            <div
              v-else
              class="text-muted-foreground py-8 text-center text-xs"
            >
              未找到匹配图标
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

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
