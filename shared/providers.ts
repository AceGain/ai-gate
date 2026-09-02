/**
 * 供应商配置共享模块：类型定义、协议元数据、预置供应商
 * 前端（app/utils/providers.ts 转发导出）与后端（server/）共用，保持类型单一来源
 * 注意：本文件不得引入 Nuxt/浏览器特有 API（如 $fetch / import.meta.env）
 */

/** 网关支持的请求协议 */
export type ProviderProtocolId = 'openai' | 'anthropic' | 'gemini'

/** 模型输入/输出模态 */
export type ProviderModality = 'text' | 'image' | 'audio' | 'video'

/** 模型类型 */
export type ProviderModelType = 'textToText' | 'textToImage' | 'textToVideo' | 'embedding' | 'rerank'

/** 推理强度 */
export type ProviderReasoningEffort = 'low' | 'medium' | 'high'

/** 单个协议的端点配置（相对基础 URL 的路径） */
export interface ProviderProtocolConfig {
  /** 对话请求端点路径 */
  chatEndpoint: string
}

/** 供应商密钥：拉取到的模型与用户确认可用的模型 */
export interface ProviderKeyConfig {
  id: string
  /** 密钥名称（如"主力密钥"，用于展示区分） */
  name: string
  value: string
  /** 有效日期（yyyy-MM-dd；空串表示永久有效） */
  expiresAt: string
  /** 通过该密钥拉取到的模型 */
  fetchedModels: string[]
  /** 用户确认该密钥可用的模型（fetchedModels 的子集） */
  enabledModels: string[]
}

/** 模型配置：只有 enabled 的模型才会在网关中使用 */
export interface ProviderModelConfig {
  enabled: boolean
  /** 显示名称（为空时展示模型 ID） */
  displayName: string
  /** 显示分组 */
  group: string
  /** 模型类型 */
  type: ProviderModelType
  inputModalities: ProviderModality[]
  outputModalities: ProviderModality[]
  /** 是否支持推理 */
  reasoning: boolean
  /** 推理强度（多选；reasoning 为 false 时忽略） */
  reasoningEfforts: ProviderReasoningEffort[]
  /** 最大上下文（tokens） */
  maxContext: number
  /** 最大输入（tokens） */
  maxInput: number
  /** 最大输出（tokens） */
  maxOutput: number
  /** 模型支持的协议（决定请求走哪个端点） */
  protocols: ProviderProtocolId[]
}

/** 供应商完整配置 */
export interface ProviderConfig {
  /** 内部 uuid（路由与持久化主键） */
  id: string
  /** 来源预置供应商 id；自定义时为 null */
  presetId: string | null
  /** 是否启用：停用后网关不使用该供应商 */
  enabled: boolean
  /** 供应商 ID（对外标识，如 openai） */
  providerId: string
  /** 显示名称 */
  name: string
  /** 显示图标：品牌 id（对应 @lobehub/icons）；空串表示无图标（首字母 fallback） */
  icon: string
  baseUrl: string
  /** 备注 */
  remark: string
  protocols: ProviderProtocolId[]
  endpoints: Partial<Record<ProviderProtocolId, ProviderProtocolConfig>>
  /** 模型列表端点（供应商级：多协议共用一个模型获取接口） */
  modelsEndpoint: string
  keys: ProviderKeyConfig[]
  models: Record<string, ProviderModelConfig>
}

/** 预置供应商 */
export interface ProviderPreset {
  id: string
  providerId: string
  name: string
  baseUrl: string
  /** 品牌图标（@lobehub/icons 品牌 id）；无品牌图标的预置供应商留空（首字母 fallback） */
  icon: string
  protocols: ProviderProtocolId[]
  endpoints: Partial<Record<ProviderProtocolId, ProviderProtocolConfig>>
  /** 模型列表端点 */
  modelsEndpoint: string
}

export interface ProviderProtocolMeta {
  id: ProviderProtocolId
  /** i18n 文案 key（providers.protocol.*） */
  labelKey: string
  defaults: ProviderProtocolConfig
}

export interface ProviderModelTypeMeta {
  id: ProviderModelType
  /** i18n 文案 key（providers.modelType.*） */
  labelKey: string
}

/** 协议元数据：默认端点路径（未显式配置时使用） */
export const providerProtocols: ProviderProtocolMeta[] = [
  {
    id: 'openai',
    labelKey: 'providers.protocol.openai',
    defaults: {
      chatEndpoint: '/v1/chat/completions'
    }
  },
  {
    id: 'anthropic',
    labelKey: 'providers.protocol.anthropic',
    defaults: {
      chatEndpoint: '/v1/messages'
    }
  },
  {
    id: 'gemini',
    labelKey: 'providers.protocol.gemini',
    defaults: {
      chatEndpoint: '/v1beta/models/{model}:generateContent'
    }
  }
]

/** 各协议的模型列表端点默认值（用于供应商级 modelsEndpoint 的初始填充） */
export const protocolModelsEndpointDefaults: Record<ProviderProtocolId, string> = {
  openai: '/v1/models',
  anthropic: '/v1/models',
  gemini: '/v1beta/models'
}

export const protocolDefaults: Record<ProviderProtocolId, ProviderProtocolConfig> = Object.fromEntries(
  providerProtocols.map(p => [p.id, p.defaults])
) as Record<ProviderProtocolId, ProviderProtocolConfig>

/** 模型类型元数据 */
export const providerModelTypes: ProviderModelTypeMeta[] = [
  {id: 'textToText', labelKey: 'providers.modelTypes.textToText'},
  {id: 'textToImage', labelKey: 'providers.modelTypes.textToImage'},
  {id: 'textToVideo', labelKey: 'providers.modelTypes.textToVideo'},
  {id: 'embedding', labelKey: 'providers.modelTypes.embedding'},
  {id: 'rerank', labelKey: 'providers.modelTypes.rerank'}
]

