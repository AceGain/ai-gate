<script setup lang="ts">
const open = defineModel<boolean>('open', {default: false})

const {t, locale, setLocale} = useI18n()
const appConfig = useAppConfig()
const colorMode = useColorMode()

const appearanceItems = computed(() => [
  {value: 'system', icon: 'i-lucide-monitor', label: t('settings.appearanceSystem')},
  {value: 'light', icon: 'i-lucide-sun', label: t('settings.appearanceLight')},
  {value: 'dark', icon: 'i-lucide-moon', label: t('settings.appearanceDark')}
])

const localeItems = [
  {label: '简体中文', value: 'zh-CN'},
  {label: 'English (US)', value: 'en-US'}
]

const localeModel = computed({
  get: () => locale.value,
  set: (value: 'zh-CN' | 'en-US') => setLocale(value)
})

const primaryValues = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose']
const neutralValues = ['slate', 'gray', 'zinc', 'neutral', 'stone', 'taupe', 'mauve', 'mist', 'olive']

const primaryItems = computed(() => primaryValues.map(value => ({
  label: t(`settings.colors.${value}`),
  value,
  swatch: value
})))

const neutralItems = computed(() => neutralValues.map(value => ({
  label: t(`settings.colors.${value}`),
  value,
  swatch: value
})))

const primaryModel = computed({
  get: () => appConfig.ui.colors.primary,
  set: (value: string) => {
    appConfig.ui.colors.primary = value
  }
})

const neutralModel = computed({
  get: () => appConfig.ui.colors.neutral,
  set: (value: string) => {
    appConfig.ui.colors.neutral = value
  }
})
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('settings.title')"
    :ui="{content: 'max-w-xl'}"
  >
    <template #body>
      <div class="flex flex-col divide-y divide-default">
        <div class="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
          <div>
            <p class="text-sm font-medium text-highlighted">{{ t('settings.language') }}</p>
            <p class="mt-0.5 text-xs text-dimmed">{{ t('settings.languageDesc') }}</p>
          </div>
          <USelect v-model="localeModel" :items="localeItems" class="w-40"/>
        </div>

        <div class="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
          <div>
            <p class="text-sm font-medium text-highlighted">{{ t('settings.appearance') }}</p>
            <p class="mt-0.5 text-xs text-dimmed">{{ t('settings.appearanceDesc') }}</p>
          </div>
          <!-- 外观三态切换：UTabs pill 变体自带指示器动画与键盘导航，label 以 sr-only 保留可访问名称 -->
          <UTabs
            :items="appearanceItems"
            :model-value="colorMode.preference"
            :content="false"
            size="sm"
            :ui="{ list: 'w-40', label: 'sr-only' }"
            @update:model-value="(value: string | number) => colorMode.preference = String(value)"
          />
        </div>

        <div class="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
          <div>
            <p class="text-sm font-medium text-highlighted">{{ t('settings.theme') }}</p>
            <p class="mt-0.5 text-xs text-dimmed">{{ t('settings.themeDesc') }}</p>
          </div>
          <AppColorSelect v-model="primaryModel" :items="primaryItems"/>
        </div>

        <div class="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
          <div>
            <p class="text-sm font-medium text-highlighted">{{ t('settings.neutral') }}</p>
            <p class="mt-0.5 text-xs text-dimmed">{{ t('settings.neutralDesc') }}</p>
          </div>
          <AppColorSelect v-model="neutralModel" :items="neutralItems"/>
        </div>
      </div>
    </template>
  </UModal>
</template>
