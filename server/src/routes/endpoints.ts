/**
 * 供应商端点 API（/api/providers/:providerId/endpoints）：sys_endpoint 表的 CRUD
 */
import {Hono} from 'hono'
import {newId} from '../../../shared/sys-provider'
import {SYS_ENDPOINT_GENERATES} from '../../../shared/sys-endpoint'
import type {SysEndpointInput, SysEndpointGenerate, SysEndpointType} from '../../../shared/sys-endpoint'
import {getEndpoint, getEndpointByGenerate, insertEndpoint, listEndpoints, removeEndpoint, updateEndpoint} from '../store'

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
  if (!p.type || !['base', 'models', 'generate'].includes(p.type)) {
    return {error: 'Invalid endpoint: type must be base, models, or generate'}
  }
  if (typeof p.path !== 'string' || !p.path.trim()) {
    return {error: 'Invalid endpoint: missing path'}
  }
  if (p.type === 'generate') {
    if (!p.generate || typeof p.generate !== 'string' || !p.generate.trim()) {
      return {error: 'Invalid endpoint: missing generate'}
    }
    if (!SYS_ENDPOINT_GENERATES.includes(p.generate as SysEndpointGenerate)) {
      return {error: `Invalid generate: must be one of ${SYS_ENDPOINT_GENERATES.join(', ')}`}
    }
  }
  return {
    data: {
      type: p.type as SysEndpointType,
      generate: p.type === 'generate' ? (p.generate as string).trim() : '',
      path: p.path.trim(),
      isDefault: p.type === 'generate' && !!p.isDefault
    }
  }
}

/** 列表 */
endpoints.get('/providers/:providerId/endpoints', async (c) => {
  const providerId = c.req.param('providerId')
  return c.json(await listEndpoints(providerId))
})

/** 新增：同 providerId 下每种 generate 仅允许新增一个 */
endpoints.post('/providers/:providerId/endpoints', async (c) => {
  const providerId = c.req.param('providerId')
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseEndpointBody(body)
  if (!data) return c.json({error: error!}, 400)

  if (data.type === 'generate') {
    const existing = await getEndpointByGenerate(providerId, data.generate ?? '')
    if (existing) {
      return c.json({error: `Endpoint for generate "${data.generate}" already exists`}, 409)
    }
  }

  try {
    const created = await insertEndpoint(newId(), providerId, data)
    return c.json(created, 201)
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return c.json({
        error: `Endpoint for ${data.type === 'generate' ? `generate "${data.generate}"` : data.type} already exists`
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

  if (data.type === 'generate') {
    const existingSameGen = await getEndpointByGenerate(existingEp.providerId, data.generate ?? '')
    if (existingSameGen && existingSameGen.id !== id) {
      return c.json({error: `Endpoint for generate "${data.generate}" already exists`}, 409)
    }
  }

  try {
    const updated = await updateEndpoint(id, data)
    if (!updated) return c.json({error: 'Endpoint not found'}, 404)
    return c.json(updated)
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return c.json({
        error: `Endpoint for ${data.type === 'generate' ? `generate "${data.generate}"` : data.type} already exists`
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
