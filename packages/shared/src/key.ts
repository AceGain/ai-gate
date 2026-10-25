/**
 * 供应商密钥共享类型与校验：s_key 表的前后端共用结构
 * 注意：本文件不得引入 Node/浏览器特有 API
 */
import * as v from 'valibot'

/** 密钥状态；ACTIVE：正常，INACTIVE：不可用，EXPIRED：过期 */
export type KeyStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED'

/** 密钥（s_key 行结构的 camelCase 形态，API 载荷） */
export interface ApiKey {
  id: number
  providerId: number
  name: string
  secret: string
  enabled: boolean
  status: KeyStatus
  /** 过期时间（'YYYY-MM-DD'）；null = 永久有效 */
  expireTime: string | null
  sort: number
  createTime: string
  updateTime: string
}

/** 新增/更新密钥的可写字段 */
export interface ApiKeyInput {
  name: string
  secret: string
  enabled?: boolean
  status?: KeyStatus
  expireTime?: string | null
  sort?: number
}

const requiredText = v.pipe(v.string(), v.trim(), v.minLength(1))

/** 密钥请求体 */
export const ApiKeyInputSchema = v.object({
  name: requiredText,
  secret: requiredText,
  enabled: v.optional(v.boolean(), true),
  status: v.optional(v.picklist(['ACTIVE', 'INACTIVE', 'EXPIRED']), 'ACTIVE'),
  expireTime: v.optional(v.nullable(v.pipe(v.string(), v.trim())), null),
  sort: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 0),
})

/** 密钥测试结果 */
export interface KeyTestResult {
  ok: true
  latencyMs: number
}
