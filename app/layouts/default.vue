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
      <!-- 左侧固定侧边栏：稳定宽度，任意屏幕/桌面窗口分辨率下均正常呈现 -->
      <aside class="flex w-56 shrink-0 flex-col border-e border-default bg-elevated/25 p-3">
        <!-- 主导航菜单：占满可用空间并支持独立垂直滚动 -->
        <UNavigationMenu
          :items="navGroups[0]"
          orientation="vertical"
          class="w-full flex-1 overflow-y-auto"
          :ui="{
            link: 'py-2 px-2.5 rounded-md font-medium text-sm',
            linkLeadingIcon: 'size-4.5 shrink-0'
          }"
        />

        <!-- 底部菜单：分割线隔离并始终沉底 -->
        <div class="mt-auto shrink-0 border-t border-default/50 pt-2">
          <UNavigationMenu
            :items="navGroups[1]"
            orientation="vertical"
            class="w-full"
            :ui="{
              link: 'py-2 px-2.5 rounded-md font-medium text-sm',
              linkLeadingIcon: 'size-4.5 shrink-0'
            }"
          />
        </div>
      </aside>

      <!-- 右侧主内容展示区：独立滚动，内嵌 UContainer 居中并限制宽度 -->
      <main class="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <UContainer class="mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 sm:px-6 lg:px-8 py-6">
          <slot/>
        </UContainer>
      </main>
    </div>
  </div>
</template>
