<script lang="ts" setup>
import type { ToasterProps } from 'vue-sonner'

import {
  PhCheckCircle,
  PhInfo,
  PhCircleNotch,
  PhWarningOctagon,
  PhWarning,
  PhX,
} from '@phosphor-icons/vue'
import { reactiveOmit } from '@vueuse/core'
import { cn } from 'cn'
import { Toaster as Sonner } from 'vue-sonner'

const props = defineProps<ToasterProps>()
const delegatedProps = reactiveOmit(props, 'class', 'toastOptions')
</script>

<template>
  <Sonner
    :class="cn('toaster group', props.class)"
    :style="{
      '--normal-bg': 'var(--popover)',
      '--normal-text': 'var(--popover-foreground)',
      '--normal-border': 'var(--border)',
      '--border-radius': 'var(--radius, 0)',
      '--gray2': 'hsl(var(--popover) / 0.9)',
      '--gray3': 'var(--border)',
      '--gray4': 'var(--border)',
      '--gray5': 'var(--border)',
      '--gray12': 'var(--popover-foreground)',
    }"
    :toast-options="{
      ...props.toastOptions,
      classes: {
        toast: 'rounded-none',
        actionButton: 'rounded-none',
        cancelButton: 'rounded-none',
        closeButton: 'rounded-none',
        ...props.toastOptions?.classes,
      },
    }"
    v-bind="delegatedProps"
  >
    <template #success-icon>
      <PhCheckCircle class="size-4" />
    </template>
    <template #info-icon>
      <PhInfo class="size-4" />
    </template>
    <template #warning-icon>
      <PhWarning class="size-4" />
    </template>
    <template #error-icon>
      <PhWarningOctagon class="size-4" />
    </template>
    <template #loading-icon>
      <div>
        <PhCircleNotch class="size-4 animate-spin" />
      </div>
    </template>
    <template #close-icon>
      <PhX class="size-4" />
    </template>
  </Sonner>
</template>
