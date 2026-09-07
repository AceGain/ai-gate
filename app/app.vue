<script setup lang="ts">
import {en, zh_cn} from '@nuxt/ui/locale'

const {locale} = useI18n()

// Nuxt UI 组件内置文案（搜索面板主题组、折叠按钮 tooltip 等）需显式注入对应 locale，否则回退英文
const uiLocales = {
  'zh-CN': zh_cn,
  'en-US': en
}

const appConfig = useAppConfig()
if (import.meta.client) {
  const savedPrimary = localStorage.getItem('ai-gate-primary-color')
  if (savedPrimary) {
    try {
      appConfig.ui.colors.primary = JSON.parse(savedPrimary)
    } catch {
      appConfig.ui.colors.primary = savedPrimary
    }
  }
  const savedNeutral = localStorage.getItem('ai-gate-neutral-color')
  if (savedNeutral) {
    try {
      appConfig.ui.colors.neutral = JSON.parse(savedNeutral)
    } catch {
      appConfig.ui.colors.neutral = savedNeutral
    }
  }
}

useHead({
  meta: [
    {name: 'viewport', content: 'width=device-width, initial-scale=1'}
  ],
  htmlAttrs: {
    lang: locale
  }
})

useSeoMeta({
  title: 'ai-gate'
})
</script>

<template>
  <UApp :locale="uiLocales[locale as keyof typeof uiLocales] ?? zh_cn">
    <NuxtLoadingIndicator/>

    <!-- 顶部窗口标题栏（代替系统标题栏）：品牌 + 颜色模式 + 窗口控制 -->
    <!-- 覆盖默认容器/分区样式：标题栏需横跨整个窗口宽度，而非居中限宽的内容区布局 -->
    <UHeader
      data-tauri-drag-region
      :toggle="false"
      :ui="{
        root: 'bg-elevated backdrop-blur-none',
        container: 'max-w-none mx-0 px-2 sm:px-2 lg:px-2',
        left: 'hidden',
        center: 'flex flex-1 h-full',
        right: 'hidden'
      }"
    >
      <AppTitlebar/>
    </UHeader>

    <UMain class="h-[calc(100vh-var(--ui-header-height))] overflow-hidden">
      <NuxtLayout>
        <NuxtPage/>
      </NuxtLayout>
    </UMain>
  </UApp>
</template>
