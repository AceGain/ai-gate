<script setup lang="ts">
import { computed } from 'vue'
import { useDark } from '@vueuse/core'
import { brandIconUrl } from '@/utils/brandIcons'

/**
 * 供应商显示图标：自定义上传图片（data URL）或品牌 logo（@lobehub/icons 静态 PNG，单色品牌随暗色模式切换）优先，
 * 无图标时回退首字母色块
 */
const props = withDefaults(defineProps<{
  /** 品牌 id、自定义图片（data:/http URL）或空串（首字母 fallback） */
  icon?: string
  /** 用于首字母 fallback 的名称 */
  name: string
  /** 展示尺寸 */
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>(), {
  icon: '',
  size: 'sm',
})

const initial = computed(() => {
  const ch = props.name.trim().charAt(0)
  return ch || '?'
})

const isDark = useDark()
const src = computed(() => brandIconUrl(props.icon, isDark.value))

const boxClass = computed(() => {
  if (props.size === 'xl') return 'size-14'
  if (props.size === 'lg') return 'size-11'
  if (props.size === 'md') return 'size-10'
  return 'size-8'
})
const imgClass = computed(() => {
  if (props.size === 'xl') return 'size-8'
  if (props.size === 'lg') return 'size-7'
  if (props.size === 'md') return 'size-6'
  return 'size-4.5'
})
const textClass = computed(() => {
  if (props.size === 'xl') return 'text-xl'
  if (props.size === 'lg') return 'text-lg'
  if (props.size === 'md') return 'text-sm'
  return 'text-xs'
})
</script>

<template>
  <div
    class="bg-muted text-foreground flex shrink-0 items-center justify-center border"
    :class="boxClass"
  >
    <img
      v-if="src"
      :src="src"
      alt=""
      class="object-contain"
      :class="imgClass"
    >
    <span
      v-else
      class="text-primary font-semibold"
      :class="textClass"
    >{{ initial }}</span>
  </div>
</template>
