<script setup lang="ts">
import type { MessageKey } from '@/i18n'
import type { Component } from 'vue'
import type { SidebarProps } from '@/components/ui/sidebar'
import {
  PhArrowsSplit,
  PhChartBar,
  PhCloud,
  PhCube,
  PhGear,
  PhLightning,
  PhPlugsConnected,
  PhRobot,
  PhRows,
  PhSquaresFour,
} from '@phosphor-icons/vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<SidebarProps>()

const route = useRoute()

interface NavItem {
  titleKey: MessageKey
  url: string
  icon: Component
}

const navItems: NavItem[] = [
  {
    titleKey: 'nav.overview',
    url: '/overview',
    icon: PhSquaresFour,
  },
  {
    titleKey: 'nav.providers',
    url: '/providers',
    icon: PhCloud,
  },
  {
    titleKey: 'nav.routes',
    url: '/routes',
    icon: PhArrowsSplit,
  },
  {
    titleKey: 'nav.models',
    url: '/models',
    icon: PhCube,
  },
  {
    titleKey: 'nav.agents',
    url: '/agents',
    icon: PhRobot,
  },
  {
    titleKey: 'nav.skills',
    url: '/skills',
    icon: PhLightning,
  },
  {
    titleKey: 'nav.mcp',
    url: '/mcp',
    icon: PhPlugsConnected,
  },
  {
    titleKey: 'nav.usage',
    url: '/usage',
    icon: PhChartBar,
  },
]
</script>

<template>
  <Sidebar v-bind="props">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" as-child>
            <RouterLink to="/overview">
              <div class="flex aspect-square size-8 items-center justify-center bg-sidebar-primary text-sidebar-primary-foreground">
                <PhRows class="size-4" />
              </div>
              <div class="flex flex-col gap-0.5 leading-none">
                <span class="font-semibold">AI Gate</span>
                <span class="text-muted-foreground">v2.0.0</span>
              </div>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>

    <SidebarContent>
      <SidebarGroup class="pt-0">
        <SidebarGroupContent>
          <SidebarMenu class="gap-0.5">
            <SidebarMenuItem v-for="item in navItems" :key="item.url">
              <SidebarMenuButton
                as-child
                :is-active="route.path === item.url || route.path.startsWith(`${item.url}/`)"
              >
                <RouterLink :to="item.url">
                  <component :is="item.icon" />
                  <span>{{ t(item.titleKey) }}</span>
                </RouterLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter class="border-t border-sidebar-border">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            as-child
            :is-active="route.path === '/settings'"
          >
            <RouterLink to="/settings">
              <PhGear />
              <span>{{ t('nav.settings') }}</span>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>

    <SidebarRail />
  </Sidebar>
</template>
