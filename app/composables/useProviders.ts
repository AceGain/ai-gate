import type {SysProvider, SysProviderInput} from '~/utils/providers'
import {apiBase} from '~/utils/providers'

/**
 * 供应商状态：useState 共享 + SQLite 后端（/api/providers）逐条 CRUD
 * 排序由列表拖拽触发，经 reorder 接口持久化
 */
export function useProviders() {
  const providers = useState<SysProvider[]>('providers', () => [])
  const loaded = useState<boolean>('providers-loaded', () => false)
  const toast = useToast()
  const {t} = useI18n()

  if (import.meta.client && !loaded.value) {
    loaded.value = true
    void load()
  }

  function notifyBackendError() {
    toast.add({color: 'error', title: t('providers.backendUnavailable')})
  }

  /** 拉取列表（后端按 sort 升序返回） */
  async function load(): Promise<void> {
    try {
      providers.value = await $fetch<SysProvider[]>(`${apiBase()}/api/providers`)
    } catch (err) {
      console.warn('[ai-gate] 加载供应商失败', err)
      notifyBackendError()
    }
  }

  /** 新增（sort 自动追加到列表末尾；错误向上抛，由弹窗处理 409 编码冲突等） */
  async function createProvider(input: SysProviderInput): Promise<SysProvider> {
    const sort = providers.value.length ? Math.max(...providers.value.map(p => p.sort)) + 1 : 0
    const created = await $fetch<SysProvider>(`${apiBase()}/api/providers`, {
      method: 'POST',
      body: {...input, sort}
    })
    providers.value = [...providers.value, created]
    return created
  }

  /** 全量更新单条（错误向上抛，由弹窗处理） */
  async function updateProvider(id: string, input: SysProviderInput): Promise<SysProvider> {
    const updated = await $fetch<SysProvider>(`${apiBase()}/api/providers/${id}`, {
      method: 'PUT',
      body: input
    })
    const index = providers.value.findIndex(p => p.id === id)
    if (index !== -1) {
      const list = [...providers.value]
      list[index] = updated
      providers.value = list
    }
    return updated
  }

  /** 删除 */
  async function removeProvider(id: string): Promise<void> {
    try {
      await $fetch(`${apiBase()}/api/providers/${id}`, {method: 'DELETE'})
      providers.value = providers.value.filter(p => p.id !== id)
    } catch (err) {
      console.warn('[ai-gate] 删除供应商失败', err)
      notifyBackendError()
    }
  }

  /** 切换启用（乐观更新，失败回滚） */
  async function toggleProvider(p: SysProvider, enabled: boolean): Promise<void> {
    const index = providers.value.findIndex(it => it.id === p.id)
    if (index === -1) return
    const prev = providers.value[index]!
    const list = [...providers.value]
    list[index] = {...prev, enabled}
    providers.value = list
    try {
      const updated = await $fetch<SysProvider>(`${apiBase()}/api/providers/${p.id}`, {
        method: 'PUT',
        body: {code: prev.code, name: prev.name, icon: prev.icon, enabled, description: prev.description, sort: prev.sort}
      })
      const list2 = [...providers.value]
      list2[index] = updated
      providers.value = list2
    } catch (err) {
      console.warn('[ai-gate] 切换供应商启用状态失败', err)
      const list2 = [...providers.value]
      list2[index] = prev
      providers.value = list2
      notifyBackendError()
    }
  }

  /** 持久化当前顺序（sort = 行下标）；失败时回滚为服务端数据 */
  async function saveOrder(): Promise<void> {
    try {
      await $fetch(`${apiBase()}/api/providers/reorder`, {
        method: 'PUT',
        body: providers.value.map((p, index) => ({id: p.id, sort: index}))
      })
    } catch (err) {
      console.warn('[ai-gate] 保存供应商排序失败', err)
      notifyBackendError()
      await load()
    }
  }

  /** 按 id 拉取单条供应商（用于直接访问详情页时的兜底） */
  async function fetchProvider(id: string): Promise<SysProvider | null> {
    try {
      const p = await $fetch<SysProvider>(`${apiBase()}/api/providers/${id}`)
      const index = providers.value.findIndex(it => it.id === id)
      if (index !== -1) {
        const list = [...providers.value]
        list[index] = p
        providers.value = list
      } else {
        providers.value = [...providers.value, p]
      }
      return p
    } catch {
      return null
    }
  }

  return {providers, load, fetchProvider, createProvider, updateProvider, removeProvider, toggleProvider, saveOrder}
}
