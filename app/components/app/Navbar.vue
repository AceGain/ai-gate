<script setup lang="ts">
import {navRoutes} from '~/utils/navigation'

const props = defineProps<{
  title?: string
}>()

const {t} = useI18n()
const route = useRoute()

// 页面标题：优先使用传入的 title，否则从导航配置单一数据源中获取
const pageTitle = computed(() => {
  if (props.title) return props.title
  const matched = navRoutes.find(r => r.to === route.path)
  if (matched) return t(matched.labelKey)
  if (route.path.startsWith('/providers/')) {
    return t('providers.configTitle')
  }
  return ''
})
</script>

<template>
  <!-- 内容区头部：侧栏折叠按钮 + 页面标题 + 页面操作（"新建xxx"按钮经由 #right 插槽注入，同一行展示） -->
  <!-- 独立高度 4rem：与窗口标题栏（2rem）解耦；更高的工具栏，内容区呼吸感更好 -->
  <UDashboardNavbar
    :title="pageTitle"
    :toggle="false"
    :ui="{
      root: 'h-14 px-4 sm:px-4',
      title: 'text-base font-semibold text-highlighted'
    }"
  >
    <template #leading>
      <!-- 覆盖默认 hidden lg:flex：侧边栏已强制全宽度可见（:ui root 'flex'），折叠按钮作为配套控制应随之始终显示 -->
      <UDashboardSidebarCollapse :ui="{ base: 'flex' }"/>
      <slot name="leading"/>
    </template>

    <template #title>
      <slot name="title">
        {{ pageTitle }}
      </slot>
    </template>

    <template #right>
      <slot name="right"/>
    </template>
  </UDashboardNavbar>
</template>
