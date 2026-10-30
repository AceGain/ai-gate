/**
 * 模板供应商端点（T 域）共享类型与校验：t_endpoint 表的前后端共用结构
 * kind 对应 BASE / MODEL / GEN
 * type 对应生成端点类型，例如 Chat Completions、Responses、Messages（非 GEN 时为 null）
 */
import * as v from 'valibot'

export type TEndpointKind = 'BASE' | 'MODEL' | 'GEN'

/** 模板供应商端点（t_endpoint 行结构的 camelCase 形态，API 载荷） */
export interface TEndpoint {
  id: number
  providerId: number
  kind: TEndpointKind
  type: string | null
  path: string
  isDefault: boolean
  sort: number
  /** 兼容别名：生成端点类型 */
  generate?: string
  /** 兼容别名：功能语义类型 base | models | generate */
  endpointType?: 'base' | 'models' | 'generate'
  createTime: string
  updateTime: string
}

/** 新增/更新模板端点的输入载荷 */
export interface TEndpointInput {
  kind?: TEndpointKind | 'base' | 'models' | 'generate'
  type?: string | null
  path: string
  isDefault?: boolean
  sort?: number
  /** 兼容别名输入：生成端点类型（若未传 type 则取 generate） */
  generate?: string
}

const requiredText = v.pipe(v.string(), v.trim(), v.minLength(1))

export const TEndpointInputSchema = v.object({
  kind: v.optional(v.picklist(['BASE', 'MODEL', 'GEN', 'base', 'models', 'generate']), 'GEN'),
  type: v.optional(v.nullable(v.string()), null),
  path: requiredText,
  isDefault: v.optional(v.boolean(), false),
  sort: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 0),
  generate: v.optional(v.string()),
})
