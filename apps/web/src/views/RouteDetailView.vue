<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { RRoute, REndpoint, RKey, RModel } from '@ai-gate/shared'
import { PhArrowLeft, PhKey, PhPath, PhPencilSimple, PhPlus, PhSparkle } from '@phosphor-icons/vue'
import { useRoutesStore } from '@/stores/routes'
import { useBreadcrumb } from '@/composables/useBreadcrumb'
import { api, ApiError } from '@/lib/api'
import { apiErrorMessage } from '@/lib/apiErrorMessage'
import AppEmpty from '@/components/AppEmpty.vue'
import AppLoading from '@/components/AppLoading.vue'
import ProviderIcon from '@/components/provider/ProviderIcon.vue'
import RouteModal from '@/components/route/RouteModal.vue'
import RouteResourceModal from '@/components/route/RouteResourceModal.vue'
import RouteResourceList from '@/components/route/RouteResourceList.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useRoutesStore()
const routeId = computed(() => Number(route.params.id))
const record = ref<RRoute | null>(null)
const current = computed(() => store.routes.find(item => item.id === routeId.value)
  ?? (record.value?.id === routeId.value ? record.value : null))
const endpoints = ref<REndpoint[]>([])
const keys = ref<RKey[]>([])
const models = ref<RModel[]>([])
const loading = ref(true)
const notFound = ref(false)
const error = ref('')
const editOpen = ref(false)
const resourceOpen = ref(false)
const editing = ref<REndpoint | RKey | RModel | null>(null)
const kinds = ['endpoints', 'keys', 'models'] as const
type Kind = typeof kinds[number]
const activeTab = computed<Kind>({
  get: () => kinds.includes(route.query.tab as Kind) ? route.query.tab as Kind : 'endpoints',
  set: tab => { void router.replace({query: {...route.query, tab}}) },
})
const selectedKind = ref<Kind>('endpoints')
const tabs = computed(() => [
  {key: 'endpoints' as const, label: t('endpoints.title'), icon: PhPath, items: endpoints.value},
  {key: 'keys' as const, label: t('keys.title'), icon: PhKey, items: keys.value},
  {key: 'models' as const, label: t('models.title'), icon: PhSparkle, items: models.value},
])
useBreadcrumb(() => [{label: t('nav.routes'), to: '/routes'}, {label: current.value?.name ?? t('common.configure')}])
let request = 0
async function load() {
  const id = routeId.value
  const version = ++request
  const cached = store.routes.find(route => route.id === id)
  loading.value = true
  notFound.value = false
  error.value = ''
  try {
    const [item, endpointList, keyList, modelList] = await Promise.all([
      api<RRoute>(`/set/routes/${id}`), api<REndpoint[]>(`/set/routes/${id}/endpoints`),
      api<RKey[]>(`/set/routes/${id}/keys`), api<RModel[]>(`/set/routes/${id}/models`),
    ])
    if (version !== request) return
    record.value = item
    const index = store.routes.findIndex(route => route.id === id)
    if (index >= 0 && store.routes[index] === cached) store.routes[index] = item
    endpoints.value = endpointList
    keys.value = keyList
    models.value = modelList
  } catch (err) {
    if (version !== request) return
    if (err instanceof ApiError && err.status === 404) notFound.value = true
    else error.value = apiErrorMessage(err)
  } finally { if (version === request) loading.value = false }
}
watch(routeId, () => {
  resourceOpen.value = false
  editOpen.value = false
  record.value = null
  endpoints.value = []; keys.value = []; models.value = []
  void load()
}, {immediate: true})
onBeforeUnmount(() => { request++ })
function editResource(item: REndpoint | RKey | RModel | null) {
  selectedKind.value = activeTab.value
  editing.value = item
  resourceOpen.value = true
}
function saved(item: RRoute) {
  if (item.id !== routeId.value) return
  record.value = item
  void load()
}
</script>

<template>
  <Teleport defer to="#header-actions"><Button variant="ghost" size="sm" @click="router.push('/routes')"><PhArrowLeft data-icon="inline-start" />{{ t('common.back') }}</Button></Teleport>
  <AppLoading v-if="loading && !current" />
  <AppEmpty v-else-if="notFound" :title="t('routes.notFound')" />
  <div v-else class="flex min-w-0 flex-1 flex-col gap-3">
    <Alert v-if="error" variant="destructive"><AlertDescription class="flex items-center justify-between gap-3">{{ error }}<Button variant="outline" size="sm" :disabled="loading" @click="load">{{ t('common.retry') }}</Button></AlertDescription></Alert>
    <template v-if="current">
      <div class="flex min-w-0 items-start gap-3.5">
        <ProviderIcon :icon="current.icon" :name="current.name" size="lg" />
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <div class="flex min-w-0 items-center gap-1.5">
            <h1 class="truncate text-sm font-semibold" :title="current.name">{{ current.name }}</h1>
            <Button variant="ghost" size="icon-xs" :aria-label="t('common.edit')" @click="editOpen = true"><PhPencilSimple /></Button>
          </div>
          <p v-if="current.remark" class="text-muted-foreground truncate text-xs" :title="current.remark">{{ current.remark }}</p>
          <div class="text-muted-foreground flex min-w-0 flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">{{ current.mode === 'SHARED' ? t('routes.shared') : t('routes.dedicated') }}</Badge>
            <span class="break-all">{{ current.mode === 'DEDICATED' ? `${current.host?.includes(':') ? `[${current.host}]` : current.host}:${current.port}` : '' }}{{ current.prefixPath }}</span>
            <span>{{ t('routes.modelsPath') }} · {{ current.modelsPath }}</span>
          </div>
        </div>
        <Switch size="sm" :model-value="current.enabled" :disabled="store.pending.has(current.id)" :aria-label="t('common.toggleEnabled')" @update:model-value="value => store.toggle(current!, !!value)" />
      </div>
      <Tabs :model-value="activeTab" class="flex min-h-0 flex-1 flex-col" @update:model-value="value => activeTab = value as Kind">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <TabsList class="inline-grid shrink-0 auto-cols-fr grid-flow-col">
            <TabsTrigger v-for="tab in tabs" :key="tab.key" :value="tab.key"><component :is="tab.icon" data-icon="inline-start" />{{ tab.label }}</TabsTrigger>
          </TabsList>
          <Button variant="ghost" size="sm" :disabled="loading || !!error" @click="editResource(null)"><PhPlus data-icon="inline-start" />{{ t('common.add') }}</Button>
        </div>
        <TabsContent v-for="tab in tabs" :key="tab.key" :value="tab.key" class="min-h-0 flex-1 overflow-y-auto">
          <RouteResourceList :key="`${routeId}-${tab.key}`" :route-id="routeId" :kind="tab.key" :items="tab.items" :prefix-path="current.prefixPath" @edit="editResource" @changed="load" />
        </TabsContent>
      </Tabs>
      <RouteModal v-model:open="editOpen" :route-item="current" @saved="saved" />
      <RouteResourceModal v-model:open="resourceOpen" :route-id="routeId" :kind="selectedKind" :item="editing" @saved="load" />
    </template>
  </div>
</template>
