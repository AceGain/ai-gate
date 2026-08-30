<script setup lang="ts">
const settingsOpen = ref(false)
</script>

<template>
  <!-- Nuxt UI Dashboard 布局根容器：填充 UMain（标题栏以下）的剩余高度，左=侧边导航栏，右=内容区域 -->
  <!-- 覆盖默认 fixed inset-0：标题栏已上移至 app.vue 的 UHeader，不再占据视口 -->
  <UDashboardGroup
    unit="rem"
    storage-key="ai-gate"
    class="relative size-full overflow-hidden"
  >
    <!-- 侧边导航栏：导航路由表、搜索、折叠状态均已封装在 AppSidebar -->
    <AppSidebar @open-settings="settingsOpen = true"/>

    <!-- 内容区：各页面自带 UDashboardPanel（header = AppNavbar，body = 页面内容） -->
    <slot/>

    <AppSettingsModal v-model:open="settingsOpen"/>
  </UDashboardGroup>
</template>
