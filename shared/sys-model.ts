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
  protocols: string[]
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
  protocols?: string[]
  maxContext?: number
  maxInput?: number
  maxOutput?: number
  reasoning?: SysModelReasoning
  effortLevel?: string[]
  sort?: number
  description?: string
}
