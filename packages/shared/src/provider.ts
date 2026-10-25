/**
 * 供应商共享类型与校验：s_provider 表的前后端共用结构（camelCase API 形态）
 * 注意：本文件不得引入 Node/浏览器特有 API
 */
import * as v from 'valibot'

/** 供应商状态；ACTIVE：正常，INACTIVE：不可用,ERROR：异常 */
export type ProviderStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR'

/** 供应商（s_provider 行结构的 camelCase 形态，API 载荷） */
export interface Provider {
  /** 自增主键（路由与持久化标识） */
  id: number
  /** 编码；对外模型标识前缀，如 agnes/agnes-2.5-flash，唯一且创建后不可变 */
  code: string
  name: string
  /** 品牌图标 id；空串时前端首字母 fallback */
  icon: string
  enabled: boolean
  status: ProviderStatus
  /** 描述备注 */
  remark: string
  /** 排序值，升序 */
  sort: number
  /** 创建时间（'YYYY-MM-DD HH:MM:SS'，UTC，由应用层维护） */
  createTime: string
  /** 更新时间（每次更新由服务端刷新） */
  updateTime: string
}

/** 新增时指定的初始生成端点（由服务端在创建事务内写入 s_endpoint 并设为默认） */
export interface ProviderGenerateEndpointInput {
  /** 生成端点类型，取值见 endpoint.ts 的 GEN_ENDPOINT_TYPES */
  generate: string
  /** 端点地址，如 /v1/chat/completions */
  path: string
}

/** 新增时指定的初始密钥（由服务端在创建事务内写入 s_key） */
export interface ProviderKeyInput {
  /** 密钥名称 */
  name: string
  /** 密钥内容 */
  secret: string
}

/** 新增供应商的可写字段（id 与时间戳由服务端维护） */
export interface ProviderCreateInput {
  code: string
  name: string
  icon?: string
  enabled?: boolean
  remark?: string
  sort?: number
  /** 新增时指定的基础端点 URL（由服务端写入 s_endpoint 表） */
  baseUrl?: string
  /** 新增时指定的初始生成端点（仅创建生效） */
  generateEndpoint?: ProviderGenerateEndpointInput
  /** 新增时指定的初始密钥（仅创建生效） */
  apiKey?: ProviderKeyInput
}

/** 更新供应商的可写字段（code 与时间戳由服务端维护，code 更新时忽略） */
export interface ProviderUpdateInput {
  code: string
  name: string
  icon?: string
  enabled?: boolean
  remark?: string
  sort?: number
}

const requiredText = v.pipe(v.string(), v.trim(), v.minLength(1))

/** 新增供应商请求体 */
export const ProviderCreateSchema = v.object({
  code: requiredText,
  name: requiredText,
  baseUrl: requiredText,
  icon: v.optional(v.string(), ''),
  enabled: v.optional(v.boolean(), false),
  remark: v.optional(v.string(), ''),
  sort: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 0),
  generateEndpoint: v.optional(v.object({
    generate: requiredText,
    path: requiredText,
  })),
  apiKey: v.optional(v.object({
    name: requiredText,
    secret: requiredText,
  })),
})

/** 更新供应商请求体（code 仅占位，服务端忽略） */
export const ProviderUpdateSchema = v.object({
  code: v.string(),
  name: requiredText,
  icon: v.optional(v.string(), ''),
  enabled: v.optional(v.boolean(), false),
  remark: v.optional(v.string(), ''),
  sort: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 0),
})

/** 批量排序请求体：[{id, sort}]（供应商/密钥/模型共用） */
export const ReorderSchema = v.array(v.object({
  id: v.pipe(v.number(), v.integer()),
  sort: v.pipe(v.number(), v.integer(), v.minValue(0)),
}))
