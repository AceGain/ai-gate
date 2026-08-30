<script setup lang="ts">
const {t} = useI18n()
</script>

<template>
  <UDashboardPanel class="min-h-0" :ui="{ body: 'p-0' }">
    <template #header>
      <AppNavbar/>
    </template>

    <template #body>
      <UContainer class="flex min-h-full max-w-6xl flex-col py-6">
        <div class="grid grid-cols-4 gap-4">
          <AppStatCard :label="t('dashboard.statProviders')" value="—" icon="i-lucide-server"/>
          <AppStatCard :label="t('dashboard.statVirtualModels')" value="—" icon="i-lucide-layers"/>
          <AppStatCard :label="t('dashboard.statTodayRequests')" value="—" icon="i-lucide-activity"/>
          <AppStatCard :label="t('dashboard.statTodayTokens')" value="—" icon="i-lucide-coins"/>
        </div>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>
