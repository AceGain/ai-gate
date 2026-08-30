<script setup lang="ts">
const {t} = useI18n()
const {isDesktop, maximized, minimize, toggleMaximize, close} = useWindowControls()
</script>

<template>
  <!-- 窗口标题栏内容 / 拖拽区域（横跨窗口顶部，代替系统标题栏）：外壳由 app.vue 中的 UHeader 提供 -->
  <!-- 根元素与品牌为拖拽区域；颜色模式 / 窗口控制等交互元素不带 drag region -->
  <div data-tauri-drag-region class="flex h-full w-full items-center justify-between">
    <!-- 应用品牌（整体可拖拽） -->
    <div data-tauri-drag-region class="flex items-center gap-2">
      <img data-tauri-drag-region src="/ai-gate-symbol.png" alt="AI Gate" class="size-5 shrink-0">
      <span data-tauri-drag-region class="text-sm font-semibold text-highlighted">AI Gate</span>
      <span data-tauri-drag-region class="text-[10px] text-dimmed">v0.1.0</span>
    </div>

    <!-- 颜色模式 + 窗口控制 -->
    <div class="flex h-full items-center">
      <UColorModeButton size="xs" color="neutral" variant="ghost" class="me-1.5"/>

      <!-- 窗口控制按钮：UButton 提供统一的 focus-visible 键盘可达性，ui.base 覆盖为标题栏全高无圆角样式 -->
      <!-- -me-2 抵消 UHeader 容器的 px-2 内边距，使按钮贴住窗口右缘 -->
      <div v-if="isDesktop" class="-me-2 flex h-full items-stretch">
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
    </div>
  </div>
</template>
