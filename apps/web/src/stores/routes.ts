import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RRoute, RRouteInput, RRouteUpdateInput } from '@ai-gate/shared'
import { toast } from 'vue-sonner'
import { api } from '@/lib/api'
import { apiErrorMessage } from '@/lib/apiErrorMessage'
import { t } from '@/i18n'

export const useRoutesStore = defineStore('routes', () => {
  const routes = ref<RRoute[]>([])
  const loading = ref(false)
  const loadError = ref(false)
  const pending = ref(new Set<number>())
  let loadPromise: Promise<void> | undefined
  let revision = 0
  let orderRevision = 0
  const removed = new Set<number>()

  function replace(route: RRoute) {
    if (removed.has(route.id)) return
    revision++
    const index = routes.value.findIndex(item => item.id === route.id)
    if (index === -1) routes.value.push(route)
    else routes.value[index] = route
  }
  function load(): Promise<void> {
    if (loadPromise) return loadPromise
    loading.value = true
    loadError.value = false
    const version = revision
    let stale = false
    loadPromise = api<RRoute[]>('/set/routes').then(items => {
      stale = version !== revision
      if (!stale) routes.value = items
    })
      .catch(error => { loadError.value = true; toast.error(apiErrorMessage(error)) })
      .finally(() => { loading.value = false; loadPromise = undefined })
      .then(async () => { if (stale) await load() })
    return loadPromise
  }
  async function create(input: RRouteInput) {
    const route = await api<RRoute>('/set/routes', {method: 'POST', body: JSON.stringify(input)})
    replace(route)
    return route
  }
  async function update(id: number, input: RRouteUpdateInput) {
    const route = await api<RRoute>(`/set/routes/${id}`, {method: 'PUT', body: JSON.stringify(input)})
    replace(route)
    return route
  }
  async function toggle(route: RRoute, enabled: boolean) {
    if (pending.value.has(route.id)) return
    pending.value.add(route.id)
    try {
      replace(await api<RRoute>(`/set/routes/${route.id}/enabled`, {method: 'PATCH', body: JSON.stringify({enabled})}))
    } catch (error) { toast.error(apiErrorMessage(error)) }
    finally { pending.value.delete(route.id) }
  }
  async function remove(id: number) {
    try {
      await api(`/set/routes/${id}`, {method: 'DELETE'})
      removed.add(id)
      revision++
      routes.value = routes.value.filter(route => route.id !== id)
      toast.success(t('common.deleted'))
    } catch (error) { toast.error(apiErrorMessage(error)) }
  }
  async function saveOrder() {
    const version = ++orderRevision
    const order = routes.value.map((route, sort) => ({id: route.id, sort}))
    revision++
    try {
      await api('/set/routes/reorder', {method: 'PUT', body: JSON.stringify(order)})
      if (version !== orderRevision) return
      const byId = new Map(order.map(item => [item.id, item.sort]))
      routes.value.forEach(route => { if (byId.has(route.id)) route.sort = byId.get(route.id)! })
      // A GET started during this write may already have restored the previous array order.
      const current = new Map(routes.value.map(route => [route.id, route]))
      routes.value = [
        ...order.flatMap(item => current.has(item.id) ? [current.get(item.id)!] : []),
        ...routes.value.filter(route => !byId.has(route.id)),
      ]
      revision++
    } catch (error) {
      toast.error(apiErrorMessage(error))
      if (version === orderRevision) await load()
    }
  }
  return {routes, loading, loadError, pending, load, create, update, toggle, remove, saveOrder}
})
