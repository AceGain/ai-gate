/** 虚拟模型管理配置；执行和 SSE 编排由后续代理执行器实现。 */
import * as v from 'valibot'
import { MODEL_TYPES, MODEL_MODALITIES, MODEL_EFFORT_LEVELS } from './sModel.js'
import { GEN_ENDPOINT_TYPES } from './sEndpoint.js'

export const V_MODEL_KINDS = ['GROUP', 'FUSION', 'DECISION'] as const
export const V_MODEL_ROLES = ['SELECT', 'WORKER', 'MERGER', 'PROPOSER', 'DECIDER', 'EXECUTOR'] as const
export const V_MODEL_STRATEGIES = ['PRIORITY', 'WEIGHTED', 'ROUND_ROBIN'] as const
export type VModelKind = typeof V_MODEL_KINDS[number]
export type VModelRole = typeof V_MODEL_ROLES[number]
export const V_MODEL_KIND_ROLES: Record<VModelKind, readonly VModelRole[]> = {
  GROUP: ['SELECT'], FUSION: ['WORKER', 'MERGER'], DECISION: ['PROPOSER', 'DECIDER', 'EXECUTOR'],
}
export function isParallelRole(role: VModelRole) { return role === 'WORKER' || role === 'PROPOSER' }

const text = v.pipe(v.string(), v.trim(), v.minLength(1))
const nonNegative = v.pipe(v.number(), v.safeInteger(), v.minValue(0))
const positive = v.pipe(v.number(), v.safeInteger(), v.minValue(1))
const milliseconds = v.pipe(positive, v.maxValue(2147483647))
const jsonObject = v.custom<Record<string, unknown>>(value => value !== null && typeof value === 'object' && !Array.isArray(value), 'Expected a JSON object')
const object = v.pipe(jsonObject, v.record(v.string(), v.unknown()))
const capabilityFields = v.object({
  inputModal: v.optional(v.array(v.picklist(MODEL_MODALITIES))),
  outputModal: v.optional(v.array(v.picklist(MODEL_MODALITIES))),
  maxContext: v.optional(nonNegative),
  maxInput: v.optional(nonNegative),
  maxOutput: v.optional(nonNegative),
  reasoning: v.optional(v.picklist(['DISABLE', 'ALWAYS', 'SWITCH', 'TOGGLE'])),
  effortLevel: v.optional(v.array(v.picklist(MODEL_EFFORT_LEVELS))),
})
// 校验已知能力字段，同时保留扩展字段；不能把整个对象重新解析成仅包含已知字段的副本。
export const VModelCapabilitiesSchema = v.pipe(object,
  v.check(input => v.safeParse(capabilityFields, input).success, 'Invalid capability limits'))
export const VModelGeneratesSchema = v.nullable(v.array(v.picklist(GEN_ENDPOINT_TYPES)))
export const VRoleConfigSchema = v.pipe(jsonObject, v.strictObject({
  strategy: v.optional(v.picklist(V_MODEL_STRATEGIES)),
  endpointType: v.optional(v.nullable(v.picklist(GEN_ENDPOINT_TYPES))),
  maxParticipants: v.optional(v.nullable(positive)),
  maxConcurrency: v.optional(positive),
  minSuccess: v.optional(positive),
  timeout: v.optional(v.nullable(milliseconds)),
  deadline: v.optional(v.nullable(milliseconds)),
  maxRetries: v.optional(v.nullable(nonNegative)),
  promptTemplate: v.optional(v.nullable(v.string())),
  requestConfig: v.optional(object),
}), v.check(input => input.maxParticipants == null || (input.minSuccess ?? 1) <= input.maxParticipants,
  'minSuccess exceeds maxParticipants'))
