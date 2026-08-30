<script setup lang="ts">
const {t} = useI18n()
const route = useRoute()

// 页面标题：按路由名映射 i18n 文案（从 layouts/default.vue 迁移至此）
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
</script>

<template>
  <!-- 内容区头部：侧栏折叠按钮 + 页面标题 + 页面操作（"新建xxx"按钮经由 #right 插槽注入，同一行展示） -->
  <!-- 独立高度 3.5rem：与窗口标题栏（2rem）解耦；px-4 + text-sm 标题，紧凑桌面工具栏观感 -->
  <UDashboardNavbar
    :title="pageTitle"
    :toggle="false"
    :ui="{
      root: 'h-12 px-4 sm:px-4',
      title: 'text-base font-semibold text-highlighted'
    }"
  >
    <template #leading>
      <!-- 覆盖默认 hidden lg:flex：侧边栏已强制全宽度可见（:ui root 'flex'），折叠按钮作为配套控制应随之始终显示 -->
      <UDashboardSidebarCollapse :ui="{ base: 'flex' }"/>
    </template>

    <template #right>
      <slot name="right"/>
    </template>
  </UDashboardNavbar>
</template>
