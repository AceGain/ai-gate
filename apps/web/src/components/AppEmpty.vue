<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { PhPackage } from '@phosphor-icons/vue'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

/**
 * 通用空态：官方 Empty 组件组合（图标 + 标题）
 */
const { t } = useI18n()

defineProps<{
  title?: string
}>()
</script>

<template>
  <Empty class="min-h-24 py-6">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <PhPackage />
      </EmptyMedia>
      <EmptyTitle class="text-muted-foreground text-xs font-normal">
        {{ title ?? t('common.noData') }}
      </EmptyTitle>
    </EmptyHeader>
  </Empty>
</template>
