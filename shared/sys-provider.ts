/**
 * 供应商共享类型：sys_provider 表的前后端共用结构
 * 注意：本文件不得引入 Nuxt/浏览器特有 API
 */

/** 供应商（sys_provider 行结构的 camelCase 形态，API 载荷） */
export interface SysProvider {
  /** UUID（路由与持久化主键） */
  id: string
  /** 编码；对外模型标识前缀，如 agnes/agnes-2.5-flash */
  code: string
  name: string
  /** 品牌图标 id；空串时前端首字母 fallback */
  icon: string
  enabled: boolean
  description: string
  /** 排序值，升序 */
  sort: number
  /** 创建时间（'YYYY-MM-DD HH:MM:SS'，UTC，由数据库维护） */
  createTime: string
  /** 更新时间（每次更新由服务端刷新） */
  updateTime: string
}

/** 新增/更新供应商的可写字段（id 与时间戳由服务端维护） */
export interface SysProviderInput {
  code: string
  name: string
  icon?: string
  enabled?: boolean
  description?: string
  sort?: number
  /** 新增时指定的基础端点 URL（由服务端写入 sys_endpoint 表） */
  baseUrl?: string
}

/** 生成唯一 id（浏览器与 Node 均可用） */
export function newId(): string {
  return crypto.randomUUID()
}
