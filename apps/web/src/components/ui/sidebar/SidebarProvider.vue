<script setup lang="ts">
import type { HTMLAttributes, Ref } from 'vue'
import { defaultDocument, useEventListener, useLocalStorage, useMediaQuery, useVModel } from '@vueuse/core'
import { cn } from 'cn'
import { TooltipProvider } from 'reka-ui'
import { computed, ref } from 'vue'
import { clampSidebarWidth, provideSidebarContext, SIDEBAR_COOKIE_MAX_AGE, SIDEBAR_COOKIE_NAME, SIDEBAR_KEYBOARD_SHORTCUT, SIDEBAR_WIDTH_DEFAULT, SIDEBAR_WIDTH_ICON, SIDEBAR_WIDTH_STORAGE_KEY } from './utils'

const props = withDefaults(defineProps<{
  defaultOpen?: boolean
  open?: boolean
  class?: HTMLAttributes['class']
}>(), {
  defaultOpen: !defaultDocument?.cookie.includes(`${SIDEBAR_COOKIE_NAME}=false`),
  open: undefined,
})

const emits = defineEmits<{
  'update:open': [open: boolean]
}>()

const isMobile = useMediaQuery('(max-width: 768px)')
const openMobile = ref(false)

const open = useVModel(props, 'open', emits, {
  defaultValue: props.defaultOpen ?? false,
  passive: (props.open === undefined) as false,
}) as Ref<boolean>

function setOpen(value: boolean) {
  open.value = value // emits('update:open', value)

  // This sets the cookie to keep the sidebar state.
  document.cookie = `${SIDEBAR_COOKIE_NAME}=${open.value}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
}

function setOpenMobile(value: boolean) {
  openMobile.value = value
}

// Helper to toggle the sidebar.
function toggleSidebar() {
  return isMobile.value ? setOpenMobile(!openMobile.value) : setOpen(!open.value)
}

useEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    toggleSidebar()
  }
})

// We add a state so that we can do data-state="expanded" or "collapsed".
// This makes it easier to style the sidebar with Tailwind classes.
const state = computed(() => open.value ? 'expanded' : 'collapsed')

// Drag-adjustable desktop width, persisted across reloads.
const width = useLocalStorage(SIDEBAR_WIDTH_STORAGE_KEY, SIDEBAR_WIDTH_DEFAULT, {
  listenToStorageChanges: false,
})
const savedWidth = Number(width.value)
width.value = Number.isFinite(savedWidth) ? clampSidebarWidth(savedWidth) : SIDEBAR_WIDTH_DEFAULT

function setWidth(value: number) {
  width.value = clampSidebarWidth(value)
}

const isResizing = ref(false)

function setResizing(value: boolean) {
  isResizing.value = value
}

provideSidebarContext({
  state,
  open,
  setOpen,
  isMobile,
  openMobile,
  setOpenMobile,
  toggleSidebar,
  width,
  setWidth,
  isResizing,
  setResizing,
})
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <div
      data-slot="sidebar-wrapper"
      :style="{
        '--sidebar-width': `${width}px`,
        '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
      }"
      :data-resizing="isResizing || undefined"
      :class="cn('group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full data-resizing:cursor-col-resize data-resizing:select-none', props.class)"
      v-bind="$attrs"
    >
      <slot />
    </div>
  </TooltipProvider>
</template>