/** 预置供应商列表：选中后自动填充基本信息 */
export const providerPresets: ProviderPreset[] = [
  {
    id: 'openai',
    providerId: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    icon: 'openai',
    protocols: ['openai'],
    endpoints: {},
    modelsEndpoint: '/v1/models'
  },
  {
    id: 'anthropic',
    providerId: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    icon: 'anthropic',
    protocols: ['anthropic'],
    endpoints: {},
    modelsEndpoint: '/v1/models'
  },
  {
    id: 'gemini',
    providerId: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    icon: 'gemini',
    protocols: ['gemini'],
    endpoints: {},
    modelsEndpoint: '/v1beta/models'
  },
  {
    id: 'deepseek',
    providerId: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    icon: 'deepseek',
    protocols: ['openai'],
    endpoints: {},
    modelsEndpoint: '/models'
  },
  {
    id: 'kimi',
    providerId: 'kimi',
    name: 'Moonshot Kimi',
    baseUrl: 'https://api.moonshot.cn',
    icon: 'kimi',
    protocols: ['openai'],
    endpoints: {},
    modelsEndpoint: '/v1/models'
  },
  {
    id: 'qwen',
    providerId: 'qwen',
    name: 'Qwen (DashScope)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    icon: 'qwen',
    protocols: ['openai'],
    endpoints: {
      openai: {
        chatEndpoint: '/chat/completions'
      }
    },
    modelsEndpoint: '/models'
  },
  {
    id: 'glm',
    providerId: 'glm',
    name: 'Zhipu GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    icon: 'zhipu',
    protocols: ['openai'],
    endpoints: {
      openai: {
        chatEndpoint: '/chat/completions'
      }
    },
    modelsEndpoint: '/models'
  },
  {
    id: 'openrouter',
    providerId: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api',
    icon: 'openrouter',
    protocols: ['openai'],
    endpoints: {},
    modelsEndpoint: '/v1/models'
  },
  {
    id: 'siliconflow',
    providerId: 'siliconflow',
    name: 'SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn',
    icon: 'siliconcloud',
    protocols: ['openai'],
    endpoints: {},
    modelsEndpoint: '/v1/models'
  },
  {
    id: 'xai',
    providerId: 'xai',
    name: 'xAI Grok',
    baseUrl: 'https://api.x.ai',
    icon: 'xai',
    protocols: ['openai'],
    endpoints: {},
    modelsEndpoint: '/v1/models'
  },
  {
    id: 'groq',
    providerId: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai',
    icon: 'groq',
    protocols: ['openai'],
    endpoints: {},
    modelsEndpoint: '/v1/models'
  },
  {
    id: 'volcengine',
    providerId: 'volcengine',
    name: 'Volcengine Ark',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    icon: 'volcengine',
    protocols: ['openai'],
    endpoints: {},
    modelsEndpoint: '/models'
  }
]

/** 生成唯一 id（浏览器与 Node 均可用） */
export function newId(): string {
  return crypto.randomUUID()
}

/** 预置填充目标：供应商对象或新增表单（结构化字段一致） */
interface PresetAppliable {
  providerId: string
  name: string
  icon: string
  baseUrl: string
  protocols: ProviderProtocolId[]
  endpoints: Partial<Record<ProviderProtocolId, ProviderProtocolConfig>>
  modelsEndpoint: string
}

/** 应用预置供应商配置：覆盖基本信息、协议、端点与模型列表端点（不动 remark / presetId） */
export function applyPreset(target: PresetAppliable, presetId: string): void {
  const preset = providerPresets.find(p => p.id === presetId)
  if (!preset) return
  target.providerId = preset.providerId
  target.name = preset.name
  target.baseUrl = preset.baseUrl
  target.icon = preset.icon
  target.protocols = [...preset.protocols]
  target.endpoints = {}
  for (const proto of preset.protocols) {
    target.endpoints[proto] = preset.endpoints[proto]
      ? {...preset.endpoints[proto]!}
      : {...protocolDefaults[proto]}
  }
  target.modelsEndpoint = preset.modelsEndpoint
}

/** 当前配置是否偏离预置供应商将写入的值（用于覆盖前二次确认） */
export function presetDeviates(target: PresetAppliable, presetId: string): boolean {
  const preset = providerPresets.find(p => p.id === presetId)
  if (!preset) return false
  const nextEndpoints: Partial<Record<ProviderProtocolId, ProviderProtocolConfig>> = {}
  for (const proto of preset.protocols) {
    nextEndpoints[proto] = preset.endpoints[proto]
      ? {...preset.endpoints[proto]!}
      : {...protocolDefaults[proto]}
  }
  return target.providerId !== preset.providerId
    || target.name !== preset.name
    || target.baseUrl !== preset.baseUrl
    || target.icon !== preset.icon
    || target.modelsEndpoint !== preset.modelsEndpoint
    || JSON.stringify(target.protocols) !== JSON.stringify(preset.protocols)
    || JSON.stringify(target.endpoints) !== JSON.stringify(nextEndpoints)
}

/** 拼接基础 URL 与端点路径 */
export function joinUrl(base: string, path: string): string {
  const trimmedBase = base.replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${trimmedBase}${normalizedPath}`
}

/** 生成默认模型配置（默认文生文、纯文本模态、零上限占位） */
export function defaultModelConfig(): ProviderModelConfig {
  return {
    enabled: false,
    displayName: '',
    group: '',
    type: 'textToText',
    inputModalities: ['text'],
    outputModalities: ['text'],
    reasoning: false,
    reasoningEfforts: [],
    maxContext: 0,
    maxInput: 0,
    maxOutput: 0,
    protocols: []
  }
}
