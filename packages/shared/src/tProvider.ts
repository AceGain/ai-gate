/**
 * 模板供应商（T 域）共享类型与校验：t_provider 表的前后端共用结构（camelCase API 形态）
 * 领域命名约定见 index.ts：t_ 模板 / s_ 出站 / r_ 入站，类型随之 T、S、R 前缀，不得互相简化合并
 * 注意：本文件不得引入 Node/浏览器特有 API
 */
import * as v from 'valibot'
import type { ProviderStatus } from './sProvider.js'
import type { TEndpointInput } from './tEndpoint.js'

/** 模板供应商（t_provider 行结构的 camelCase 形态，API 载荷） */
export interface TProvider {
  /** 自增主键（持久化标识） */
  id: number
  /** 编码；对外唯一模型前缀标识，如 openai, anthropic, deepseek */
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
  /** 创建时间（'YYYY-MM-DD HH:MM:SS'，UTC） */
  createTime: string
  /** 更新时间 */
  updateTime: string
}

/** 新增时指定的初始生成端点 */
export interface TProviderGenerateEndpointInput {
  generate: string
  path: string
}

/** 新增模板供应商的可写字段 */
export interface TProviderCreateInput {
  code: string
  name: string
  icon?: string
  enabled?: boolean
  status?: ProviderStatus
  remark?: string
  sort?: number
  /** 新增时指定的基础端点 URL（由服务端写入 t_endpoint 表） */
  baseUrl?: string
  /** 新增时指定的模型列表端点 URL（缺省为 /v1/models） */
  modelsUrl?: string
  /** 新增时指定的初始生成端点（仅创建生效） */
  generateEndpoint?: TProviderGenerateEndpointInput
  /** 新增时批量指定的端点列表 */
  endpoints?: TEndpointInput[]
}

/** 更新模板供应商的可写字段（code 创建后不可变，更新时忽略） */
export interface TProviderUpdateInput {
  code?: string
  name?: string
  icon?: string
  enabled?: boolean
  status?: ProviderStatus
  remark?: string
  sort?: number
}

const requiredText = v.pipe(v.string(), v.trim(), v.minLength(1))

/** 新增模板供应商请求体 */
export const TProviderCreateSchema = v.object({
  code: requiredText,
  name: requiredText,
  icon: v.optional(v.string(), ''),
  enabled: v.optional(v.boolean(), false),
  status: v.optional(v.picklist(['ACTIVE', 'INACTIVE', 'ERROR']), 'ACTIVE'),
  remark: v.optional(v.string(), ''),
  sort: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 0),
  baseUrl: v.optional(v.string()),
  modelsUrl: v.optional(v.string()),
  generateEndpoint: v.optional(v.object({
    generate: requiredText,
    path: requiredText,
  })),
  endpoints: v.optional(v.array(v.object({
    kind: v.optional(v.picklist(['BASE', 'MODEL', 'GEN', 'base', 'models', 'generate'])),
    type: v.optional(v.nullable(v.string())),
    path: requiredText,
    isDefault: v.optional(v.boolean(), false),
    sort: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 0),
    generate: v.optional(v.string()),
  }))),
})

/** 更新模板供应商请求体 */
export const TProviderUpdateSchema = v.object({
  code: v.optional(v.string()),
  name: v.optional(requiredText),
  icon: v.optional(v.string()),
  enabled: v.optional(v.boolean()),
  status: v.optional(v.picklist(['ACTIVE', 'INACTIVE', 'ERROR'])),
  remark: v.optional(v.string()),
  sort: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
})

/** 批量排序请求体：[{id, sort}] */
export const TReorderSchema = v.array(v.object({
  id: v.pipe(v.number(), v.integer()),
  sort: v.pipe(v.number(), v.integer(), v.minValue(0)),
}))
