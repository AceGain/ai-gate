<script setup lang="ts">
import { PhMagnifyingGlass } from '@phosphor-icons/vue'
import { Label } from '@/components/ui/label'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarInput,
} from '@/components/ui/sidebar'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const searchQuery = defineModel<string>({ default: '' })
</script>

<template>
  <form @submit.prevent>
    <SidebarGroup class="py-0">
      <SidebarGroupContent class="relative">
        <Label for="sidebar-search" class="sr-only">
          {{ t('common.search') }}
        </Label>
        <SidebarInput
          id="sidebar-search"
          v-model="searchQuery"
          :placeholder="t('nav.searchPlaceholder')"
          class="pl-8"
        />
        <PhMagnifyingGlass class="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 select-none opacity-50" />
      </SidebarGroupContent>
    </SidebarGroup>
  </form>
</template>
