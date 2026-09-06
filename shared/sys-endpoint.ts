/**
 * 供应商端点共享类型：sys_endpoint 表的前后端共用结构
 * 注意：本文件不得引入 Nuxt/浏览器特有 API
 */

export type SysEndpointType = 'base' | 'models' | 'protocol'

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
