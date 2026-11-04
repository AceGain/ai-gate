<script setup lang="ts">
import { computed, defineComponent } from 'vue'
import { isCustomIcon, resolveBrandIcon } from '@/utils/brandIcons'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

/**
 * 供应商显示图标：自定义图片或 Lobe Icons Vue SVG 优先，
 * 无图标或图片加载失败时回退首字母色块
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

const src = computed(() => isCustomIcon(props.icon) ? props.icon : '')
// 每个头像使用自己的响应式首字母，加载中或分包失败时都能显示。
const iconFallback = defineComponent({
  inheritAttrs: false,
  setup: () => () => initial.value,
})
const brandIcon = computed(() => resolveBrandIcon(props.icon, iconFallback))

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
  <Avatar
    :key="src"
    class="bg-muted text-foreground items-center justify-center rounded-none border after:hidden"
    :class="boxClass"
  >
    <AvatarImage
      v-if="src"
      :src="src"
      alt=""
      class="rounded-none object-contain"
      :class="imgClass"
    />
    <AvatarFallback
      class="text-primary size-auto rounded-none bg-transparent font-semibold"
      :class="textClass"
    >
      <component v-if="brandIcon" :is="brandIcon" size="100%" class="text-foreground" :class="imgClass" aria-hidden="true" />
      <template v-else>{{ initial }}</template>
    </AvatarFallback>
  </Avatar>
</template>
