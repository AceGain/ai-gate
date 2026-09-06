/**
 * 供应商密钥共享类型：sys_key 表的前后端共用结构
 * 注意：本文件不得引入 Nuxt/浏览器特有 API
 */

export type SysKeyStatus = 'ACTIVE' | 'INVALID'

export interface SysKey {
  id: string
  providerId: string
  name: string
  secret: string
  enabled: boolean
  status: SysKeyStatus
  expiresTime: string | null
  sort: number
  description: string
  createTime: string
  updateTime: string
}

export interface SysKeyInput {
  name: string
  secret: string
  enabled?: boolean
  status?: SysKeyStatus
  expiresTime?: string | null
  sort?: number
  description?: string
}
