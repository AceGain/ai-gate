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

/** 新增时指定的初始生成端点（由服务端在创建事务内写入 sys_endpoint 并设为默认） */
export interface SysProviderGenerateEndpointInput {
  /** 生成端点类型，取值见 shared/sys-endpoint.ts 的 SYS_ENDPOINT_GENERATES */
  generate: string
  /** 端点地址，如 /v1/chat/completions */
  path: string
}

/** 新增时指定的初始密钥（由服务端在创建事务内写入 sys_key） */
export interface SysProviderKeyInput {
  /** 密钥名称 */
  name: string
  /** 密钥内容 */
  secret: string
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
  /** 新增时指定的初始生成端点（仅创建生效，更新时忽略） */
  generateEndpoint?: SysProviderGenerateEndpointInput
  /** 新增时指定的初始密钥（仅创建生效，更新时忽略） */
  apiKey?: SysProviderKeyInput
}

/** 生成唯一 id（浏览器与 Node 均可用） */
export function newId(): string {
  return crypto.randomUUID()
}
