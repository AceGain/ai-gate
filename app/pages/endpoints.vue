<script setup lang="ts">
const {t} = useI18n()
</script>

<template>
  <UDashboardPanel class="min-h-0" :ui="{ body: 'p-0' }">
    <template #header>
      <AppNavbar>
        <template #right>
          <UButton icon="i-lucide-plus" size="xs">{{ t('endpoints.add') }}</UButton>
        </template>
      </AppNavbar>
    </template>

    <template #body>
      <div class="flex min-h-full items-center justify-center">
        <UEmpty :title="t('common.empty')" variant="naked"/>
      </div>
    </template>
  </UDashboardPanel>
</template>
