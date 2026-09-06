/**
 * 供应商端点 API（/api/providers/:providerId/endpoints）：sys_endpoint 表的 CRUD
 */
import type {Context} from 'hono'
import {Hono} from 'hono'
import {newId} from '../../../shared/sys-provider'
import type {SysEndpointInput, SysEndpointType} from '../../../shared/sys-endpoint'
import {getEndpoint, insertEndpoint, listEndpoints, removeEndpoint, updateEndpoint} from '../store'

export const endpoints = new Hono()

function jsonError(_c: Context, status: number, error: string): Response {
  return new Response(JSON.stringify({error}), {
    status,
    headers: {'Content-Type': 'application/json; charset=UTF-8'}
  })
}

function parseEndpointBody(raw: unknown): {data?: SysEndpointInput; error?: string} {
  const p = (raw ?? {}) as Partial<SysEndpointInput>
  if (!p.type || !['base', 'models', 'protocol'].includes(p.type)) {
    return {error: 'Invalid endpoint: type must be base, models, or protocol'}
  }
  if (typeof p.path !== 'string' || !p.path.trim()) {
    return {error: 'Invalid endpoint: missing path'}
  }
  return {
    data: {
      type: p.type as SysEndpointType,
      protocol: typeof p.protocol === 'string' ? p.protocol.trim() : '',
      path: p.path.trim(),
      isDefault: !!p.isDefault
    }
  }
}

/** 列表 */
endpoints.get('/providers/:providerId/endpoints', (c) => {
  const providerId = c.req.param('providerId')
  return c.json(listEndpoints(providerId))
})

/** 新增 */
endpoints.post('/providers/:providerId/endpoints', async (c) => {
  const providerId = c.req.param('providerId')
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseEndpointBody(body)
  if (!data) return jsonError(c, 400, error!)

  const created = insertEndpoint(newId(), providerId, data)
  return c.json(created, 201)
})

/** 更新 */
endpoints.put('/providers/:providerId/endpoints/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseEndpointBody(body)
  if (!data) return jsonError(c, 400, error!)

  const updated = updateEndpoint(id, data)
  if (!updated) return jsonError(c, 404, 'Endpoint not found')
  return c.json(updated)
})

/** 删除 */
endpoints.delete('/providers/:providerId/endpoints/:id', (c) => {
  const id = c.req.param('id')
  if (!removeEndpoint(id)) return jsonError(c, 404, 'Endpoint not found')
  return c.json({ok: true})
})
