<script setup lang="ts">
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

const props = defineProps<SidebarProps>()

const route = useRoute()

interface NavItem {
  title: string
  url: string
  icon: Component
}

const navItems: NavItem[] = [
  {
    title: '概览',
    url: '/overview',
    icon: PhSquaresFour,
  },
  {
    title: '供应商',
    url: '/providers',
    icon: PhCloud,
  },
  {
    title: '路由',
    url: '/routes',
    icon: PhArrowsSplit,
  },
  {
    title: '虚拟模型',
    url: '/models',
    icon: PhCube,
  },
  {
    title: '智能体',
    url: '/agents',
    icon: PhRobot,
  },
  {
    title: 'Skill',
    url: '/skills',
    icon: PhLightning,
  },
  {
    title: 'MCP',
    url: '/mcp',
    icon: PhPlugsConnected,
  },
  {
    title: '使用统计',
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
                :is-active="route.path === item.url"
              >
                <RouterLink :to="item.url">
                  <component :is="item.icon" />
                  <span>{{ item.title }}</span>
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
              <span>设置</span>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>

    <SidebarRail />
  </Sidebar>
</template>
