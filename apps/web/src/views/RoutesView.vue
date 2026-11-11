<script setup lang="ts">
import type { RRoute } from '@ai-gate/shared'
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSortable } from '@vueuse/integrations/useSortable'
import { storeToRefs } from 'pinia'
import { PhDotsSixVertical, PhGearSix, PhPencilSimple, PhPlus, PhTrashSimple } from '@phosphor-icons/vue'
import { useI18n } from 'vue-i18n'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useRoutesStore } from '@/stores/routes'
import AppEmpty from '@/components/AppEmpty.vue'
import AppLoading from '@/components/AppLoading.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Item, ItemActions, ItemContent } from '@/components/ui/item'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import ProviderIcon from '@/components/provider/ProviderIcon.vue'
import RouteModal from '@/components/route/RouteModal.vue'

const { t } = useI18n()
const router = useRouter()
const store = useRoutesStore()
const { routes, loading, loadError, pending } = storeToRefs(store)
const { confirmDialog } = useConfirmDialog()
const modalOpen = ref(false)
const editing = ref<RRoute | null>(null)
void store.load()

function edit(route: RRoute | null) { editing.value = route; modalOpen.value = true }
async function remove(route: RRoute) {
  if (await confirmDialog({title: () => t('routes.delete'), description: () => t('routes.deleteConfirm', {name: route.name})})) {
    await store.remove(route.id)
  }
}
const listEl = ref<HTMLElement | null>(null)
useSortable(listEl, routes, {
  handle: '.drag-handle', animation: 150, forceFallback: true, fallbackOnBody: true, watchElement: true,
  onStart: () => document.body.classList.add('route-sortable-dragging'),
  onEnd: event => {
    document.body.classList.remove('route-sortable-dragging')
    if (event.oldIndex !== event.newIndex) void nextTick(() => store.saveOrder())
  },
})
onBeforeUnmount(() => document.body.classList.remove('route-sortable-dragging'))
</script>

<template>
  <Teleport defer to="#header-actions">
    <Button variant="ghost" size="sm" @click="edit(null)"><PhPlus data-icon="inline-start" />{{ t('common.add') }}</Button>
  </Teleport>
  <div class="flex min-w-0 flex-1 flex-col gap-3">
    <Alert v-if="loadError" variant="destructive">
      <AlertDescription class="flex items-center justify-between gap-3">
        {{ t('errors.backendUnavailable') }}
        <Button variant="outline" size="sm" :disabled="loading" @click="store.load">{{ t('common.retry') }}</Button>
      </AlertDescription>
    </Alert>
    <AppLoading v-if="loading && !routes.length" />
    <div v-else-if="routes.length" class="min-h-0 min-w-0 flex-1 overflow-y-auto">
      <div ref="listEl" class="flex min-w-0 flex-col gap-2 pb-1" role="list">
        <Item v-for="route in routes" :key="route.id" variant="outline" role="listitem"
          class="group hover:border-primary/40 hover:bg-muted/30 min-h-16 min-w-0 flex-nowrap gap-3 px-3.5 duration-150">
          <div class="drag-handle text-muted-foreground hover:bg-muted hover:text-foreground -ml-1 flex size-7 shrink-0 cursor-pointer items-center justify-center transition-colors"
            aria-hidden="true" :title="t('common.dragToSort')"><PhDotsSixVertical class="size-4" /></div>
          <ProviderIcon :icon="route.icon" :name="route.name || route.code" size="lg" />
          <ItemContent class="min-w-0 justify-center">
            <span class="truncate text-sm font-medium" :title="route.name">{{ route.name }}</span>
            <p v-if="route.remark" class="text-muted-foreground truncate text-xs" :title="route.remark">{{ route.remark }}</p>
            <p v-else class="text-muted-foreground truncate text-xs" :title="route.prefixPath">{{ route.prefixPath }}</p>
          </ItemContent>
          <Badge variant="secondary" class="hidden shrink-0 sm:inline-flex">{{ route.mode === 'SHARED' ? t('routes.shared') : t('routes.dedicated') }}</Badge>
          <Switch size="sm" :model-value="route.enabled" :disabled="pending.has(route.id)" :aria-label="t('common.toggleEnabled')"
            class="shrink-0" @update:model-value="value => store.toggle(route, !!value)" />
          <ItemActions class="shrink-0 gap-1">
            <Button variant="ghost" size="icon-sm" :aria-label="t('common.configure')" :title="t('common.configure')" @click="router.push(`/routes/${route.id}`)"><PhGearSix /></Button>
            <Button variant="ghost" size="icon-sm" :aria-label="t('common.edit')" :title="t('common.edit')" @click="edit(route)"><PhPencilSimple /></Button>
            <Button variant="ghost" size="icon-sm" :aria-label="t('common.delete')" :title="t('common.delete')" @click="remove(route)"><PhTrashSimple /></Button>
          </ItemActions>
        </Item>
      </div>
    </div>
    <div v-else-if="!loadError" class="flex min-h-0 flex-1 items-center justify-center"><AppEmpty /></div>
  </div>
  <RouteModal v-model:open="modalOpen" :route-item="editing" />
</template>

<style scoped>
:deep(.sortable-ghost) { opacity: 0.35; }
</style>
<style>
body.route-sortable-dragging, body.route-sortable-dragging * { cursor: grabbing !important; }
</style>
