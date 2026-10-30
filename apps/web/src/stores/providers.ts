import { apiErrorMessage } from '@/lib/apiErrorMessage'
import { t } from '@/i18n'
/**
 * 出站供应商（S 域）状态：Pinia store + SQLite 后端（/api/providers）逐条 CRUD
 * 列表排序由拖拽触发，经 reorder 接口持久化；
 * 详情配置（端点/密钥/模型）挂当前供应商，进入详情页时 loadAll 重置
 */
import { ref } from 'vue'
import type {
  SKey,
  SKeyInput,
  SEndpoint,
  SEndpointInput,
  SKeyTestResult,
  SModel,
  SModelInput,
  SProvider,
  SProviderCreateInput,
  SProviderUpdateInput,
  SRemoteModelKeyFetch,
} from '@ai-gate/shared'
import { defineStore } from 'pinia'
import { api, ApiError } from '@/lib/api'
import { toast } from 'vue-sonner'

function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError
}

export const useProvidersStore = defineStore('providers', () => {
  
  /* ---------------- 供应商列表 ---------------- */

  const providers = ref<SProvider[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  function notifyBackendError(err: unknown) {
    toast.error(apiErrorMessage(err))
  }

  /** 拉取列表（后端按 sort 升序返回） */
  async function load(): Promise<void> {
    loading.value = true
    try {
      providers.value = await api<SProvider[]>('/providers')
      loaded.value = true
    } catch (err) {
      console.warn('[ai-gate] 加载供应商失败', err)
      notifyBackendError(err)
    } finally {
      loading.value = false
    }
  }

  /** 首次使用时自动拉取一次 */
  if (!loaded.value) void load()

  /** 按 id 拉取单条供应商（用于直接访问详情页时的兜底） */
  async function fetchProvider(id: number): Promise<SProvider | null> {
    try {
      const p = await api<SProvider>(`/providers/${id}`)
      const index = providers.value.findIndex(it => it.id === id)
      if (index !== -1) {
        providers.value[index] = p
      } else {
        providers.value.push(p)
      }
      return p
    } catch {
      return null
    }
  }

  /** 新增（sort 自动追加到列表末尾；错误向上抛，由弹窗处理 409 编码冲突等） */
  async function createProvider(input: SProviderCreateInput): Promise<SProvider> {
    const sort = providers.value.length ? Math.max(...providers.value.map(p => p.sort)) + 1 : 0
    const created = await api<SProvider>('/providers', {
      method: 'POST',
      body: JSON.stringify({...input, sort}),
    })
    providers.value = [...providers.value, created]
    return created
  }

  /** 全量更新单条（错误向上抛，由弹窗处理） */
  async function updateProvider(id: number, input: SProviderUpdateInput): Promise<SProvider> {
    const updated = await api<SProvider>(`/providers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
    const index = providers.value.findIndex(p => p.id === id)
    if (index !== -1) providers.value[index] = updated
    return updated
  }

  /** 删除 */
  async function removeProvider(id: number): Promise<void> {
    try {
      await api(`/providers/${id}`, {method: 'DELETE'})
      providers.value = providers.value.filter(p => p.id !== id)
      toast.success(t('common.deleted'))
    } catch (err) {
      console.warn('[ai-gate] 删除供应商失败', err)
      notifyBackendError(err)
    }
  }

  /** 切换启用（乐观更新，失败回滚） */
  async function toggleProvider(p: SProvider, enabled: boolean): Promise<void> {
    const index = providers.value.findIndex(it => it.id === p.id)
    if (index === -1) return
    const prev = providers.value[index]!
    providers.value[index] = {...prev, enabled}
    try {
      const updated = await api<SProvider>(`/providers/${p.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          code: prev.code,
          name: prev.name,
          icon: prev.icon,
          enabled,
          remark: prev.remark,
          sort: prev.sort,
        }),
      })
      providers.value[index] = updated
    } catch (err) {
      console.warn('[ai-gate] 切换供应商启用状态失败', err)
      providers.value[index] = prev
      notifyBackendError(err)
    }
  }

  /** 持久化当前顺序（sort = 行下标）；失败时回滚为服务端数据 */
  async function saveOrder(): Promise<void> {
    try {
      await api('/providers/reorder', {
        method: 'PUT',
        body: JSON.stringify(providers.value.map((p, index) => ({id: p.id, sort: index}))),
      })
    } catch (err) {
      console.warn('[ai-gate] 保存供应商排序失败', err)
      notifyBackendError(err)
      await load()
    }
  }

  /* ---------------- 供应商配置（端点 / 密钥 / 模型） ---------------- */

  const endpoints = ref<SEndpoint[]>([])
  const keys = ref<SKey[]>([])
  const models = ref<SModel[]>([])
  const configLoading = ref(false)

  function resetConfig() {
    endpoints.value = []
    keys.value = []
    models.value = []
    configLoading.value = false
  }

  async function loadAll(providerId: number): Promise<void> {
    if (!providerId) return
    configLoading.value = true
    try {
      const [epList, keyList, modelList] = await Promise.all([
        api<SEndpoint[]>(`/providers/${providerId}/endpoints`),
        api<SKey[]>(`/providers/${providerId}/keys`),
        api<SModel[]>(`/providers/${providerId}/models`),
      ])
      endpoints.value = epList
      keys.value = keyList
      models.value = modelList
    } catch (err) {
      console.warn('[ai-gate] 加载供应商配置失败', err)
      notifyBackendError(err)
    } finally {
      configLoading.value = false
    }
  }

  /* ----- 端点 ----- */

  async function loadEndpoints(providerId: number): Promise<void> {
    try {
      endpoints.value = await api<SEndpoint[]>(`/providers/${providerId}/endpoints`)
    } catch (err) {
      console.warn('[ai-gate] 加载端点失败', err)
      notifyBackendError(err)
    }
  }

  async function createEndpoint(providerId: number, input: SEndpointInput): Promise<SEndpoint> {
    const created = await api<SEndpoint>(`/providers/${providerId}/endpoints`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    // 重新拉取以同步服务端其它端点的默认互斥状态
    await loadEndpoints(providerId)
    return created
  }

  async function updateEndpoint(providerId: number, id: number, input: SEndpointInput): Promise<SEndpoint> {
    const updated = await api<SEndpoint>(`/providers/${providerId}/endpoints/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
    await loadEndpoints(providerId)
    return updated
  }

  async function removeEndpoint(providerId: number, id: number): Promise<void> {
    try {
      await api(`/providers/${providerId}/endpoints/${id}`, {method: 'DELETE'})
      endpoints.value = endpoints.value.filter(e => e.id !== id)
      toast.success(t('common.deleted'))
    } catch (err) {
      console.warn('[ai-gate] 删除端点失败', err)
      notifyBackendError(err)
    }
  }

  /* ----- 密钥 ----- */

  async function loadKeys(providerId: number): Promise<void> {
    try {
      keys.value = await api<SKey[]>(`/providers/${providerId}/keys`)
    } catch (err) {
      console.warn('[ai-gate] 加载密钥失败', err)
      notifyBackendError(err)
    }
  }

  async function createKey(providerId: number, input: SKeyInput): Promise<SKey> {
    const sort = keys.value.length ? Math.max(...keys.value.map(k => k.sort)) + 1 : 0
    const created = await api<SKey>(`/providers/${providerId}/keys`, {
      method: 'POST',
      body: JSON.stringify({...input, sort}),
    })
    keys.value = [...keys.value, created]
    return created
  }

  async function updateKey(providerId: number, id: number, input: SKeyInput): Promise<SKey> {
    const updated = await api<SKey>(`/providers/${providerId}/keys/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
    const index = keys.value.findIndex(k => k.id === id)
    if (index !== -1) keys.value[index] = updated
    return updated
  }

  async function removeKey(providerId: number, id: number): Promise<void> {
    try {
      await api(`/providers/${providerId}/keys/${id}`, {method: 'DELETE'})
      keys.value = keys.value.filter(k => k.id !== id)
      toast.success(t('common.deleted'))
    } catch (err) {
      console.warn('[ai-gate] 删除密钥失败', err)
      notifyBackendError(err)
    }
  }

  async function saveKeyOrder(providerId: number): Promise<void> {
    try {
      await api(`/providers/${providerId}/keys/reorder`, {
        method: 'PUT',
        body: JSON.stringify(keys.value.map((k, index) => ({id: k.id, sort: index}))),
      })
    } catch (err) {
      console.warn('[ai-gate] 保存密钥排序失败', err)
      notifyBackendError(err)
      await loadKeys(providerId)
    }
  }

  /** 测试密钥可用性（经后端向上游发起最小鉴权请求）；失败抛出，由调用方按错误码就近提示 */
  async function testKey(providerId: number, id: number): Promise<SKeyTestResult> {
    return await api<SKeyTestResult>(`/providers/${providerId}/keys/${id}/test`, {method: 'POST'})
  }

  /* ----- 模型 ----- */

  async function loadModels(providerId: number): Promise<void> {
    try {
      models.value = await api<SModel[]>(`/providers/${providerId}/models`)
    } catch (err) {
      console.warn('[ai-gate] 加载模型失败', err)
      notifyBackendError(err)
    }
  }

  async function createModel(providerId: number, input: SModelInput): Promise<SModel> {
    const sort = models.value.length ? Math.max(...models.value.map(m => m.sort)) + 1 : 0
    const created = await api<SModel>(`/providers/${providerId}/models`, {
      method: 'POST',
      body: JSON.stringify({...input, sort}),
    })
    models.value = [...models.value, created]
    return created
  }

  async function updateModel(providerId: number, id: number, input: SModelInput): Promise<SModel> {
    const updated = await api<SModel>(`/providers/${providerId}/models/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
    const index = models.value.findIndex(m => m.id === id)
    if (index !== -1) models.value[index] = updated
    return updated
  }

  async function removeModel(providerId: number, id: number): Promise<void> {
    try {
      await api(`/providers/${providerId}/models/${id}`, {method: 'DELETE'})
      models.value = models.value.filter(m => m.id !== id)
      toast.success(t('common.deleted'))
    } catch (err) {
      console.warn('[ai-gate] 删除模型失败', err)
      notifyBackendError(err)
    }
  }

  async function saveModelOrder(providerId: number): Promise<void> {
    try {
      await api(`/providers/${providerId}/models/reorder`, {
        method: 'PUT',
        body: JSON.stringify(models.value.map((m, index) => ({id: m.id, sort: index}))),
      })
    } catch (err) {
      console.warn('[ai-gate] 保存模型排序失败', err)
      notifyBackendError(err)
      await loadModels(providerId)
    }
  }

  /** 按密钥拉取上游模型列表（经后端转发）；整体请求失败抛出，单把密钥失败在结果条目中标记 */
  async function fetchRemoteModels(providerId: number, keyIds?: number[]): Promise<SRemoteModelKeyFetch[]> {
    const query = keyIds?.length ? `?keys=${encodeURIComponent(keyIds.join(','))}` : ''
    const res = await api<{results: SRemoteModelKeyFetch[]}>(`/providers/${providerId}/models/remote${query}`)
    return res.results ?? []
  }

  /** 批量导入模型（后端跳过已存在编码）并落库密钥-模型绑定（只增不删） */
  async function importModels(
    providerId: number,
    inputs: SModelInput[],
    bindings: {keyId: number, codes: string[]}[] = [],
  ): Promise<{imported: number, skipped: number, bindings: number}> {
    return await api<{imported: number, skipped: number, bindings: number}>(
      `/providers/${providerId}/models/import`,
      {method: 'POST', body: JSON.stringify({models: inputs, bindings})},
    )
  }

  /** 测试模型可用性（经后端向上游发起最小生成请求）；失败抛出，由调用方按错误码就近提示 */
  async function testModel(providerId: number, id: number): Promise<SKeyTestResult> {
    return await api<SKeyTestResult>(`/providers/${providerId}/models/${id}/test`, {method: 'POST'})
  }

  return {
    providers,
    loading,
    load,
    fetchProvider,
    createProvider,
    updateProvider,
    removeProvider,
    toggleProvider,
    saveOrder,
    endpoints,
    keys,
    models,
    configLoading,
    resetConfig,
    loadAll,
    loadEndpoints,
    createEndpoint,
    updateEndpoint,
    removeEndpoint,
    loadKeys,
    createKey,
    updateKey,
    removeKey,
    saveKeyOrder,
    testKey,
    loadModels,
    createModel,
    updateModel,
    removeModel,
    saveModelOrder,
    fetchRemoteModels,
    importModels,
    testModel,
  }
})

export {isApiError}
