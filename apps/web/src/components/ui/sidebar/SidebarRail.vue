<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useEventListener } from '@vueuse/core'
import { cn } from 'cn'
import { ref } from 'vue'
import { useSidebar } from './utils'

const props = withDefaults(defineProps<{
  side?: 'left' | 'right'
  class?: HTMLAttributes['class']
}>(), {
  side: 'left',
})

const { state, width, setWidth, isResizing, setResizing } = useSidebar()

let pointerId = -1
let startX = 0
let startWidth = 0

const rail = ref<HTMLElement | null>(null)

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  pointerId = event.pointerId
  startX = event.clientX
  startWidth = width.value
  rail.value?.setPointerCapture(pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (event.pointerId !== pointerId || state.value === 'collapsed') return
  setResizing(true)
  const delta = props.side === 'left' ? event.clientX - startX : startX - event.clientX
  setWidth(startWidth + delta)
}

function endPointerInteraction(event: PointerEvent) {
  if (event.pointerId !== pointerId) return
  setResizing(false)
  pointerId = -1
}

useEventListener(window, 'pointermove', onPointerMove)
useEventListener(window, 'pointerup', endPointerInteraction)
useEventListener(window, 'pointercancel', endPointerInteraction)
</script>

<template>
  <button
    ref="rail"
    data-sidebar="rail"
    data-slot="sidebar-rail"
    aria-label="拖动调整侧边栏宽度"
    :tabindex="-1"
    title="拖动调整宽度"
    :class="cn(
      'hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 touch-none transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:start-1/2 after:w-0.5 sm:flex ltr:-translate-x-1/2 rtl:-translate-x-1/2',
      'in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize',
      '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
      'group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full hover:group-data-[collapsible=offcanvas]:bg-sidebar',
      '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
      '[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
      isResizing && 'after:bg-sidebar-border',
      props.class,
    )"
    @pointerdown="onPointerDown"
  >
    <slot />
  </button>
</template>
