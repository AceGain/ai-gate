/**
 * 供应商端点 API（/api/providers/:providerId/endpoints）：sys_endpoint 表的 CRUD
 */
import {Hono} from 'hono'
import {newId} from '../../../shared/sys-provider'
import {SYS_ENDPOINT_PROTOCOLS} from '../../../shared/sys-endpoint'
import type {SysEndpointInput, SysEndpointProtocol, SysEndpointType} from '../../../shared/sys-endpoint'
import {insertEndpoint, listEndpoints, removeEndpoint, updateEndpoint} from '../store'

export const endpoints = new Hono()

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

/** 新增 */
endpoints.post('/providers/:providerId/endpoints', async (c) => {
  const providerId = c.req.param('providerId')
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseEndpointBody(body)
  if (!data) return c.json({error: error!}, 400)

  const created = await insertEndpoint(newId(), providerId, data)
  return c.json(created, 201)
})

/** 更新 */
endpoints.put('/providers/:providerId/endpoints/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseEndpointBody(body)
  if (!data) return c.json({error: error!}, 400)

  const updated = await updateEndpoint(id, data)
  if (!updated) return c.json({error: 'Endpoint not found'}, 404)
  return c.json(updated)
})

/** 删除 */
endpoints.delete('/providers/:providerId/endpoints/:id', async (c) => {
  const id = c.req.param('id')
  if (!(await removeEndpoint(id))) return c.json({error: 'Endpoint not found'}, 404)
  return c.json({ok: true})
})
