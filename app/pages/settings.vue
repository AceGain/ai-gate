<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="flex min-h-full flex-col gap-6">
    <AppPageHeader :title="t('settings.title')" />
    <AppEmpty icon="i-lucide-settings" :text="t('settings.empty')" />
  </div>
</template>
