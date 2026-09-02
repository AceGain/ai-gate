/**
 * 供应商配置模块（前端入口）：类型、协议元数据、预置供应商统一转发自 shared/providers.ts
 * 流程：新增页仅配置基本信息 → 详情页分层配置协议端点 / 密钥 / 模型
 * 品牌图标相关（选项列表 / URL 解析）见 brandIcons.ts（@lobehub/icons 静态 SVG）
 */

export * from '../../shared/providers'

/**
 * 后端 API 基地址：默认同源（dev 经 Nuxt devProxy 代理，生产由 Hono 直接服务静态资源与 API）
 * Tauri 桌面端（webview 源与后端不同源）构建时通过 VITE_API_BASE 指向后端地址
 */
export function apiBase(): string {
  const base = import.meta.env.VITE_API_BASE as string | undefined
  return base ?? ''
}

/**
 * 使用密钥按指定协议拉取该供应商支持的模型列表
 * 经 Hono 后端转发（/api/fetch-models），规避浏览器/Tauri webview 的 CORS 限制
 */
export async function fetchProviderModels(
  baseUrl: string,
  protocol: import('../../shared/providers').ProviderProtocolId,
  modelsEndpoint: string,
  apiKey: string
): Promise<string[]> {
  const json = await $fetch<{ models: string[] }>(`${apiBase()}/api/fetch-models`, {
    method: 'POST',
    body: {baseUrl, protocol, modelsEndpoint, apiKey}
  })
  return json.models
}
