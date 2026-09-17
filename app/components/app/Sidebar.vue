<script setup lang="ts">
import type {NavigationMenuItem} from '@nuxt/ui'
import {useMediaQuery} from '@vueuse/core'

const emit = defineEmits<{ openSettings: [] }>()

const {t} = useI18n()
const {mainNav, searchGroups} = useNavigation()

// 底部固定项：设置（动作型入口，非路由，由外层弹窗承接）
const footerNav = computed<NavigationMenuItem[]>(() => [
  {
    label: t('nav.settings'),
    icon: 'i-lucide-settings',
    onSelect: () => {
      emit('openSettings')
    }
  }
])

const collapsed = ref(false)

// 响应式屏幕适配
const isSmallScreen = useMediaQuery('(max-width: 1023px)')
watch(isSmallScreen, (matches) => {
  collapsed.value = matches
}, { immediate: true })

// 侧栏折叠快捷键：Cmd/Ctrl + B（与主流编辑器切换侧栏的惯例一致，meta 在非 macOS 自动映射为 Ctrl）
defineShortcuts({
  meta_b: () => {
    collapsed.value = !collapsed.value
  }
})
</script>

<template>
  <!-- 侧边导航栏：导航数据源自 useNavigation（路由表见 app/utils/navigation.ts），此处仅负责渲染 -->
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
    :ui="{ root: 'flex', header: 'h-auto px-2.5 pt-2 pb-1', body: 'px-2.5 py-1', footer: 'px-2.5 pt-1 pb-2' }"
    class="min-h-0 bg-elevated/25"
  >
    <!-- 侧栏顶部：全局搜索入口（折叠态：仅图标 + 悬停 tooltip） -->
    <!-- trailing 覆盖默认 hidden lg:flex：展示"图标+文字"时 kbd 常驻（不随窗口宽度消失），仅图标折叠态隐藏 -->
    <template #header="{ collapsed: isCollapsed }">
      <UDashboardSearchButton
        :collapsed="isCollapsed"
        :tooltip="isCollapsed"
        :label="t('search.label')"
        variant="ghost"
        class="w-full"
        :ui="{
          base: 'px-2 py-2',
          leadingIcon: 'size-5',
          trailing: isCollapsed ? 'hidden' : 'flex'
        }"
      />
    </template>

    <template #default="{ collapsed: isCollapsed }">
      <UNavigationMenu
        :collapsed="isCollapsed"
        :tooltip="isCollapsed"
        :items="mainNav"
        orientation="vertical"
        class="flex-1"
        :ui="{ link: 'px-2 py-2' }"
      />
    </template>

    <template #footer="{ collapsed: isCollapsed }">
      <UNavigationMenu
        :collapsed="isCollapsed"
        :tooltip="isCollapsed"
        :items="footerNav"
        orientation="vertical"
        class="flex-1"
        :ui="{ link: 'px-2 py-2' }"
      />
    </template>
  </UDashboardSidebar>

  <!-- 全局搜索面板：分组数据派生自主导航 -->
  <UDashboardSearch :groups="searchGroups" :placeholder="t('search.placeholder')"/>
</template>
