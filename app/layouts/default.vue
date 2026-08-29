<script setup lang="ts">
import type {NavigationMenuItem} from '@nuxt/ui'

const {t} = useI18n()

// 设置弹窗开关（侧边栏"设置"项触发）
const settingsOpen = ref(false)

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
      onSelect: () => {
        settingsOpen.value = true
      }
    }
  ]
])

// 窄窗口（< lg 1024px，与 Tailwind lg 断点对齐）侧栏自动切换为纯图标模式
// 初值与 SSR 保持一致（false），mounted 后再修正，避免 hydration 不一致
const isCompact = ref(false)

onMounted(() => {
  // matchMedia 断点监听：仅在跨越 1024px 时触发一次，而非 resize 的逐像素回调
  // 与侧栏 max-lg:w-16 / 把手 max-lg:hidden 使用同一断点，保证视觉状态同步
  const mq = window.matchMedia('(max-width: 1023px)')
  const update = () => {
    isCompact.value = mq.matches
  }
  update()
  mq.addEventListener('change', update)
  // onMounted 内注册的清理函数由 Nuxt 自动收集，无需外层 onBeforeUnmount
  onBeforeUnmount(() => mq.removeEventListener('change', update))
})
</script>

<template>
  <!-- Nuxt UI Dashboard 布局根容器：默认 fixed inset-0 全屏，flex-col 使标题栏横跨顶部 -->
  <UDashboardGroup
    unit="rem"
    storage-key="ai-gate"
    class="flex-col"
  >
    <!-- 顶部窗口标题栏 / 拖拽区域 (h-10)，置于 Group 内以访问侧边栏上下文 -->
    <AppTitlebar/>

    <!-- 主工作区：占据标题栏以下的剩余高度 -->
    <div class="flex min-h-0 flex-1">
      <!-- Nuxt UI 标准侧边栏：常驻 / 可拖宽，宽度由 Group 持久化 -->
      <!-- ui.root 覆盖默认 hidden lg:flex（<lg 隐藏并转抽屉）：禁用抽屉模式，全宽度常驻显示 -->
      <!-- max-lg:w-16：窄窗口固定为 4rem 图标栏（与 min-w-16 一致），拖宽把手随之隐藏 -->
      <!-- id 由 main 改为 nav：更换 storage key，丢弃旧缓存中残留的 collapsed 状态（collapsible 已移除，残留会导致侧栏锁死在图标栏） -->
      <UDashboardSidebar
        id="nav"
        resizable
        :min-size="12"
        :default-size="14"
        :max-size="20"
        :toggle="false"
        :ui="{ root: 'flex max-lg:w-16', handle: 'max-lg:hidden' }"
        class="min-h-0 bg-elevated/25"
      >
        <!-- 主导航菜单项（窄窗口 collapsed：仅图标 + 悬停 tooltip） -->
        <template #default>
          <UNavigationMenu
            :collapsed="isCompact"
            :tooltip="isCompact"
            :items="navGroups[0]"
            orientation="vertical"
            class="flex-1"
          />
        </template>

        <!-- 底部设置项 -->
        <template #footer>
          <UNavigationMenu
            :collapsed="isCompact"
            :tooltip="isCompact"
            :items="navGroups[1]"
            orientation="vertical"
            class="flex-1"
          />
        </template>
      </UDashboardSidebar>

      <!-- 主内容区：Panel body 提供纵向滚动，内边距交由 UContainer 统一控制 -->
      <UDashboardPanel class="min-h-0" :ui="{ body: 'p-0' }">
        <template #body>
          <UContainer class="flex min-h-full max-w-6xl flex-col py-6">
            <slot/>
          </UContainer>
        </template>
      </UDashboardPanel>
    </div>

    <!-- 设置弹窗（侧边栏底部"设置"项触发） -->
    <AppSettingsModal v-model:open="settingsOpen"/>
  </UDashboardGroup>
</template>
