<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useResizeObserver, useScroll } from '@vueuse/core'
import { cn } from 'cn'
import { computed, nextTick, useTemplateRef } from 'vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

const props = defineProps<{
  class?: HTMLAttributes['class']
  contentClass?: HTMLAttributes['class']
  ariaLabel?: string
}>()

const scrollArea = useTemplateRef('scrollArea')
const content = useTemplateRef('content')
const viewport = computed(() => scrollArea.value?.viewport)
const { arrivedState, measure } = useScroll(viewport, { offset: { top: 1, bottom: 1 } })

// 展开分组、显示错误和调整窗口都会改变溢出状态，但不一定触发滚动。
useResizeObserver([viewport, content], () => { void nextTick(measure) })

async function focusFirstInvalid() {
  await nextTick()
  const invalid = content.value?.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled)')
  if (!invalid) return
  invalid.focus({ preventScroll: true })
  const field = invalid.closest('[data-slot="field"]') ?? invalid
  field.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

defineExpose({ viewport, focusFirstInvalid })
</script>

<template>
  <ScrollArea
    ref="scrollArea"
    data-slot="dialog-body"
    type="auto"
    :viewport-label="ariaLabel"
    :data-overflow-top="!arrivedState.top"
    :data-overflow-bottom="!arrivedState.bottom"
    :class="cn('-mx-4 -my-2 min-h-0 [&>[data-slot=scroll-area-viewport]]:scroll-py-2', props.class)"
  >
    <div
      ref="content"
      :class="cn('min-w-0 flex-1 px-4 py-2', contentClass)"
    >
      <slot />
    </div>
    <template #after>
      <Separator
        data-edge="top"
        :class="cn('pointer-events-none absolute inset-x-0 top-0 opacity-0 transition-opacity duration-150 motion-reduce:transition-none', !arrivedState.top && 'opacity-100')"
      />
      <Separator
        data-edge="bottom"
        :class="cn('pointer-events-none absolute inset-x-0 bottom-0 opacity-0 transition-opacity duration-150 motion-reduce:transition-none', !arrivedState.bottom && 'opacity-100')"
      />
    </template>
  </ScrollArea>
</template>
