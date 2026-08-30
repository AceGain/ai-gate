<script setup lang="ts">
const {t} = useI18n()
</script>

<template>
  <UDashboardPanel class="min-h-0" :ui="{ body: 'p-0' }">
    <template #header>
      <AppNavbar>
        <template #right>
          <UButton icon="i-lucide-plus" size="xs">{{ t('providers.add') }}</UButton>
        </template>
      </AppNavbar>
    </template>

    <template #body>
      <UContainer class="flex min-h-full max-w-6xl flex-col py-6">
        <UEmpty
          icon="i-lucide-server"
          :title="t('providers.empty')"
          variant="naked"
          class="flex-1"
        />
      </UContainer>
    </template>
  </UDashboardPanel>
</template>
