import type { ComputedRef, Ref } from 'vue'
import { createContext } from 'reka-ui'

export const SIDEBAR_COOKIE_NAME = 'sidebar_state'
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
export const SIDEBAR_WIDTH_MOBILE = '18rem'
export const SIDEBAR_WIDTH_ICON = '3rem'
export const SIDEBAR_KEYBOARD_SHORTCUT = 'b'

// Desktop sidebar width is drag-adjustable (via SidebarRail), in pixels.
export const SIDEBAR_WIDTH_DEFAULT = 224
export const SIDEBAR_WIDTH_MIN = 192
export const SIDEBAR_WIDTH_MAX = 256
export const SIDEBAR_WIDTH_STORAGE_KEY = 'sidebar_width'

export function clampSidebarWidth(value: number) {
  return Math.round(Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, value)))
}

export const [useSidebar, provideSidebarContext] = createContext<{
  state: ComputedRef<'expanded' | 'collapsed'>
  open: Ref<boolean>
  setOpen: (value: boolean) => void
  isMobile: Ref<boolean>
  openMobile: Ref<boolean>
  setOpenMobile: (value: boolean) => void
  toggleSidebar: () => void
  width: Ref<number>
  setWidth: (value: number) => void
  isResizing: Ref<boolean>
  setResizing: (value: boolean) => void
}>('Sidebar')
