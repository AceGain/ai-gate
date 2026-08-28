<script setup lang="ts">
const {t} = useI18n()
</script>

<template>
  <div class="flex min-h-full flex-col gap-6">
    <AppPageHeader :title="t('endpoints.title')">
      <UButton icon="i-lucide-plus" size="sm">{{ t('endpoints.add') }}</UButton>
    </AppPageHeader>
    <UEmpty
      icon="i-lucide-network"
      :title="t('endpoints.empty')"
      variant="naked"
      class="flex-1"
    />
  </div>
</template>
