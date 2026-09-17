<script setup lang="ts">
import {version} from '~~/package.json'

const {t} = useI18n()
const {isDesktop, maximized, minimize, toggleMaximize, close} = useWindowControls()
</script>

<template>
  <!-- 窗口标题栏内容 / 拖拽区域（横跨窗口顶部，代替系统标题栏）：外壳由 app.vue 中的 UHeader 提供 -->
  <!-- 根元素与品牌为拖拽区域；窗口控制等交互元素不带 drag region -->
  <div data-tauri-drag-region class="flex h-full w-full items-center justify-between">
    <!-- 应用品牌（整体可拖拽） -->
    <div data-tauri-drag-region class="flex items-center gap-2">
      <img data-tauri-drag-region src="/ai-gate-symbol.png" alt="AI Gate" class="size-5 shrink-0">
      <span data-tauri-drag-region class="text-sm font-semibold text-highlighted">AI Gate</span>
      <span data-tauri-drag-region class="text-xs text-dimmed">v{{ version }}</span>
    </div>

    <!-- 窗口控制按钮：还原系统标题栏控件观感——贴住窗口右缘、占满标题栏高度、无圆角 -->
    <!-- 配色对齐 Windows 11 原生标题栏，具象色集中为 --ui-titlebar-* Token（docs/DESIGN.md §1.3） -->
    <!-- -me-2 抵消 UHeader 容器的 px-2 内边距，使按钮贴住窗口右缘 -->
    <div v-if="isDesktop" class="-me-2 flex h-full items-stretch">
      <UButton
        variant="ghost"
        color="neutral"
        :aria-label="t('titlebar.minimize')"
        class="h-full w-11 justify-center text-highlighted transition-colors hover:bg-(--ui-titlebar-control-hover) active:bg-(--ui-titlebar-control-active)"
        @click="minimize"
      >
        <UIcon name="i-lucide-minus" class="size-3.5" />
      </UButton>
      <UButton
        variant="ghost"
        color="neutral"
        :aria-label="t('titlebar.maximize')"
        class="h-full w-11 justify-center text-highlighted transition-colors hover:bg-(--ui-titlebar-control-hover) active:bg-(--ui-titlebar-control-active)"
        @click="toggleMaximize"
      >
        <UIcon :name="maximized ? 'i-lucide-copy' : 'i-lucide-square'" class="size-3.5" />
      </UButton>
      <UButton
        variant="ghost"
        color="neutral"
        :aria-label="t('titlebar.close')"
        class="h-full w-11 justify-center text-highlighted transition-colors hover:bg-(--ui-titlebar-close-hover) hover:text-(--ui-titlebar-close-foreground) active:bg-(--ui-titlebar-close-active)"
        @click="close"
      >
        <UIcon name="i-lucide-x" class="size-3.5" />
      </UButton>
    </div>
  </div>
</template>
