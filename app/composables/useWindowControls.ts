import {getCurrentWindow} from '@tauri-apps/api/window'
import {isDesktop} from '~/utils/tauri'

const win = isDesktop ? getCurrentWindow() : null
const maximized = ref(false)
let initialized = false

async function refreshMaximized() {
  if (!win)
    return
  try {
    maximized.value = await win.isMaximized()
  } catch {
    maximized.value = false
  }
}

function minimize() {
  win?.minimize().catch(() => {
  })
}

function toggleMaximize() {
  win?.toggleMaximize().catch(() => {
  })
}

function close() {
  win?.close().catch(() => {
  })
}

function initListener() {
  if (!win || initialized)
    return
  initialized = true

  refreshMaximized()
  win.onResized(refreshMaximized).catch(() => {
  })
}

export function useWindowControls() {
  if (import.meta.client) {
    initListener()
  }

  return {
    isDesktop,
    maximized: readonly(maximized),
    refreshMaximized,
    minimize,
    toggleMaximize,
    close,
  }
}
