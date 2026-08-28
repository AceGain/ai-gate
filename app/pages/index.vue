<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="flex min-h-full flex-col gap-6">
    <AppPageHeader :title="t('dashboard.title')" />

    <div class="grid grid-cols-4 gap-4">
      <AppStatCard :label="t('dashboard.statProviders')" value="—" icon="i-lucide-server" />
      <AppStatCard :label="t('dashboard.statVirtualModels')" value="—" icon="i-lucide-layers" />
      <AppStatCard :label="t('dashboard.statTodayRequests')" value="—" icon="i-lucide-activity" />
      <AppStatCard :label="t('dashboard.statTodayTokens')" value="—" icon="i-lucide-coins" />
    </div>
  </div>
</template>
