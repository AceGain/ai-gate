<script setup lang="ts">
import {getCurrentWindow} from '@tauri-apps/api/window'
import {isDesktop} from '~/utils/tauri'

const win = getCurrentWindow()
const maximized = ref(false)

async function refreshMaximized() {
  try {
    maximized.value = await win.isMaximized()
  }
  catch {
    maximized.value = false
  }
}

function minimize() {
  win.minimize().catch(() => {})
}

function toggleMaximize() {
  win.toggleMaximize().catch(() => {})
}

function close() {
  win.close().catch(() => {})
}

onMounted(() => {
  if (!isDesktop)
    return
  refreshMaximized()
  win.onResized(refreshMaximized).catch(() => {})
})
</script>

<template>
  <header
    data-tauri-drag-region
    class="flex h-10 shrink-0 select-none items-center border-b border-default bg-elevated/50"
  >
    <div data-tauri-drag-region class="flex items-center gap-2 px-3">
      <img src="/ai-gate-symbol.png" alt="AI Gate" class="size-5 shrink-0" >
      <span data-tauri-drag-region class="text-sm font-semibold text-highlighted">AI Gate</span>
      <span data-tauri-drag-region class="text-[10px] text-dimmed">v0.1.0</span>
    </div>

    <div data-tauri-drag-region class="h-full flex-1" />

    <div class="flex h-full items-center px-2">
      <UColorModeButton size="xs" color="neutral" variant="ghost" />
    </div>

    <div v-if="isDesktop" class="flex h-full items-stretch">
      <button
        type="button"
        aria-label="最小化"
        class="flex w-11 items-center justify-center text-muted transition-colors hover:bg-elevated hover:text-default"
        @click="minimize"
      >
        <UIcon name="i-lucide-minus" class="size-4" />
      </button>
      <button
        type="button"
        aria-label="最大化"
        class="flex w-11 items-center justify-center text-muted transition-colors hover:bg-elevated hover:text-default"
        @click="toggleMaximize"
      >
        <UIcon :name="maximized ? 'i-lucide-copy' : 'i-lucide-square'" class="size-3.5" />
      </button>
      <button
        type="button"
        aria-label="关闭"
        class="flex w-11 items-center justify-center text-muted transition-colors hover:bg-error hover:text-inverted"
        @click="close"
      >
        <UIcon name="i-lucide-x" class="size-4" />
      </button>
    </div>
  </header>
</template>
