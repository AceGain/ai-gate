<script setup lang="ts">
const {t} = useI18n()
const {isDesktop, maximized, minimize, toggleMaximize, close} = useWindowControls()
</script>

<template>
  <header
    data-tauri-drag-region
    class="relative z-30 flex h-10 shrink-0 select-none items-center border-b border-default bg-elevated/50"
  >
    <div data-tauri-drag-region class="flex items-center gap-2 px-3">
      <img src="/ai-gate-symbol.png" alt="AI Gate" class="size-5 shrink-0">
      <span data-tauri-drag-region class="text-sm font-semibold text-highlighted">AI Gate</span>
      <span data-tauri-drag-region class="text-[10px] text-dimmed">v0.1.0</span>
    </div>

    <div data-tauri-drag-region class="h-full flex-1"/>

    <div class="flex h-full items-center px-2">
      <UColorModeButton size="xs" color="neutral" variant="ghost"/>
    </div>

    <div v-if="isDesktop" class="flex h-full items-stretch">
      <!-- 窗口控制按钮：UButton 提供统一的 focus-visible 键盘可达性，ui.base 覆盖为标题栏全高无圆角样式 -->
      <UButton
        icon="i-lucide-minus"
        :aria-label="t('titlebar.minimize')"
        color="neutral"
        variant="ghost"
        size="xs"
        :ui="{ base: 'h-full w-11 justify-center rounded-none text-muted' }"
        @click="minimize"
      />
      <UButton
        :icon="maximized ? 'i-lucide-copy' : 'i-lucide-square'"
        :aria-label="t('titlebar.maximize')"
        color="neutral"
        variant="ghost"
        size="xs"
        :ui="{ base: 'h-full w-11 justify-center rounded-none text-muted', leadingIcon: 'size-3.5' }"
        @click="toggleMaximize"
      />
      <UButton
        icon="i-lucide-x"
        :aria-label="t('titlebar.close')"
        color="error"
        variant="ghost"
        size="xs"
        :ui="{ base: 'h-full w-11 justify-center rounded-none text-muted hover:bg-error hover:text-inverted' }"
        @click="close"
      />
    </div>
  </header>
</template>
