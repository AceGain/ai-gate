<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { PhCircleNotch } from '@phosphor-icons/vue'
import { cn } from 'cn'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <PhCircleNotch role="status" :aria-label="t('common.loading')" :class="cn('size-4 animate-spin', props.class)" />
</template>
