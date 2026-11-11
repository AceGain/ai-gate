/** 入站域（R）：路由配置及其端点、密钥和对外模型。 */
import * as v from 'valibot'
import { GEN_ENDPOINT_TYPES } from './sEndpoint.js'

const requiredText = v.pipe(v.string(), v.trim(), v.minLength(1))
const nonNegative = v.pipe(v.number(), v.safeInteger(), v.minValue(0))
const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))
/** 只接受主机名/IP，不接受 URL 或附带端口；统一 IPv6、大小写与尾点写法。 */
export function normalizeRouteHost(value: string): string | null {
  const host = value.trim()
  if (!host || /[\/\\?#@%\s]/.test(host)) return null
  if (host.startsWith('[') && !host.endsWith(']')) return null
  try {
    const address = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
    const url = new URL(`http://${address}`)
    if (url.port || url.host !== url.hostname) return null
    if (url.hostname.startsWith('[')) return url.hostname.slice(1, -1)
    // A colon outside an IPv6 literal is a port, including the implicit :80.
    if (host.includes(':')) return null
    const normalized = url.hostname.replace(/\.$/, '').toLowerCase()
    if (normalized.length > 253 || !normalized.split('.').every(label =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null
    return normalized
  } catch { return null }
}
export const RHostSchema = v.pipe(requiredText,
  v.check(value => normalizeRouteHost(value) !== null), v.transform(value => normalizeRouteHost(value)!))
export const RDateSchema = v.pipe(v.string(), v.isoDate(), v.check(value => {
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}))
/** 相对网关根路径；根路径以外不带尾斜杠，避免同一入口有不同写法。 */
export const RPathSchema = v.pipe(requiredText,
  v.regex(/^\/(?:[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*)?$/),
  v.check(path => !path.split('/').some(part => part === '.' || part === '..')),
)
const routeFields = {
  name: requiredText,
  icon: v.optional(v.string(), ''),
  mode: v.optional(v.picklist(['SHARED', 'DEDICATED']), 'SHARED'),
  host: v.optional(v.nullable(RHostSchema), null),
  port: v.optional(v.nullable(v.pipe(id, v.maxValue(65535))), null),
  prefixPath: v.optional(RPathSchema, '/v1'),
  modelsPath: v.optional(RPathSchema, '/models'),
  enabled: v.optional(v.boolean(), false),
  strategy: v.optional(v.literal('PRIORITY'), 'PRIORITY'),
  timeout: v.optional(v.pipe(id, v.maxValue(2147483647)), 60000),
  maxRetries: v.optional(nonNegative, 0),
  remark: v.optional(v.string(), ''),
  sort: v.optional(nonNegative),
}
const listenerValid = (value: {mode: string, host: string | null, port: number | null}) =>
  value.mode !== 'DEDICATED' || (!!value.host && value.port !== null)

export const RRouteCreateSchema = v.pipe(v.object({code: requiredText, ...routeFields}), v.check(value => listenerValid(value)))
// code 创建后不可更改；更新载荷不包含 code/status。
export const RRouteUpdateSchema = v.pipe(v.object(routeFields), v.check(value => listenerValid(value)))
export type RRouteInput = v.InferOutput<typeof RRouteCreateSchema>
export type RRouteUpdateInput = v.InferOutput<typeof RRouteUpdateSchema>
export interface RRoute extends Omit<RRouteInput, 'sort'> {
  id: number
  status: string
  sort: number
  createTime: string
  updateTime: string
}

const commonFields = {enabled: v.optional(v.boolean(), false), sort: v.optional(nonNegative)}
export const REndpointInputSchema = v.object({
  type: v.picklist(GEN_ENDPOINT_TYPES), path: RPathSchema, ...commonFields,
})
export type REndpointInput = v.InferOutput<typeof REndpointInputSchema>
interface RRecord {id: number, routeId: number, sort: number, createTime: string, updateTime: string}
export interface REndpoint extends REndpointInput, RRecord {sort: number}

export const RKeyInputSchema = v.object({
  name: requiredText, secret: requiredText, ...commonFields,
  expireTime: v.optional(v.nullable(RDateSchema), null),
  remark: v.optional(v.string(), ''),
})
export type RKeyInput = v.InferOutput<typeof RKeyInputSchema>
export interface RKey extends RKeyInput, RRecord {sort: number, status: string}

/** 第一阶段直接发布供应商模型；虚拟模型待其领域落地后开放。 */
export const RModelInputSchema = v.object({
  sourceType: v.optional(v.literal('S_MODEL'), 'S_MODEL'),
  modelId: id,
  mode: v.optional(v.literal('DIRECT'), 'DIRECT'),
  code: requiredText,
  name: v.optional(v.string(), ''),
  category: v.optional(v.string(), 'Default'),
  remark: v.optional(v.string(), ''),
  ...commonFields,
})
export type RModelInput = v.InferOutput<typeof RModelInputSchema>
export interface RModel extends Omit<RModelInput, 'sourceType' | 'mode'>, RRecord {
  sort: number
  status: string
  sourceType: 'S_MODEL' | 'V_MODEL'
  mode: 'DIRECT' | 'CUSTOM'
  type: string | null
  generates: string[] | null
  config: Record<string, unknown> | null
  sourceCode: string | null
  sourceName: string | null
  providerName: string | null
}
export function isEditableRouteModel(model: Pick<RModel, 'mode' | 'sourceType'>): boolean {
  return model.mode === 'DIRECT' && model.sourceType === 'S_MODEL'
}
export interface RModelSource {id: number, code: string, name: string, providerName: string, enabled: boolean}

export const RReorderSchema = v.pipe(v.array(v.object({id, sort: nonNegative})),
  v.check(items => new Set(items.map(item => item.id)).size === items.length))
export const REnabledSchema = v.object({enabled: v.boolean()})
