<script setup lang="ts">
import { PhMagnifyingGlass } from '@phosphor-icons/vue'
import { Label } from '@/components/ui/label'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarInput,
} from '@/components/ui/sidebar'

const searchQuery = defineModel<string>({ default: '' })
</script>

<template>
  <form @submit.prevent>
    <SidebarGroup class="py-0">
      <SidebarGroupContent class="relative">
        <Label for="sidebar-search" class="sr-only">
          搜索
        </Label>
        <SidebarInput
          id="sidebar-search"
          v-model="searchQuery"
          placeholder="搜索菜单..."
          class="pl-8"
        />
        <PhMagnifyingGlass class="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 select-none opacity-50" />
      </SidebarGroupContent>
    </SidebarGroup>
  </form>
</template>
