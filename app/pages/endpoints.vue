<script setup lang="ts">
const {t} = useI18n()
</script>

<template>
  <div class="flex min-h-full flex-col gap-6">
    <AppPageHeader :title="t('endpoints.title')">
      <UButton icon="i-lucide-plus" size="sm">{{ t('endpoints.add') }}</UButton>
    </AppPageHeader>
    <AppEmpty icon="i-carbon-gateway-api" :text="t('endpoints.empty')"/>
  </div>
</template>
