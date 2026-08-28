<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { t } = useI18n()

const navItems = computed<NavigationMenuItem[]>(() => [
  {
    label: t('nav.dashboard'),
    icon: 'i-lucide-layout-dashboard',
    to: '/'
  },
  {
    label: t('nav.endpoints'),
    icon: 'i-carbon-gateway-api',
    to: '/endpoints'
  },
  {
    label: t('nav.providers'),
    icon: 'i-lucide-server',
    to: '/providers'
  },
  {
    label: t('nav.virtualModels'),
    icon: 'i-lucide-layers',
    to: '/models'
  }
])

const bottomItems = computed<NavigationMenuItem[]>(() => [
  {
    label: t('nav.settings'),
    icon: 'i-lucide-settings',
    to: '/settings'
  }
])
</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden">
    <AppTitlebar />

    <div class="flex min-h-0 flex-1">
      <aside class="flex w-52 shrink-0 flex-col border-e border-default bg-elevated/25">
        <UNavigationMenu
          orientation="vertical"
          :items="navItems"
          :ui="{ link: 'py-2.5', linkLeadingIcon: 'size-4.5' }"
          class="w-full flex-1 overflow-y-auto p-3"
        />

<!--        <USeparator class="shrink-0" />-->

        <UNavigationMenu
          orientation="vertical"
          :items="bottomItems"
          :ui="{ link: 'py-2.5', linkLeadingIcon: 'size-4.5' }"
          class="w-full shrink-0 p-3"
        />
      </aside>

      <main class="min-w-0 flex-1 overflow-y-auto">
        <div class="mx-auto flex min-h-full w-full max-w-6xl flex-col px-8 py-6">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
