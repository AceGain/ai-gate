<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { PhTranslate } from '@phosphor-icons/vue'
import { currentLocale } from '@/i18n'
import { isAppLocale, LANGUAGE_OPTIONS } from '@/i18n/locales'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const { t } = useI18n()

function changeLanguage(value: unknown) {
  // A selected toggle can emit an empty value; keep one language selected.
  if (isAppLocale(value)) currentLocale.value = value
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <PhTranslate class="size-4" />
          {{ t('settings.languageTitle') }}
        </CardTitle>
        <CardDescription>{{ t('settings.languageDescription') }}</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel id="language-label">{{ t('settings.displayLanguage') }}</FieldLabel>
            <ToggleGroup
              :model-value="currentLocale"
              type="single"
              variant="outline"
              :spacing="2"
              class="flex-wrap"
              aria-labelledby="language-label"
              @update:model-value="changeLanguage"
            >
              <ToggleGroupItem
                v-for="language in LANGUAGE_OPTIONS"
                :key="language.value"
                :value="language.value"
                :lang="language.value"
              >
                {{ language.label }}
              </ToggleGroupItem>
            </ToggleGroup>
            <FieldDescription aria-live="polite">{{ t('settings.savedAutomatically') }}</FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  </div>
</template>
