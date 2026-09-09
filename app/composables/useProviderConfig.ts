import type {
  SysEndpoint,
  SysEndpointInput,
  SysKey,
  SysKeyInput,
  SysModel,
  SysModelInput
} from '~/utils/providers'
import {apiBase} from '~/utils/providers'

export function useProviderConfig() {
  const endpoints = useState<SysEndpoint[]>('provider-endpoints', () => [])
  const keys = useState<SysKey[]>('provider-keys', () => [])
  const models = useState<SysModel[]>('provider-models', () => [])
  const loading = useState<boolean>('provider-config-loading', () => false)

  const toast = useToast()
  const {t} = useI18n()

  function notifyError() {
    toast.add({color: 'error', title: t('providers.backendUnavailable')})
  }

  function reset() {
    endpoints.value = []
    keys.value = []
    models.value = []
    loading.value = false
  }

  async function loadAll(providerId: string): Promise<void> {
    if (!providerId) return
    loading.value = true
    try {
      const [epList, keyList, modelList] = await Promise.all([
        $fetch<SysEndpoint[]>(`${apiBase()}/api/providers/${providerId}/endpoints`),
        $fetch<SysKey[]>(`${apiBase()}/api/providers/${providerId}/keys`),
        $fetch<SysModel[]>(`${apiBase()}/api/providers/${providerId}/models`)
      ])
      endpoints.value = epList
      keys.value = keyList
      models.value = modelList
    } catch (err) {
      console.warn('[ai-gate] 加载供应商配置失败', err)
      notifyError()
    } finally {
      loading.value = false
    }
  }

  /* ---------------- 端点 (Endpoints) ---------------- */

  async function createEndpoint(providerId: string, input: SysEndpointInput): Promise<SysEndpoint> {
    const created = await $fetch<SysEndpoint>(`${apiBase()}/api/providers/${providerId}/endpoints`, {
      method: 'POST',
      body: input
    })
    // 重新拉取以保证 is_default 联动正确排序
    await loadEndpoints(providerId)
    return created
  }

  async function updateEndpoint(providerId: string, id: string, input: SysEndpointInput): Promise<SysEndpoint> {
    const updated = await $fetch<SysEndpoint>(`${apiBase()}/api/providers/${providerId}/endpoints/${id}`, {
      method: 'PUT',
      body: input
    })
    await loadEndpoints(providerId)
    return updated
  }

  async function removeEndpoint(providerId: string, id: string): Promise<void> {
    try {
      await $fetch(`${apiBase()}/api/providers/${providerId}/endpoints/${id}`, {method: 'DELETE'})
      endpoints.value = endpoints.value.filter(e => e.id !== id)
      toast.add({color: 'success', title: t('common.deleted')})
    } catch (err) {
      console.warn('[ai-gate] 删除端点失败', err)
      notifyError()
    }
  }

  async function loadEndpoints(providerId: string): Promise<void> {
    try {
      endpoints.value = await $fetch<SysEndpoint[]>(`${apiBase()}/api/providers/${providerId}/endpoints`)
    } catch (err) {
      console.warn('[ai-gate] 加载端点失败', err)
      notifyError()
    }
  }

  /* ---------------- 密钥 (Keys) ---------------- */

  async function createKey(providerId: string, input: SysKeyInput): Promise<SysKey> {
    const sort = keys.value.length ? Math.max(...keys.value.map(k => k.sort)) + 1 : 0
    const created = await $fetch<SysKey>(`${apiBase()}/api/providers/${providerId}/keys`, {
      method: 'POST',
      body: {...input, sort}
    })
    keys.value = [...keys.value, created]
    return created
  }

  async function updateKey(providerId: string, id: string, input: SysKeyInput): Promise<SysKey> {
    const updated = await $fetch<SysKey>(`${apiBase()}/api/providers/${providerId}/keys/${id}`, {
      method: 'PUT',
      body: input
    })
    const index = keys.value.findIndex(k => k.id === id)
    if (index !== -1) {
      const list = [...keys.value]
      list[index] = updated
      keys.value = list
    }
    return updated
  }

  async function removeKey(providerId: string, id: string): Promise<void> {
    try {
      await $fetch(`${apiBase()}/api/providers/${providerId}/keys/${id}`, {method: 'DELETE'})
      keys.value = keys.value.filter(k => k.id !== id)
      toast.add({color: 'success', title: t('common.deleted')})
    } catch (err) {
      console.warn('[ai-gate] 删除密钥失败', err)
      notifyError()
    }
  }

  async function loadKeys(providerId: string): Promise<void> {
    try {
      keys.value = await $fetch<SysKey[]>(`${apiBase()}/api/providers/${providerId}/keys`)
    } catch (err) {
      console.warn('[ai-gate] 加载密钥失败', err)
      notifyError()
    }
  }

  async function saveKeyOrder(providerId: string): Promise<void> {
    try {
      await $fetch(`${apiBase()}/api/providers/${providerId}/keys/reorder`, {
        method: 'PUT',
        body: keys.value.map((k, index) => ({id: k.id, sort: index}))
      })
    } catch (err) {
      console.warn('[ai-gate] 保存密钥排序失败', err)
      notifyError()
      await loadKeys(providerId)
    }
  }

  /* ---------------- 模型 (Models) ---------------- */

  async function createModel(providerId: string, input: SysModelInput): Promise<SysModel> {
    const sort = models.value.length ? Math.max(...models.value.map(m => m.sort)) + 1 : 0
    const created = await $fetch<SysModel>(`${apiBase()}/api/providers/${providerId}/models`, {
      method: 'POST',
      body: {...input, sort}
    })
    models.value = [...models.value, created]
    return created
  }

  async function updateModel(providerId: string, id: string, input: SysModelInput): Promise<SysModel> {
    const updated = await $fetch<SysModel>(`${apiBase()}/api/providers/${providerId}/models/${id}`, {
      method: 'PUT',
      body: input
    })
    const index = models.value.findIndex(m => m.id === id)
    if (index !== -1) {
      const list = [...models.value]
      list[index] = updated
      models.value = list
    }
    return updated
  }

  async function removeModel(providerId: string, id: string): Promise<void> {
    try {
      await $fetch(`${apiBase()}/api/providers/${providerId}/models/${id}`, {method: 'DELETE'})
      models.value = models.value.filter(m => m.id !== id)
      toast.add({color: 'success', title: t('common.deleted')})
    } catch (err) {
      console.warn('[ai-gate] 删除模型失败', err)
      notifyError()
    }
  }

  async function loadModels(providerId: string): Promise<void> {
    try {
      models.value = await $fetch<SysModel[]>(`${apiBase()}/api/providers/${providerId}/models`)
    } catch (err) {
      console.warn('[ai-gate] 加载模型失败', err)
      notifyError()
    }
  }

  async function saveModelOrder(providerId: string): Promise<void> {
    try {
      await $fetch(`${apiBase()}/api/providers/${providerId}/models/reorder`, {
        method: 'PUT',
        body: models.value.map((m, index) => ({id: m.id, sort: index}))
      })
    } catch (err) {
      console.warn('[ai-gate] 保存模型排序失败', err)
      notifyError()
      await loadModels(providerId)
    }
  }

  return {
    endpoints,
    keys,
    models,
    loading,
    reset,
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
    loadModels,
    createModel,
    updateModel,
    removeModel,
    saveModelOrder
  }
}
