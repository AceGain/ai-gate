<script setup lang="ts">
import type { ScrollAreaRootProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'
import { cn } from 'cn'
import {
  ScrollAreaCorner,
  ScrollAreaRoot,
  ScrollAreaViewport,
} from 'reka-ui'
import ScrollBar from './ScrollBar.vue'

const props = defineProps<ScrollAreaRootProps & {
  class?: HTMLAttributes['class']
  viewportLabel?: string
}>()

const delegatedProps = reactiveOmit(props, 'class', 'viewportLabel')
const scrollArea = useTemplateRef('scrollArea')
const viewport = computed(() => scrollArea.value?.viewport)

defineExpose({ viewport })
</script>

<template>
  <ScrollAreaRoot
    ref="scrollArea"
    data-slot="scroll-area"
    v-bind="delegatedProps"
    :class="cn('group/scroll-area relative flex min-h-0 flex-col', props.class)"
  >
    <ScrollAreaViewport
      data-slot="scroll-area-viewport"
      :aria-label="viewportLabel"
      :role="viewportLabel ? 'region' : undefined"
      class="min-h-0 w-full flex-1 overscroll-y-contain rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 [&>div]:flex [&>div]:min-h-full [&>div]:flex-col"
    >
      <slot />
    </ScrollAreaViewport>
    <ScrollBar />
    <ScrollAreaCorner />
    <slot name="after" />
  </ScrollAreaRoot>
</template>
