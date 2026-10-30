<script setup lang="ts">
import { computed, watch, watchEffect } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { useProvideBreadcrumb, type BreadcrumbItemRecord } from '@/composables/useBreadcrumb'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const route = useRoute()
const { customBreadcrumbs, clearBreadcrumbs } = useProvideBreadcrumb()

// 当路由切换时，重置自定义面包屑（防止页面间残留）
watch(() => route.path, () => {
  clearBreadcrumbs()
})

const breadcrumbs = computed<BreadcrumbItemRecord[]>(() => {
  if (customBreadcrumbs.value && customBreadcrumbs.value.length > 0) {
    return customBreadcrumbs.value
  }
  if (Array.isArray(route.meta.breadcrumbs)) {
    return route.meta.breadcrumbs.map(item => ({ label: t(item.labelKey), to: item.to }))
  }
  if (route.meta.titleKey) {
    return [{ label: t(route.meta.titleKey) }]
  }
  return [{ label: t('nav.overview') }]
})

watchEffect(() => {
  document.title = `${t(route.meta.titleKey ?? 'nav.overview')} · AI Gate`
})
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <header class="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger class="-ml-1" />
        <Separator
          orientation="vertical"
          class="mr-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <template
              v-for="(item, index) in breadcrumbs"
              :key="index"
            >
              <BreadcrumbItem>
                <BreadcrumbLink
                  v-if="item.to && index < breadcrumbs.length - 1"
                  as-child
                >
                  <RouterLink
                    :to="item.to"
                    class="max-w-[120px] truncate sm:max-w-[180px]"
                    :title="item.label"
                  >
                    {{ item.label }}
                  </RouterLink>
                </BreadcrumbLink>
                <BreadcrumbPage
                  v-else
                  class="max-w-[160px] truncate sm:max-w-[260px]"
                  :title="item.label"
                >
                  {{ item.label }}
                </BreadcrumbPage>
              </BreadcrumbItem>
              <BreadcrumbSeparator v-if="index < breadcrumbs.length - 1" />
            </template>
          </BreadcrumbList>
        </Breadcrumb>
        <div
          id="header-actions"
          class="ml-auto flex items-center gap-2"
        />
      </header>
      <div class="flex min-w-0 flex-1 flex-col p-4">
        <RouterView />
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
