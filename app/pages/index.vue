<script setup lang="ts">
const {t} = useI18n()
</script>

<template>
  <UDashboardPanel class="min-h-0" :ui="{ body: 'p-0' }">
    <template #header>
      <AppNavbar/>
    </template>

    <template #body>
      <div class="flex min-h-full items-center justify-center">
        <UEmpty icon="i-lucide-layout-dashboard" :title="t('dashboard.empty')" variant="naked"/>
      </div>
    </template>
  </UDashboardPanel>
</template>
