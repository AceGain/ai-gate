/**
 * 模板模型（T 域）共享类型与校验：t_model 表的前后端共用结构
 * 包含模型基础信息、gen_type（支持的生成端点类型列表）以及 config（模态、Token 限制、推理模式配置）
 */
import * as v from 'valibot'
import type { ModelReasoning, ModelStatus, ModelType } from './sModel.js'
import { MODEL_DEFAULT_CATEGORY } from './sModel.js'

/** t_model.config 列的 JSON 结构 */
export interface TModelConfig {
  inputModal?: string[]
  outputModal?: string[]
  maxContext?: number
  maxInput?: number
  maxOutput?: number
  reasoning?: ModelReasoning
  effortLevel?: string[]
  [key: string]: unknown
}

/** 模板模型（t_model 行结构的 camelCase 形态，API 载荷） */
export interface TModel {
  id: number
  providerId: number
  /** 对外编码，如 gpt-4o, claude-3-5-sonnet */
  code: string
  /** 显示名称，空串时回退展示编码 */
  name: string
  category: string
  enabled: boolean
  status: ModelStatus
  type: ModelType
  /** 支持的生成端点类型列表（对应 gen_type JSON 列） */
  genType: string[]
  /** 兼容别名（对齐 SModel.generates） */
  generates: string[]
  /** 模型完整配置对象（对应 config JSON 列） */
  config: TModelConfig
  /** 模态与限制便捷扁平字段 */
  inputModal: string[]
  outputModal: string[]
  maxContext: number
  maxInput: number
  maxOutput: number
  reasoning: ModelReasoning
  effortLevel: string[]
  remark: string
  sort: number
  createTime: string
  updateTime: string
}

/** 新增/更新模板模型的输入载荷 */
export interface TModelInput {
  code: string
  name?: string
  category?: string
  enabled?: boolean
  status?: ModelStatus
  type: ModelType
  genType?: string[]
  generates?: string[]
  config?: TModelConfig
  inputModal?: string[]
  outputModal?: string[]
  maxContext?: number
  maxInput?: number
  maxOutput?: number
  reasoning?: ModelReasoning
  effortLevel?: string[]
  remark?: string
  sort?: number
}

const requiredText = v.pipe(v.string(), v.trim(), v.minLength(1))
const nonNegativeInt = v.pipe(v.number(), v.integer(), v.minValue(0))

export const TModelInputSchema = v.object({
  code: requiredText,
  name: v.optional(v.string(), ''),
  category: v.optional(v.string(), MODEL_DEFAULT_CATEGORY),
  enabled: v.optional(v.boolean(), false),
  status: v.optional(v.picklist(['ACTIVE', 'INACTIVE', 'ERROR']), 'ACTIVE'),
  type: v.picklist(['TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'EMBEDDING', 'RERANK']),
  genType: v.optional(v.array(v.string())),
  generates: v.optional(v.array(v.string())),
  config: v.optional(v.record(v.string(), v.unknown())),
  inputModal: v.optional(v.array(v.string())),
  outputModal: v.optional(v.array(v.string())),
  maxContext: v.optional(nonNegativeInt),
  maxInput: v.optional(nonNegativeInt),
  maxOutput: v.optional(nonNegativeInt),
  reasoning: v.optional(v.picklist(['DISABLE', 'ALWAYS', 'SWITCH', 'TOGGLE'])),
  effortLevel: v.optional(v.array(v.string())),
  remark: v.optional(v.string(), ''),
  sort: v.optional(nonNegativeInt, 0),
})

/** 批量导入模型请求体 */
export const TModelImportSchema = v.object({
  models: v.array(TModelInputSchema),
})
