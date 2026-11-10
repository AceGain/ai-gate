/**
 * 出站供应商端点（S 域）API（/api/set/providers/:providerId/endpoints）：s_endpoint 表的 CRUD
 */
import {Hono} from 'hono'
import {SEndpointInputSchema} from '@ai-gate/shared'
import {
  getEndpoint,
  getEndpointByType,
  getProvider,
  insertEndpoint,
  listEndpoints,
  removeEndpoint,
  updateEndpoint,
} from '../store.js'
import {isUniqueViolation, parseBody, parseId} from './providers.js'

export const endpoints = new Hono()

/** 列表 */
endpoints.get('/providers/:providerId/endpoints', (c) => {
  const providerId = parseId(c.req.param('providerId'))
  if (!providerId) return c.json({error: 'PROVIDER_NOT_FOUND'}, 404)
  return c.json(listEndpoints(providerId))
})

/** 新增：同供应商下每种生成端点类型仅允许一个 */
endpoints.post('/providers/:providerId/endpoints', async (c) => {
  const providerId = parseId(c.req.param('providerId'))
  if (!providerId || !getProvider(providerId)) return c.json({error: 'PROVIDER_NOT_FOUND'}, 404)
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseBody(SEndpointInputSchema, body)
  if (!data) return c.json({error: 'INVALID_REQUEST', detail: error!}, 400)

  const existing = getEndpointByType(providerId, data.type)
  if (existing) return c.json({error: 'DUPLICATE_ENDPOINT'}, 409)

  try {
    return c.json(insertEndpoint(providerId, data), 201)
  } catch (err) {
    if (isUniqueViolation(err)) return c.json({error: 'DUPLICATE_ENDPOINT'}, 409)
    throw err
  }
})

/** 更新 */
endpoints.put('/providers/:providerId/endpoints/:id', async (c) => {
  const providerId = parseId(c.req.param('providerId'))
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({error: 'ENDPOINT_NOT_FOUND'}, 404)
  const existingEp = getEndpoint(id)
  if (!existingEp || existingEp.providerId !== providerId) return c.json({error: 'ENDPOINT_NOT_FOUND'}, 404)

  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseBody(SEndpointInputSchema, body)
  if (!data) return c.json({error: 'INVALID_REQUEST', detail: error!}, 400)

  const existingSameType = getEndpointByType(existingEp.providerId, data.type)
  if (existingSameType && existingSameType.id !== id) {
    return c.json({error: 'DUPLICATE_ENDPOINT'}, 409)
  }

  try {
    const updated = updateEndpoint(id, data)
    if (!updated) return c.json({error: 'ENDPOINT_NOT_FOUND'}, 404)
    return c.json(updated)
  } catch (err) {
    if (isUniqueViolation(err)) return c.json({error: 'DUPLICATE_ENDPOINT'}, 409)
    throw err
  }
})

/** 删除 */
endpoints.delete('/providers/:providerId/endpoints/:id', (c) => {
  const providerId = parseId(c.req.param('providerId'))
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({error: 'ENDPOINT_NOT_FOUND'}, 404)
  const existing = getEndpoint(id)
  if (!existing || existing.providerId !== providerId) return c.json({error: 'ENDPOINT_NOT_FOUND'}, 404)
  if (!removeEndpoint(id)) return c.json({error: 'ENDPOINT_NOT_FOUND'}, 404)
  return c.json({ok: true})
})
