/**
 * 供应商模型共享类型：sys_model 表的前后端共用结构
 * 注意：本文件不得引入 Nuxt/浏览器特有 API
 */

export type SysModelStatus = 'ACTIVE' | 'INVALID'

export type SysModelType =
  | 'GenText'
  | 'GenImage'
  | 'GenAudio'
  | 'GenVideo'
  | 'Embedding'
  | 'Rerank'

export type SysModelReasoning = 'DISABLE' | 'ALWAYS' | 'SWITCH' | 'TOGGLE'

/** 固定支持的输入/输出模态类型 */
export const SYS_MODEL_MODALITIES = [
  'text',
  'image',
  'video',
  'audio',
  'pdf'
] as const

export type SysModelModality = (typeof SYS_MODEL_MODALITIES)[number]

/** 固定支持的推理档位 */
export const SYS_MODEL_EFFORT_LEVELS = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max'
] as const

export type SysModelEffortLevel = (typeof SYS_MODEL_EFFORT_LEVELS)[number]

export interface SysModel {
  id: string
  providerId: string
  code: string
  name: string
  category: string
  enabled: boolean
  status: SysModelStatus
  type: SysModelType
  inputModal: string[]
  outputModal: string[]
  generates: string[]
  maxContext: number
  maxInput: number
  maxOutput: number
  reasoning: SysModelReasoning
  effortLevel: string[]
  sort: number
  description: string
  createTime: string
  updateTime: string
}

export interface SysModelInput {
  code: string
  name?: string
  category?: string
  enabled?: boolean
  status?: SysModelStatus
  type: SysModelType
  inputModal?: string[]
  outputModal?: string[]
  generates?: string[]
  maxContext?: number
  maxInput?: number
  maxOutput?: number
  reasoning?: SysModelReasoning
  effortLevel?: string[]
  sort?: number
  description?: string
}
