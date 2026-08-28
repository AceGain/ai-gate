<script setup lang="ts">
const { t, locale, setLocale } = useI18n()

const localeItems = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English (US)', value: 'en-US' }
]

const localeModel = computed({
  get: () => locale.value,
  set: (value: 'zh-CN' | 'en-US') => setLocale(value)
})
</script>

<template>
  <div class="flex min-h-full flex-col gap-6">
    <AppPageHeader :title="t('settings.title')" />

    <UCard class="max-w-xl">
      <div class="flex flex-col divide-y divide-default">
        <div class="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
          <div>
            <p class="text-sm font-medium text-highlighted">{{ t('settings.appearance') }}</p>
            <p class="mt-0.5 text-xs text-dimmed">{{ t('settings.appearanceDesc') }}</p>
          </div>
          <UColorModeSelect class="w-40" />
        </div>

        <div class="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
          <div>
            <p class="text-sm font-medium text-highlighted">{{ t('settings.language') }}</p>
            <p class="mt-0.5 text-xs text-dimmed">{{ t('settings.languageDesc') }}</p>
          </div>
          <USelect v-model="localeModel" :items="localeItems" class="w-40" />
        </div>
      </div>
    </UCard>
  </div>
</template>
