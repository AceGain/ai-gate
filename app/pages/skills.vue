<script setup lang="ts">
const {t} = useI18n()
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppNavbar>
        <template #right>
          <UButton icon="i-lucide-plus" variant="ghost">{{ t('skills.add') }}</UButton>
        </template>
      </AppNavbar>
    </template>

    <template #body>
      <div class="h-full overflow-y-auto p-4">
        <div class="flex min-h-full items-center justify-center">
          <UEmpty
            :title="t('common.empty')"
            variant="naked"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
