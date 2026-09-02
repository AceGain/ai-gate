import type {
  ProviderConfig,
  ProviderKeyConfig,
  ProviderModelConfig,
  ProviderProtocolConfig,
  ProviderProtocolId,
  ProviderReasoningEffort
} from '~/utils/providers'
import {apiBase, protocolModelsEndpointDefaults} from '~/utils/providers'
import {defaultProviderIcon, isCustomIcon, legacyBrandIconKeys, providerIconOptions} from '~/utils/brandIcons'

/** 旧 localStorage 存储键：仅用于向后端的一次性数据迁移 */
const LEGACY_STORAGE_KEY = 'ai-gate:providers:v2'

/** 旧图标名迁移：i-simple-icons-xxx → xxx、旧版本地品牌 key（public/brands/*.svg）→ @lobehub/icons id；自定义上传图片（data:/http）原样保留；其余非法值归为首字母 fallback */
function migrateIcon(icon: string | undefined): string {
  if (!icon) return defaultProviderIcon
  if (isCustomIcon(icon)) return icon
  const key = legacyBrandIconKeys[icon] ?? icon.replace(/^i-simple-icons-/, '')
  return providerIconOptions.some(o => o.value === key) ? key : defaultProviderIcon
}

/** 旧端点迁移：协议级 modelsEndpoint 提升为供应商级；只保留 chatEndpoint */
function migrateEndpoints(p: Partial<ProviderConfig>): {
  endpoints: Partial<Record<ProviderProtocolId, ProviderProtocolConfig>>
  modelsEndpoint: string
} {
  const oldEndpoints = (p.endpoints ?? {}) as Partial<
    Record<ProviderProtocolId, ProviderProtocolConfig & { modelsEndpoint?: string }>
  >
  const protocols = p.protocols ?? []
  const endpoints: Partial<Record<ProviderProtocolId, ProviderProtocolConfig>> = {}
  let modelsEndpoint = p.modelsEndpoint ?? ''
  for (const key of Object.keys(oldEndpoints) as ProviderProtocolId[]) {
    const cfg = oldEndpoints[key]
    if (!cfg) continue
    endpoints[key] = {chatEndpoint: cfg.chatEndpoint}
    if (!modelsEndpoint && cfg.modelsEndpoint) modelsEndpoint = cfg.modelsEndpoint
  }
  if (!modelsEndpoint && protocols.length > 0) {
    modelsEndpoint = protocolModelsEndpointDefaults[protocols[0]!]
  }
  return {endpoints, modelsEndpoint}
}

/** 旧版（localStorage）数据结构归一化为 v2 完整结构 */
function normalizeLegacyList(list: Array<Partial<ProviderConfig>>): ProviderConfig[] {
  return list.map((p) => {
    const {endpoints, modelsEndpoint} = migrateEndpoints(p)
    return {
      ...p,
      enabled: p.enabled !== false,
      icon: migrateIcon(p.icon),
      remark: p.remark ?? '',
      endpoints,
      modelsEndpoint,
      // 兼容旧数据：密钥缺 name/expiresAt 时补默认值
      keys: (p.keys ?? []).map((k: Partial<ProviderKeyConfig>) => ({
        name: '',
        expiresAt: '',
        ...k
      })),
      // 兼容旧数据：模型缺省 reasoning 字段时补默认值；旧 reasoningEffort 单值迁移为多选数组
      models: Object.fromEntries(
        Object.entries(p.models ?? {}).map(([id, m]) => {
          const {reasoningEffort, ...rest} = m as Partial<ProviderModelConfig> & { reasoningEffort?: string }
          const cfg = {
            reasoning: false,
            reasoningEfforts: [] as ProviderReasoningEffort[], ...rest
          } as ProviderModelConfig
          if (reasoningEffort && !cfg.reasoningEfforts.length) {
            cfg.reasoningEfforts = [reasoningEffort as ProviderReasoningEffort]
          }
          return [id, cfg]
        })
      )
    }
  }) as ProviderConfig[]
}

/**
 * 供应商配置状态：useState 共享 + Hono 后端持久化（/api/providers）
 * 项目为 SPA（ssr: false），客户端初始化时异步拉取；详情页直接深层修改
 * provider 对象后调用 persist() 即可保存（300ms 防抖，全量替换）
 */
export function useProviders() {
  const providers = useState<ProviderConfig[]>('providers', () => [])
  const loaded = useState<boolean>('providers-loaded', () => false)
  const toast = useToast()
  const {t} = useI18n()

  if (import.meta.client && !loaded.value) {
    loaded.value = true
    void loadFromBackend()
  }

  /** 通知后端不可用（拉取与保存失败共用） */
  function notifyBackendError() {
    toast.add({color: 'error', title: t('providers.backendUnavailable')})
  }

  /** 初始加载：后端有数据直接用；为空且本地存有旧配置时执行一次性迁移 */
  async function loadFromBackend(): Promise<void> {
    try {
      const list = await $fetch<ProviderConfig[]>(`${apiBase()}/api/providers`)
      if (list.length > 0) {
        providers.value = list
        return
      }
      // 一次性迁移：localStorage 旧数据导入后端，成功后移除本地键避免重复导入
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
      if (!raw) return
      const migrated = normalizeLegacyList(JSON.parse(raw) as Array<Partial<ProviderConfig>>)
      if (migrated.length === 0) return
      providers.value = migrated
      await putProviders()
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch (err) {
      console.warn('[ai-gate] 加载供应商配置失败', err)
      notifyBackendError()
    }
  }

  /** 全量保存到后端 */
  async function putProviders(): Promise<void> {
    try {
      await $fetch(`${apiBase()}/api/providers`, {method: 'PUT', body: providers.value})
    } catch (err) {
      console.warn('[ai-gate] 保存供应商配置失败', err)
      notifyBackendError()
    }
  }

  let persistTimer: ReturnType<typeof setTimeout> | undefined

  /** 防抖持久化：详情页高频输入时避免逐字符全量提交 */
  function persist() {
    clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      void putProviders()
    }, 300)
  }

  /** 立即持久化（用于删除等需要保证落盘的时机） */
  function persistNow() {
    clearTimeout(persistTimer)
    void putProviders()
  }

  function getProvider(id: string): ProviderConfig | undefined {
    return providers.value.find(p => p.id === id)
  }

  function addProvider(provider: ProviderConfig) {
    providers.value.push(provider)
    persistNow()
  }

  function removeProvider(id: string) {
    providers.value = providers.value.filter(p => p.id !== id)
    persistNow()
  }

  return {providers, getProvider, addProvider, removeProvider, persist, persistNow}
}
