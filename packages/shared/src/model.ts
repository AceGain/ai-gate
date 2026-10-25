/**
 * 供应商模型共享类型与校验：s_model 表的前后端共用结构
 * 能力字段（模态/Token 限制/推理）在 API 上为扁平 camelCase，
 * 服务端存储时合并进表的 config JSON 列；generates 对应表的 gen_type JSON 列
 */
import * as v from 'valibot'

/** 模型状态；ACTIVE：正常，INACTIVE：不可用，ERROR：异常 */
export type ModelStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR'

/** 模型类型 */
export type ModelType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'EMBEDDING' | 'RERANK'

/** 推理模式 */
export type ModelReasoning = 'DISABLE' | 'ALWAYS' | 'SWITCH' | 'TOGGLE'

/** 未指定分组时的默认模型分组（固定标识符，不随界面语言本地化） */
export const MODEL_DEFAULT_CATEGORY = 'Default'

/** 固定支持的输入/输出模态类型 */
export const MODEL_MODALITIES = [
  'text',
  'image',
  'video',
  'audio',
  'pdf',
] as const

export type ModelModality = (typeof MODEL_MODALITIES)[number]

/** 固定支持的推理档位 */
export const MODEL_EFFORT_LEVELS = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const

export type ModelEffortLevel = (typeof MODEL_EFFORT_LEVELS)[number]

/** 模型（s_model 行结构的 camelCase 形态，API 载荷） */
export interface Model {
  id: number
  providerId: number
  /** 对外编码，供应商内唯一，创建后不可变 */
  code: string
  /** 显示名称，空串时前端回退展示编码 */
  name: string
  category: string
  enabled: boolean
  status: ModelStatus
  type: ModelType
  inputModal: string[]
  outputModal: string[]
  /** 支持的生成端点类型（对应 gen_type 列） */
  generates: string[]
  maxContext: number
  maxInput: number
  maxOutput: number
  reasoning: ModelReasoning
  effortLevel: string[]
  sort: number
  /** 描述备注（对应 remark 列） */
  remark: string
  createTime: string
  updateTime: string
}

/** 新增/更新模型的可写字段 */
export interface ModelInput {
  code: string
  name?: string
  category?: string
  enabled?: boolean
  status?: ModelStatus
  type: ModelType
  inputModal?: string[]
  outputModal?: string[]
  generates?: string[]
  maxContext?: number
  maxInput?: number
  maxOutput?: number
  reasoning?: ModelReasoning
  effortLevel?: string[]
  sort?: number
  remark?: string
}

/** 从供应商模型列表端点（如 /v1/models）拉取到的模型条目 */
export interface RemoteModelItem {
  /** 模型编码（上游返回的 id） */
  code: string
  /** 上游提供的显示名（如 Anthropic 的 display_name），无则为空串 */
  name: string
}

/** 按单把密钥拉取上游模型列表的结果（models/remote 分组返回的条目） */
export interface RemoteModelKeyFetch {
  keyId: number
  keyName: string
  ok: boolean
  /** 成功时的去重模型列表 */
  models: RemoteModelItem[]
  /** 失败时的错误码（UPSTREAM_TIMEOUT / UPSTREAM_UNREACHABLE / UPSTREAM_ERROR / UPSTREAM_INVALID_RESPONSE / KEY_INACTIVE） */
  error?: string
  /** 失败时的上游错误详情 */
  detail?: string
}

const requiredText = v.pipe(v.string(), v.trim(), v.minLength(1))
const nonNegativeInt = v.pipe(v.number(), v.integer(), v.minValue(0))

/** 模型请求体 */
export const ModelInputSchema = v.object({
  code: requiredText,
  name: v.optional(v.string(), ''),
  category: v.optional(v.string(), MODEL_DEFAULT_CATEGORY),
  enabled: v.optional(v.boolean(), true),
  status: v.optional(v.picklist(['ACTIVE', 'INACTIVE', 'ERROR']), 'ACTIVE'),
  type: v.picklist(['TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'EMBEDDING', 'RERANK']),
  inputModal: v.optional(v.array(v.string()), ['text']),
  outputModal: v.optional(v.array(v.string()), ['text']),
  generates: v.optional(v.array(v.string()), []),
  maxContext: v.optional(nonNegativeInt, 0),
  maxInput: v.optional(nonNegativeInt, 0),
  maxOutput: v.optional(nonNegativeInt, 0),
  reasoning: v.optional(v.picklist(['DISABLE', 'ALWAYS', 'SWITCH', 'TOGGLE']), 'TOGGLE'),
  effortLevel: v.optional(v.array(v.string()), []),
  sort: v.optional(nonNegativeInt, 0),
  remark: v.optional(v.string(), ''),
})

/** 批量导入模型请求体：模型列表 + 密钥-模型绑定（随导入写入 s_relat，只增不删） */
export const ModelImportSchema = v.object({
  models: v.array(v.object({
    code: requiredText,
    name: v.optional(v.string(), ''),
    type: v.picklist(['TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'EMBEDDING', 'RERANK']),
  })),
  bindings: v.optional(v.array(v.object({
    keyId: v.pipe(v.number(), v.integer()),
    codes: v.array(requiredText),
  })), []),
})
