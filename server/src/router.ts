/**
 * 网关路由：按模型名解析供应商 / 密钥 / 协议 / 上游 URL
 * 规则：启用供应商 + 启用模型 + 可用密钥（未过期且勾选了该模型），取第一个命中
 */
import type {ProviderConfig, ProviderKeyConfig, ProviderProtocolId} from '../../shared/providers'
import {joinUrl, protocolDefaults} from '../../shared/providers'

export interface RouteTarget {
  provider: ProviderConfig
  key: ProviderKeyConfig
  protocol: ProviderProtocolId
  /** 完整上游请求地址（gemini 的 {model} 占位符已替换） */
  url: string
}

/** 密钥是否可用于该模型：已勾选启用且未过期 */
function isKeyUsable(key: ProviderKeyConfig, model: string): boolean {
  if (!key.enabledModels.includes(model)) return false
  if (!key.expiresAt) return true
  return key.expiresAt >= new Date().toISOString().slice(0, 10)
}

/** 按模型解析路由目标；无可用目标返回 null */
export function resolveModel(providers: ProviderConfig[], model: string): RouteTarget | null {
  for (const provider of providers) {
    if (!provider.enabled) continue
    const modelConfig = provider.models[model]
    if (!modelConfig?.enabled) continue
    const protocol = modelConfig.protocols.find(p => provider.protocols.includes(p))
    if (!protocol) continue
    const key = provider.keys.find(k => isKeyUsable(k, model))
    if (!key) continue
    const chatEndpoint = provider.endpoints[protocol]?.chatEndpoint ?? protocolDefaults[protocol].chatEndpoint
    const url = joinUrl(provider.baseUrl, chatEndpoint).replace('{model}', encodeURIComponent(model))
    return {provider, key, protocol, url}
  }
  return null
}

/** 汇总网关对外可用的模型（用于 /v1/models 列表；同 id 多供应商时去重） */
export function collectEnabledModels(providers: ProviderConfig[]): { model: string; providerId: string }[] {
  const seen = new Set<string>()
  const result: { model: string; providerId: string }[] = []
  for (const provider of providers) {
    if (!provider.enabled) continue
    for (const [model, config] of Object.entries(provider.models)) {
      if (!config?.enabled || seen.has(model)) continue
      if (!provider.keys.some(k => isKeyUsable(k, model))) continue
      seen.add(model)
      result.push({model, providerId: provider.providerId})
    }
  }
  return result
}