export type VRoleConfig = v.InferOutput<typeof VRoleConfigSchema>
export const VOrchConfigSchema = v.pipe(jsonObject, v.record(v.picklist(V_MODEL_ROLES), VRoleConfigSchema))
export type VOrchConfig = v.InferOutput<typeof VOrchConfigSchema>
export function isVOrchConfigForKind(kind: VModelKind, input: VOrchConfig): boolean {
  const roles = V_MODEL_KIND_ROLES[kind]
  return Object.entries(input).every(([role, config]) => {
    if (!roles.includes(role as VModelRole)) return false
    if (isParallelRole(role as VModelRole)) return config.strategy === undefined
    if (role === 'SELECT' && (config.endpointType != null || config.promptTemplate != null)) return false
    return config.maxParticipants === undefined && config.maxConcurrency === undefined && config.minSuccess === undefined
  })
}

export const VModelMemberInputSchema = v.strictObject({
  id: v.optional(positive),
  modelId: positive,
  role: v.picklist(V_MODEL_ROLES),
  enabled: v.optional(v.boolean(), false),
  sort: v.optional(nonNegative, 0),
  weight: v.optional(positive, 1),
  remark: v.optional(v.string(), ''),
})
export type VModelMemberInput = v.InferOutput<typeof VModelMemberInputSchema>

export const VModelInputSchema = v.pipe(v.strictObject({
  code: text,
  name: v.optional(v.string(), ''),
  category: v.optional(text, 'Default'),
  kind: v.picklist(V_MODEL_KINDS),
  type: v.picklist(MODEL_TYPES),
  enabled: v.optional(v.boolean(), false),
  generates: v.optional(VModelGeneratesSchema, null),
  config: v.optional(v.nullable(VModelCapabilitiesSchema), null),
  orchConfig: v.optional(VOrchConfigSchema, {}),
  timeout: v.optional(milliseconds, 180000),
  maxCalls: v.optional(positive, 16),
  sort: v.optional(nonNegative),
  remark: v.optional(v.string(), ''),
  members: v.optional(v.array(VModelMemberInputSchema), []),
}), v.check(input => {
  const roles = V_MODEL_KIND_ROLES[input.kind]
  if (input.members.some(member => !roles.includes(member.role))) return false
  if (new Set(input.members.map(member => `${member.role}:${member.modelId}`)).size !== input.members.length) return false
  const ids = input.members.flatMap(member => member.id === undefined ? [] : [member.id])
  if (new Set(ids).size !== ids.length) return false
  return isVOrchConfigForKind(input.kind, input.orchConfig)
}, 'Roles, member identities, or orchestration settings do not match the virtual model kind'))
export type VModelInput = v.InferOutput<typeof VModelInputSchema>
export interface VModelMember extends VModelMemberInput {
  id: number
  virtualModelId: number
  sourceCode: string
  sourceName: string
  providerName: string
  sourceEnabled: boolean
  createTime: string
  updateTime: string
}
export interface VModel extends Omit<VModelInput, 'sort' | 'members'> {
  id: number
  status: string
  sort: number
  members: VModelMember[]
  createTime: string
  updateTime: string
}
export interface VModelSource {
  id: number
  code: string
  name: string
  providerName: string
  type: string
  generates: string[]
  config: Record<string, unknown>
  enabled: boolean
}

/** 检查本地启停/状态、角色人数和计划调用预算；不执行上游网络探测。 */
export function isVModelReady(input: VModelInput, availableModels?: ReadonlySet<number>): boolean {
  let calls = 0
  for (const role of V_MODEL_KIND_ROLES[input.kind]) {
    const count = input.members.filter(member => member.role === role && member.enabled &&
      (availableModels === undefined || availableModels.has(member.modelId))).length
    const config = input.orchConfig[role]
    if (isParallelRole(role)) {
      const selected = Math.min(count, config?.maxParticipants ?? count)
      if (selected < (config?.minSuccess ?? 1)) return false
      calls += selected
    } else {
      if (!count) return false
      calls++
    }
  }
  return calls <= input.maxCalls
}
