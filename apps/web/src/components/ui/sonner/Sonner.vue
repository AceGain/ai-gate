<script lang="ts" setup>
import type { ToasterProps } from 'vue-sonner'

import {
  PhCheckCircle,
  PhCircleNotch,
  PhInfo,
  PhWarning,
  PhWarningOctagon,
  PhX,
} from '@phosphor-icons/vue'
import { reactiveOmit } from '@vueuse/core'
import { cn } from 'cn'
import { Toaster as Sonner } from 'vue-sonner'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = withDefaults(defineProps<ToasterProps>(), {
  expand: true,
  gap: 8,
  visibleToasts: 4,
  closeButton: true,
})

const delegatedProps = reactiveOmit(props, 'class', 'toastOptions', 'containerAriaLabel')
</script>

<template>
  <Sonner
    :container-aria-label="props.containerAriaLabel ?? t('common.notifications')"
    :class="cn('toaster group', props.class)"
    :style="{
      '--normal-bg': 'var(--popover)',
      '--normal-text': 'var(--popover-foreground)',
      '--normal-border': 'transparent',
      '--border-radius': '0px',
      '--gray2': 'hsl(var(--popover) / 0.9)',
      '--gray3': 'var(--border)',
      '--gray4': 'var(--border)',
      '--gray5': 'var(--border)',
      '--gray12': 'var(--popover-foreground)',
    }"
    :toast-options="{
      ...props.toastOptions,
      closeButtonAriaLabel: props.toastOptions?.closeButtonAriaLabel ?? t('common.close'),
      classes: {
        toast: 'rounded-none font-sans text-xs',
        title: 'text-xs font-medium text-foreground',
        description: 'text-xs text-muted-foreground',
        actionButton: 'rounded-none text-xs font-medium',
        cancelButton: 'rounded-none text-xs font-medium',
        closeButton: 'rounded-none',
        ...props.toastOptions?.classes,
      },
    }"
    v-bind="delegatedProps"
  >
    <template #success-icon>
      <PhCheckCircle class="text-success size-4 shrink-0" />
    </template>
    <template #info-icon>
      <PhInfo class="text-primary size-4 shrink-0" />
    </template>
    <template #warning-icon>
      <PhWarning class="text-warning size-4 shrink-0" />
    </template>
    <template #error-icon>
      <PhWarningOctagon class="text-destructive size-4 shrink-0" />
    </template>
    <template #loading-icon>
      <div>
        <PhCircleNotch class="text-muted-foreground size-4 shrink-0 animate-spin" />
      </div>
    </template>
    <template #close-icon>
      <PhX class="size-3.5" />
    </template>
  </Sonner>
</template>
