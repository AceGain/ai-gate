<script setup lang="ts">
const {t} = useI18n()
</script>

<template>
  <div class="flex min-h-full flex-col gap-6">
    <AppPageHeader :title="t('virtualModels.title')">
      <UButton icon="i-lucide-plus" size="sm">{{ t('virtualModels.add') }}</UButton>
    </AppPageHeader>
    <AppEmpty icon="i-lucide-layers" :text="t('virtualModels.empty')"/>
  </div>
</template>
