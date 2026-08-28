<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="flex min-h-full flex-col gap-6">
    <AppPageHeader :title="t('providers.title')">
      <UButton icon="i-lucide-plus" size="sm">{{ t('providers.add') }}</UButton>
    </AppPageHeader>
    <AppEmpty icon="i-lucide-server" :text="t('providers.empty')" />
  </div>
</template>
