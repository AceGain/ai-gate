/**
 * 供应商模块（前端入口）：类型统一转发自 shared/sys-provider.ts
 * 品牌图标相关（选项列表 / URL 解析）见 brandIcons.ts（@lobehub/icons 静态 SVG）
 */

export type {
  SysProvider,
  SysProviderInput,
  SysProviderProtocolEndpointInput,
  SysProviderKeyInput
} from '../../shared/sys-provider'
export {
  SYS_ENDPOINT_PROTOCOLS,
  SYS_ENDPOINT_PROTOCOL_DEFAULT_PATHS
} from '../../shared/sys-endpoint'
export type {
  SysEndpoint,
  SysEndpointInput,
  SysEndpointType,
  SysEndpointProtocol
} from '../../shared/sys-endpoint'
export type {SysKey, SysKeyInput, SysKeyStatus} from '../../shared/sys-key'
export type {
  SysModel,
  SysModelInput,
  SysModelReasoning,
  SysModelStatus,
  SysModelType
} from '../../shared/sys-model'
export type {SysKeyModel} from '../../shared/sys-key-model'

/**
 * 后端 API 基地址：默认同源（dev 经 Nuxt devProxy 代理，生产由 Hono 直接服务静态资源与 API）
 * Tauri 桌面端（webview 源与后端不同源）构建时通过 VITE_API_BASE 指向后端地址
 */
export function apiBase(): string {
  const base = import.meta.env.VITE_API_BASE as string | undefined
  return base ?? ''
}
