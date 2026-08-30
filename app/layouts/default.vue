<script setup lang="ts">
import type {CommandPaletteGroup, CommandPaletteItem, NavigationMenuItem} from '@nuxt/ui'

const {t} = useI18n()
const route = useRoute()

const settingsOpen = ref(false)

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

const searchGroups = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => [
  {
    id: 'links',
    label: t('nav.goTo'),
    items: navGroups.value[0]?.map(item => ({
      label: item.label,
      icon: item.icon,
      to: item.to
    }))
  }
])

const pageTitle = computed(() => {
  switch (route.name) {
    case 'endpoints':
      return t('endpoints.title')
    case 'providers':
      return t('providers.title')
    case 'models':
      return t('virtualModels.title')
    case 'index':
      return t('dashboard.title')
    default:
      return ''
  }
})

const collapsed = ref(false)

// 侧栏折叠快捷键：Cmd/Ctrl + B（与主流编辑器切换侧栏的惯例一致，meta 在非 macOS 自动映射为 Ctrl）
defineShortcuts({
  meta_b: () => {
    collapsed.value = !collapsed.value
  }
})

onMounted(() => {
  const mq = window.matchMedia('(max-width: 1023px)')
  const update = () => {
    collapsed.value = mq.matches
  }
  update()
  mq.addEventListener('change', update)
  onBeforeUnmount(() => mq.removeEventListener('change', update))
})
</script>

<template>
  <!-- Nuxt UI Dashboard 布局根容器：填充 UMain（标题栏以下）的剩余高度，左=侧边导航栏，右=内容区域 -->
  <!-- 覆盖默认 fixed inset-0：标题栏已上移至 app.vue 的 UHeader，不再占据视口 -->
  <UDashboardGroup
    unit="rem"
    storage-key="ai-gate"
    class="relative size-full overflow-hidden"
  >
    <UDashboardSidebar
      id="nav"
      v-model:collapsed="collapsed"
      resizable
      collapsible
      :min-size="12"
      :default-size="14"
      :max-size="20"
      :collapsed-size="4"
      :toggle="false"
      :ui="{ root: 'flex' }"
      class="min-h-0 bg-elevated/25"
    >
      <!-- 侧栏顶部：全局搜索入口（折叠态：仅图标 + 悬停 tooltip） -->
      <template #header="{ collapsed: isCollapsed }">
        <UDashboardSearchButton
          :collapsed="isCollapsed"
          :tooltip="isCollapsed"
          :label="t('search.label')"
        />
      </template>

      <template #default="{ collapsed: isCollapsed }">
        <UNavigationMenu
          :collapsed="isCollapsed"
          :tooltip="isCollapsed"
          :items="navGroups[0]"
          orientation="vertical"
          class="flex-1"
        />
      </template>

      <template #footer="{ collapsed: isCollapsed }">
        <UNavigationMenu
          :collapsed="isCollapsed"
          :tooltip="isCollapsed"
          :items="navGroups[1]"
          orientation="vertical"
          class="flex-1"
        />
      </template>
    </UDashboardSidebar>

    <UDashboardPanel class="min-h-0" :ui="{ body: 'p-0' }">
      <!-- 内容区头部：侧栏折叠按钮 + 页面标题 + 页面操作（"新建xxx"按钮 Teleport 至此，同一行展示） -->
      <template #header>
        <UDashboardNavbar :title="pageTitle" :toggle="false">
          <template #leading>
            <UDashboardSidebarCollapse/>
          </template>

          <template #right>
            <div id="navbar-actions" class="flex items-center gap-2"/>
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <UContainer class="flex min-h-full max-w-6xl flex-col py-6">
          <slot/>
        </UContainer>
      </template>
    </UDashboardPanel>

    <UDashboardSearch :groups="searchGroups" :placeholder="t('search.placeholder')"/>

    <AppSettingsModal v-model:open="settingsOpen"/>
  </UDashboardGroup>
</template>
