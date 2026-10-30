<script lang="ts" setup>
import type { HTMLAttributes } from 'vue'
import { cn } from 'cn'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <nav
    :aria-label="t('nav.breadcrumb')"
    data-slot="breadcrumb"
    :class="cn('', props.class)"
  >
    <slot />
  </nav>
</template>
