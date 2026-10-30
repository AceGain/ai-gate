<script setup lang="ts">
import type { ScrollAreaScrollbarProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { cn } from 'cn'
import { ScrollAreaScrollbar, ScrollAreaThumb } from 'reka-ui'

const props = withDefaults(defineProps<ScrollAreaScrollbarProps & { class?: HTMLAttributes['class'] }>(), {
  orientation: 'vertical',
})

const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <ScrollAreaScrollbar
    data-slot="scroll-area-scrollbar"
    :data-orientation="orientation"
    v-bind="delegatedProps"
    :class="cn('group/scrollbar flex touch-none select-none data-horizontal:h-3 data-horizontal:flex-col data-horizontal:px-1 data-horizontal:py-1 data-vertical:w-3 data-vertical:px-1 data-vertical:py-1', props.class)"
  >
    <ScrollAreaThumb
      data-slot="scroll-area-thumb"
      :class="cn('bg-(--scroll-area-thumb) group-hover/scroll-area:bg-(--scroll-area-thumb-hover) group-focus-within/scroll-area:bg-(--scroll-area-thumb-hover) group-active/scrollbar:bg-(--scroll-area-thumb-hover) relative flex-1 rounded-none transition-[background-color,scale] duration-150 motion-reduce:transition-none', orientation === 'vertical' ? 'group-hover/scrollbar:scale-x-150 group-active/scrollbar:scale-x-150' : 'group-hover/scrollbar:scale-y-150 group-active/scrollbar:scale-y-150')"
    />
  </ScrollAreaScrollbar>
</template>
