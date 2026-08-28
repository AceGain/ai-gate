<script setup lang="ts">
import type {NavigationMenuItem} from '@nuxt/ui'

const {t} = useI18n()

// 标准 Nuxt UI 二维导航分组（主要路由分组 + 底部设置分组）
const navGroups = computed<NavigationMenuItem[][]>(() => [
  [
    {
      label: t('nav.dashboard'),
      icon: 'i-lucide-layout-dashboard',
      to: '/'
    },
    {
      label: t('nav.endpoints'),
      icon: 'i-lucide-network',
      to: '/endpoints'
    },
    {
      label: t('nav.providers'),
      icon: 'i-lucide-server',
      to: '/providers'
    },
    {
      label: t('nav.virtualModels'),
      icon: 'i-lucide-layers',
      to: '/models'
    }
  ],
  [
    {
      label: t('nav.settings'),
      icon: 'i-lucide-settings',
      to: '/settings'
    }
  ]
])
</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden bg-default">
    <!-- 顶部窗口标题栏 / 拖拽区域 (h-10) -->
    <AppTitlebar/>

    <!-- 下方主工作区：自适应占据视口剩余高度 -->
    <div class="flex min-h-0 flex-1 overflow-hidden">
      <!-- Nuxt UI 标准侧边栏组件 USidebar -->
      <USidebar
        collapsible="none"
        class="w-56 shrink-0 bg-elevated/25"
        :ui="{
          root: 'h-full border-e border-default flex flex-col',
          gap: 'hidden',
          container: 'static inset-auto z-auto flex h-full w-full border-0',
          inner: 'size-full divide-y-0',
          header: 'hidden',
          body: 'flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3',
          footer: 'p-3 border-t border-default/50 shrink-0'
        }"
      >
        <!-- 主导航菜单项 -->
        <template #default>
          <UNavigationMenu
            :items="navGroups[0]"
            orientation="vertical"
            class="w-full flex-1"
            :ui="{
              link: 'py-2 px-2.5 rounded-md font-medium text-sm',
              linkLeadingIcon: 'size-4.5 shrink-0'
            }"
          />
        </template>

        <!-- 底部设置项 -->
        <template #footer>
          <UNavigationMenu
            :items="navGroups[1]"
            orientation="vertical"
            class="w-full"
            :ui="{
              link: 'py-2 px-2.5 rounded-md font-medium text-sm',
              linkLeadingIcon: 'size-4.5 shrink-0'
            }"
          />
        </template>
      </USidebar>

      <!-- Nuxt UI 标准主内容区组件 UMain -->
      <UMain
        class="flex min-w-0 flex-1 flex-col overflow-y-auto"
        :ui="{ base: 'min-h-0' }"
      >
        <!-- Nuxt UI 标准容器组件 UContainer -->
        <UContainer class="mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 sm:px-6 lg:px-8 py-6">
          <slot/>
        </UContainer>
      </UMain>
    </div>
  </div>
</template>
