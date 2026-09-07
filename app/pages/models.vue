<script setup lang="ts">
const {t} = useI18n()
</script>

<template>
  <UDashboardPanel class="min-h-0" :ui="{ body: 'p-0 sm:p-0 gap-0 sm:gap-0' }">
    <template #header>
      <AppNavbar>
        <template #right>
          <UButton icon="i-lucide-plus">{{ t('virtualModels.add') }}</UButton>
        </template>
      </AppNavbar>
    </template>

    <template #body>
      <div class="flex min-h-full items-center justify-center p-4">
        <UEmpty
          :title="t('common.empty')"
          :description="t('virtualModels.emptyDesc')"
          variant="naked"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
