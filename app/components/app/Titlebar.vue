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
      <span data-tauri-drag-region class="text-[10px] text-dimmed">v{{ version }}</span>
    </div>

    <!-- 窗口控制按钮：还原系统标题栏控件观感——贴住窗口右缘、占满标题栏高度、无圆角 -->
    <!-- 配色对齐 Windows 11 原生标题栏：hover 为半透明黑白罩层（亮色 5% 黑 / 暗色 10% 白），关闭键为系统深红 #C42B1C -->
    <!-- -me-2 抵消 UHeader 容器的 px-2 内边距，使按钮贴住窗口右缘 -->
    <div v-if="isDesktop" class="-me-2 flex h-full items-stretch">
      <button
        type="button"
        :aria-label="t('titlebar.minimize')"
        class="flex h-full w-11 items-center justify-center rounded-none text-highlighted transition-colors hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/20 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        @click="minimize"
      >
        <UIcon name="i-lucide-minus" class="size-3.5"/>
      </button>
      <button
        type="button"
        :aria-label="t('titlebar.maximize')"
        class="flex h-full w-11 items-center justify-center rounded-none text-highlighted transition-colors hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/20 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        @click="toggleMaximize"
      >
        <UIcon :name="maximized ? 'i-lucide-copy' : 'i-lucide-square'" class="size-3"/>
      </button>
      <button
        type="button"
        :aria-label="t('titlebar.close')"
        class="flex h-full w-11 items-center justify-center rounded-none text-highlighted transition-colors hover:bg-[#c42b1c] hover:text-white active:bg-[#b3271b] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-inverted"
        @click="close"
      >
        <UIcon name="i-lucide-x" class="size-4"/>
      </button>
    </div>
  </div>
</template>
