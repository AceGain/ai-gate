/**
 * 供应商端点共享类型：sys_endpoint 表的前后端共用结构
 * 注意：本文件不得引入 Nuxt/浏览器特有 API
 */

export type SysEndpointType = 'base' | 'models' | 'generate'

/** 固定支持的生成类型 */
export const SYS_ENDPOINT_GENERATES = [
  'Chat Completions',
  'Responses',
  'Messages'
] as const

export type SysEndpointGenerate = (typeof SYS_ENDPOINT_GENERATES)[number]

/** 各生成类型对应的默认路径 */
export const SYS_ENDPOINT_GENERATE_DEFAULT_PATHS: Record<SysEndpointGenerate, string> = {
  'Chat Completions': '/v1/chat/completions',
  'Responses': '/v1/responses',
  'Messages': '/v1/messages'
}

export interface SysEndpoint {
  id: string
  providerId: string
  type: SysEndpointType
  generate: string
  path: string
  isDefault: boolean
  createTime: string
  updateTime: string
}

export interface SysEndpointInput {
  type: SysEndpointType
  generate?: string
  path: string
  isDefault?: boolean
}
