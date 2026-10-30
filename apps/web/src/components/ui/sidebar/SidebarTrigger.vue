<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { PhSidebarSimple } from '@phosphor-icons/vue'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { useSidebar } from './utils'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()

const { toggleSidebar } = useSidebar()
</script>

<template>
  <Button
    data-sidebar="trigger"
    data-slot="sidebar-trigger"
    variant="ghost"
    size="icon-sm"
    :class="cn('', props.class)"
    @click="toggleSidebar"
  >
    <PhSidebarSimple class="cn-rtl-flip" />
    <span class="sr-only">{{ t('nav.toggleSidebar') }}</span>
  </Button>
</template>
