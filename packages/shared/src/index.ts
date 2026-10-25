/**
 * 领域命名约定（表前缀 ↔ 类型前缀，前后端一致）：
 * - t_ / T*：模板域（hub 维护的供应商模板：t_provider、t_endpoint、t_model）
 * - s_ / S*：出站域（server 对接的上游供应商：s_provider、s_endpoint、s_key、s_model、s_relat）
 * - r_ / R*：入站域（网关对外暴露的入口配置，预留；落地时同样以 r_ / R 命名）
 * 三域职责与所属领域不同，即使结构暂时相同也不得省略前缀互相简化合并；
 * 状态/模态等跨域取值词汇（ProviderStatus、ModelType、GEN_ENDPOINT_TYPES 等）暂共享，真正分化时再按域拆分。
 * 本包当前只包含出站域（S）的前后端共用结构；模板域类型暂由 hub 自持，入站域未落地。
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
