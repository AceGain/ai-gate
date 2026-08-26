<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const navItems: NavigationMenuItem[] = [
  {
    label: '概览',
    icon: 'i-lucide-house',
    to: '/'
  },
  {
    label: '供应商',
    icon: 'i-lucide-server',
    to: '/providers'
  },
  {
    label: 'API 密钥',
    icon: 'i-lucide-key-round',
    to: '/keys'
  },
  {
    label: '日志',
    icon: 'i-lucide-scroll-text',
    to: '/logs'
  },
  {
    label: '设置',
    icon: 'i-lucide-settings',
    to: '/settings'
  }
]
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

        <div class="flex items-center justify-between gap-2 border-t border-default px-4 py-2.5">
          <UColorModeButton size="xs" color="neutral" variant="ghost" />
          <span class="text-xs text-dimmed">v0.1.0</span>
        </div>
      </aside>

      <main class="min-w-0 flex-1 overflow-y-auto">
        <div class="mx-auto flex min-h-full w-full max-w-6xl flex-col px-8 py-6">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
