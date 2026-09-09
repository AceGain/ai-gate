/**
 * 供应商端点 API（/api/providers/:providerId/endpoints）：sys_endpoint 表的 CRUD
 */
import {Hono} from 'hono'
import {newId} from '../../../shared/sys-provider'
import {SYS_ENDPOINT_PROTOCOLS} from '../../../shared/sys-endpoint'
import type {SysEndpointInput, SysEndpointProtocol, SysEndpointType} from '../../../shared/sys-endpoint'
import {getEndpoint, getEndpointByProtocol, insertEndpoint, listEndpoints, removeEndpoint, updateEndpoint} from '../store'

export const endpoints = new Hono()

/** UNIQUE 约束冲突判断 */
function isUniqueViolation(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  if (err.message.includes('UNIQUE constraint failed')) return true
  const cause = (err as {cause?: unknown}).cause
  if (cause instanceof Error && cause.message.includes('UNIQUE constraint failed')) return true
  if (typeof cause === 'object' && cause !== null) {
    const code = (cause as {code?: string}).code
    const ext = (cause as {extendedCode?: string}).extendedCode
    if (code === 'SQLITE_CONSTRAINT' || ext === 'SQLITE_CONSTRAINT_UNIQUE') return true
  }
  return false
}

function parseEndpointBody(raw: unknown): {data?: SysEndpointInput; error?: string} {
  const p = (raw ?? {}) as Partial<SysEndpointInput>
  if (!p.type || !['base', 'models', 'protocol'].includes(p.type)) {
    return {error: 'Invalid endpoint: type must be base, models, or protocol'}
  }
  if (typeof p.path !== 'string' || !p.path.trim()) {
    return {error: 'Invalid endpoint: missing path'}
  }
  if (p.type === 'protocol') {
    if (!p.protocol || typeof p.protocol !== 'string' || !p.protocol.trim()) {
      return {error: 'Invalid endpoint: missing protocol'}
    }
    if (!SYS_ENDPOINT_PROTOCOLS.includes(p.protocol as SysEndpointProtocol)) {
      return {error: `Invalid protocol: must be one of ${SYS_ENDPOINT_PROTOCOLS.join(', ')}`}
    }
  }
  return {
    data: {
      type: p.type as SysEndpointType,
      protocol: p.type === 'protocol' ? (p.protocol as string).trim() : '',
      path: p.path.trim(),
      isDefault: p.type === 'protocol' && !!p.isDefault
    }
  }
}

/** 列表 */
endpoints.get('/providers/:providerId/endpoints', async (c) => {
  const providerId = c.req.param('providerId')
  return c.json(await listEndpoints(providerId))
})

/** 新增：同 providerId 下每种 protocol 仅允许新增一个 */
endpoints.post('/providers/:providerId/endpoints', async (c) => {
  const providerId = c.req.param('providerId')
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseEndpointBody(body)
  if (!data) return c.json({error: error!}, 400)

  if (data.type === 'protocol') {
    const existing = await getEndpointByProtocol(providerId, data.protocol ?? '')
    if (existing) {
      return c.json({error: `Endpoint for protocol "${data.protocol}" already exists`}, 409)
    }
  }

  try {
    const created = await insertEndpoint(newId(), providerId, data)
    return c.json(created, 201)
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return c.json({
        error: `Endpoint for ${data.type === 'protocol' ? `protocol "${data.protocol}"` : data.type} already exists`
      }, 409)
    }
    throw err
  }
})

/** 更新 */
endpoints.put('/providers/:providerId/endpoints/:id', async (c) => {
  const id = c.req.param('id')
  const existingEp = await getEndpoint(id)
  if (!existingEp) return c.json({error: 'Endpoint not found'}, 404)

  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseEndpointBody(body)
  if (!data) return c.json({error: error!}, 400)

  if (data.type === 'protocol') {
    const existingSameProto = await getEndpointByProtocol(existingEp.providerId, data.protocol ?? '')
    if (existingSameProto && existingSameProto.id !== id) {
      return c.json({error: `Endpoint for protocol "${data.protocol}" already exists`}, 409)
    }
  }

  try {
    const updated = await updateEndpoint(id, data)
    if (!updated) return c.json({error: 'Endpoint not found'}, 404)
    return c.json(updated)
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return c.json({
        error: `Endpoint for ${data.type === 'protocol' ? `protocol "${data.protocol}"` : data.type} already exists`
      }, 409)
    }
    throw err
  }
})

/** 删除 */
endpoints.delete('/providers/:providerId/endpoints/:id', async (c) => {
  const id = c.req.param('id')
  if (!(await removeEndpoint(id))) return c.json({error: 'Endpoint not found'}, 404)
  return c.json({ok: true})
})
