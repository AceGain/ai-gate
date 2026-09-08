/**
 * 供应商端点共享类型：sys_endpoint 表的前后端共用结构
 * 注意：本文件不得引入 Nuxt/浏览器特有 API
 */

export type SysEndpointType = 'base' | 'models' | 'protocol'

/** 固定支持的协议类型 */
export const SYS_ENDPOINT_PROTOCOLS = [
  'OpenAI/Chat Completions',
  'OpenAI/Responses',
  'Anthropic/Messages'
] as const

export type SysEndpointProtocol = (typeof SYS_ENDPOINT_PROTOCOLS)[number]

/** 各协议对应的默认路径 */
export const SYS_ENDPOINT_PROTOCOL_DEFAULT_PATHS: Record<SysEndpointProtocol, string> = {
  'OpenAI/Chat Completions': '/v1/chat/completions',
  'OpenAI/Responses': '/v1/responses',
  'Anthropic/Messages': '/v1/messages'
}

export interface SysEndpoint {
  id: string
  providerId: string
  type: SysEndpointType
  protocol: string
  path: string
  isDefault: boolean
  createTime: string
  updateTime: string
}

export interface SysEndpointInput {
  type: SysEndpointType
  protocol?: string
  path: string
  isDefault?: boolean
}
