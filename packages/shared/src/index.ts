/**
 * 领域命名约定（表前缀 ↔ 类型前缀，前后端一致）：
 * - t_ / T*：模板域（hub 维护的供应商模板：t_provider、t_endpoint、t_model）
 * - s_ / S*：出站域（server 对接的上游供应商：s_provider、s_endpoint、s_key、s_model、s_relat）
 * - r_ / R*：入站域（网关对外暴露的入口配置，预留；落地时同样以 r_ / R 命名）
 * 三域职责与所属领域不同，即使结构暂时相同也不得省略前缀互相简化合并；
 * 状态/模态等跨域取值词汇（ProviderStatus、ModelType、GEN_ENDPOINT_TYPES 等）暂共享，真正分化时再按域拆分。
 * 本包包含出站域（S）与模板域（T）的前后端共用结构；入站域未落地。
 */
import * as v from 'valibot'

export const HealthSchema = v.object({
  status: v.literal('ok'),
})

export type Health = v.InferOutput<typeof HealthSchema>

export * from './sProvider.js'
export * from './sEndpoint.js'
export * from './sKey.js'
export * from './sModel.js'

export * from './tProvider.js'
export * from './tEndpoint.js'
export * from './tModel.js'

import type { TProvider } from './tProvider.js'
import type { TEndpoint } from './tEndpoint.js'
import type { TModel } from './tModel.js'

/** 包含完整端点和模型列表的模板供应商详情（Hub Catalog 载荷） */
export interface TProviderDetail extends TProvider {
  endpoints: TEndpoint[]
  models: TModel[]
}

/** 附带供应商基本信息的模型视图（供全局跨供应商查询） */
export interface TModelWithProvider extends TModel {
  providerCode: string
  providerName: string
}
