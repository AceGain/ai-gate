/**
 * 供应商端点共享类型与校验：s_endpoint 表的前后端共用结构
 * API 沿用功能语义命名：type（base/models/generate 三类）+ generate（生成端点类型），
 * 服务端存储时映射为表的 kind（BASE/MODEL/GEN）+ type（Chat Completions/Responses/Messages）
 */
import * as v from 'valibot'

/** 端点类别：base = 基地址，models = 模型列表，generate = 生成路径 */
export type EndpointType = 'base' | 'models' | 'generate'

/** 固定支持的生成端点类型 */
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

/** 端点（s_endpoint 行结构的 camelCase 形态，API 载荷） */
export interface Endpoint {
  id: number
  providerId: number
  type: EndpointType
  /** 生成端点类型；非 generate 端点为空串 */
  generate: string
  path: string
  /** 是否默认生成端点（仅 generate 端点有意义，同供应商内互斥） */
  isDefault: boolean
  createTime: string
  updateTime: string
}

/** 新增/更新端点的可写字段 */
export interface EndpointInput {
  type: EndpointType
  generate?: string
  path: string
  isDefault?: boolean
}

const requiredText = v.pipe(v.string(), v.trim(), v.minLength(1))

/** 端点请求体：generate 仅 generate 类别必填 */
export const EndpointInputSchema = v.pipe(
  v.object({
    type: v.picklist(['base', 'models', 'generate']),
    generate: v.optional(v.string(), ''),
    path: requiredText,
    isDefault: v.optional(v.boolean(), false),
  }),
  v.check(
    input => input.type !== 'generate' || !!input.generate,
    'generate 端点必须指定生成端点类型',
  ),
)
