<script lang="ts" setup>
import type { HTMLAttributes } from 'vue'

import { PhDotsThree } from '@phosphor-icons/vue'
import { cn } from 'cn'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <span
    data-slot="breadcrumb-ellipsis"
    role="presentation"
    aria-hidden="true"
    :class="cn('size-5 [&>svg]:size-4 flex items-center justify-center', props.class)"
  >
    <slot>
      <PhDotsThree />
    </slot>
    <span class="sr-only">{{ t('common.more') }}</span>
  </span>
</template>
