/**
 * 供应商模块（前端入口）：类型统一转发自 shared/sys-provider.ts
 * 品牌图标相关（选项列表 / URL 解析）见 brandIcons.ts（@lobehub/icons 静态 SVG）
 */

export type {
  SysProvider,
  SysProviderInput,
  SysProviderGenerateEndpointInput,
  SysProviderKeyInput
} from '../../shared/sys-provider'
export {
  SYS_ENDPOINT_GENERATES,
  SYS_ENDPOINT_GENERATE_DEFAULT_PATHS
} from '../../shared/sys-endpoint'
export type {
  SysEndpoint,
  SysEndpointInput,
  SysEndpointType,
  SysEndpointGenerate
} from '../../shared/sys-endpoint'
export type {SysKey, SysKeyInput, SysKeyStatus} from '../../shared/sys-key'
export {
  SYS_MODEL_MODALITIES,
  SYS_MODEL_EFFORT_LEVELS
} from '../../shared/sys-model'
export type {
  SysModel,
  SysModelInput,
  SysModelReasoning,
  SysModelStatus,
  SysModelType,
  SysModelModality,
  SysModelEffortLevel
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

/**
 * 将基地址与相对路径拼接为完整 URL，并返回拆分后的结构
 */
export function splitUrl(baseUrl?: string, path?: string): { basePart: string; pathPart: string; fullUrl: string } {
  if (!path) return {basePart: '', pathPart: '', fullUrl: ''}
  const trimmedPath = path.trim()
  if (!trimmedPath) return {basePart: '', pathPart: '', fullUrl: ''}

  if (/^https?:\/\//i.test(trimmedPath)) {
    try {
      const u = new URL(trimmedPath)
      const origin = u.origin
      const pathname = trimmedPath.slice(origin.length)
      return {basePart: origin, pathPart: pathname, fullUrl: trimmedPath}
    } catch {
      return {basePart: '', pathPart: trimmedPath, fullUrl: trimmedPath}
    }
  }

  const base = baseUrl?.trim()
  if (!base) {
    return {basePart: '', pathPart: trimmedPath, fullUrl: trimmedPath}
  }

  const baseNormalized = base.replace(/\/+$/, '')
  const subNormalized = trimmedPath.replace(/^\/+/, '')
  const full = `${baseNormalized}/${subNormalized}`
  return {basePart: baseNormalized, pathPart: `/${subNormalized}`, fullUrl: full}
}
