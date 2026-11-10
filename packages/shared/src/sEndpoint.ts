/**
 * 出站供应商端点（S 域）共享类型与校验：s_endpoint 表的前后端共用结构
 * 仅包含生成端点；type 直接对应生成类型，基地址与模型列表路径属于 s_provider。
 */
import * as v from 'valibot'

/** 固定支持的生成端点类型（跨域取值词汇） */
export const GEN_ENDPOINT_TYPES = [
  'Chat Completions',
  'Responses',
  'Messages',
] as const

export type GenEndpointType = (typeof GEN_ENDPOINT_TYPES)[number]

/** 各生成端点类型对应的默认路径 */
export const GEN_ENDPOINT_DEFAULT_PATHS: Record<GenEndpointType, string> = {
  'Chat Completions': '/v1/chat/completions',
  'Responses': '/v1/responses',
  'Messages': '/v1/messages',
}

/** 出站供应商端点（s_endpoint 行结构的 camelCase 形态，API 载荷） */
export interface SEndpoint {
  id: number
  providerId: number
  type: string
  path: string
  /** 是否默认生成端点（同供应商内互斥） */
  isDefault: boolean
  sort: number
  createTime: string
  updateTime: string
}

/** 新增/更新出站端点的可写字段 */
export interface SEndpointInput {
  type: string
  path: string
  isDefault?: boolean
  sort?: number
}

const requiredText = v.pipe(v.string(), v.trim(), v.minLength(1))

/** 生成端点请求体：拒绝旧版功能类别，避免把旧载荷误写成生成类型。 */
export const SEndpointInputSchema = v.object({
  type: v.pipe(requiredText, v.check(value => !['base', 'models', 'generate'].includes(value))),
  path: requiredText,
  isDefault: v.optional(v.boolean(), false),
  sort: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
})
