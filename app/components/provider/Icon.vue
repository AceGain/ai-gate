<script setup lang="ts">
/**
 * 供应商显示图标：自定义上传图片（data URL）或品牌 logo（@lobehub/icons 静态 PNG，单色品牌随暗色模式切换）优先，无图标时回退首字母色块（Cherry Studio 风格）
 */
const props = withDefaults(defineProps<{
  /** 品牌 id（@lobehub/icons）、自定义图片（data:/http URL）或空串（首字母 fallback） */
  icon?: string
  /** 用于首字母 fallback 的名称 */
  name: string
  /** 展示尺寸 */
  size?: 'sm' | 'lg'
}>(), {
  icon: '',
  size: 'sm'
})

const initial = computed(() => {
  const ch = props.name.trim().charAt(0)
  return ch || '?'
})

const colorMode = useColorMode()
const src = computed(() => brandIconUrl(props.icon, colorMode.value === 'dark'))

const boxClass = computed(() => props.size === 'lg'
  ? 'size-11 rounded-lg'
  : 'size-8 rounded-md')
const imgClass = computed(() => props.size === 'lg' ? 'size-6' : 'size-4.5')
const textClass = computed(() => props.size === 'lg' ? 'text-lg font-semibold' : 'text-xs font-semibold')
</script>

<template>
  <div
    class="flex shrink-0 items-center justify-center bg-elevated text-highlighted"
    :class="boxClass"
  >
    <img
      v-if="src"
      :src="src"
      alt=""
      class="object-contain"
      :class="imgClass"
    >
    <span v-else class="text-primary" :class="textClass">{{ initial }}</span>
  </div>
</template>
