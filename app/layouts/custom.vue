<script setup lang="ts">
import type {CommandPaletteItem, NavigationMenuItem} from '@nuxt/ui'

const {t} = useI18n()

const open = ref(false)

const links = computed<NavigationMenuItem[][]>(() => [[
  {
    label: t('nav.dashboard'),
    icon: 'i-lucide-layout-dashboard',
    to: '/',
    onSelect: () => {
      open.value = false
    }
  },
  {
    label: t('nav.endpoints'),
    icon: 'i-lucide-network',
    to: '/endpoints',
    onSelect: () => {
      open.value = false
    }
  },
  {
    label: t('nav.providers'),
    icon: 'i-lucide-server',
    to: '/providers',
    onSelect: () => {
      open.value = false
    }
  },
  {
    label: t('nav.virtualModels'),
    icon: 'i-lucide-layers',
    to: '/models',
    onSelect: () => {
      open.value = false
    }
  }
], [
  {
    label: t('nav.settings'),
    icon: 'i-lucide-settings',
    to: '/settings',
    onSelect: () => {
      open.value = false
    }
  }
]])

const groups = computed(() => [{
  id: 'links',
  label: t('nav.goTo'),
  items: links.value.flat() as CommandPaletteItem[]
}])
</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden">
    <AppTitlebar/>

    <div class="relative min-h-0 flex-1">
      <UDashboardGroup
        unit="rem"
        :ui="{ base: () => 'absolute inset-0 flex overflow-hidden' }"
      >
        <UDashboardSidebar
          id="custom"
          v-model:open="open"
          collapsible
          resizable
          class="bg-elevated/25"
          :ui="{ root: 'min-h-0', footer: 'lg:border-t lg:border-default' }"
        >
          <template #header="{ collapsed }">
            <UDashboardSearchButton :collapsed="collapsed" class="max-w-full bg-transparent ring-default"/>
          </template>

          <template #default="{ collapsed }">
            <UNavigationMenu
              :collapsed="collapsed"
              :items="links[0]"
              orientation="vertical"
              tooltip
              popover
              :ui="{ link: 'py-2.5', linkLeadingIcon: 'size-4.5' }"
            />

            <UNavigationMenu
              :collapsed="collapsed"
              :items="links[1]"
              orientation="vertical"
              tooltip
              popover
              class="mt-auto"
              :ui="{ link: 'py-2.5', linkLeadingIcon: 'size-4.5' }"
            />
          </template>
        </UDashboardSidebar>

        <UDashboardSearch :groups="groups"/>

        <main class="min-w-0 flex-1 overflow-y-auto">
          <div class="mx-auto flex min-h-full w-full max-w-6xl flex-col px-8 py-6">
            <slot/>
          </div>
        </main>
      </UDashboardGroup>
    </div>
  </div>
</template>
