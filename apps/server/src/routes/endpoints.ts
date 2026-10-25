/**
 * 出站供应商端点（S 域）API（/api/providers/:providerId/endpoints）：s_endpoint 表的 CRUD
 */
import {Hono} from 'hono'
import {SEndpointInputSchema} from '@ai-gate/shared'
import {
  getEndpoint,
  getEndpointByGenerate,
  insertEndpoint,
  listEndpoints,
  removeEndpoint,
  updateEndpoint,
} from '../store.js'
import {isUniqueViolation, parseBody, parseId} from './providers.js'

export const endpoints = new Hono()

/** 端点冲突错误文案（与 v1 行为一致：同供应商同类别端点唯一） */
function duplicateMessage(input: {type: string, generate?: string}): string {
  return input.type === 'generate'
    ? `Endpoint for generate "${input.generate}" already exists`
    : `Endpoint for ${input.type} already exists`
}

/** 列表 */
endpoints.get('/providers/:providerId/endpoints', (c) => {
  const providerId = parseId(c.req.param('providerId'))
  if (!providerId) return c.json({error: 'Provider not found'}, 404)
  return c.json(listEndpoints(providerId))
})

/** 新增：同供应商下每种生成端点类型仅允许一个 */
endpoints.post('/providers/:providerId/endpoints', async (c) => {
  const providerId = parseId(c.req.param('providerId'))
  if (!providerId) return c.json({error: 'Provider not found'}, 404)
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseBody(SEndpointInputSchema, body)
  if (!data) return c.json({error: `Invalid endpoint: ${error!}`}, 400)

  if (data.type === 'generate') {
    const existing = getEndpointByGenerate(providerId, data.generate ?? '')
    if (existing) return c.json({error: duplicateMessage(data)}, 409)
  }

  try {
    return c.json(insertEndpoint(providerId, data), 201)
  } catch (err) {
    if (isUniqueViolation(err)) return c.json({error: duplicateMessage(data)}, 409)
    throw err
  }
})

/** 更新 */
endpoints.put('/providers/:providerId/endpoints/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({error: 'Endpoint not found'}, 404)
  const existingEp = getEndpoint(id)
  if (!existingEp) return c.json({error: 'Endpoint not found'}, 404)

  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseBody(SEndpointInputSchema, body)
  if (!data) return c.json({error: `Invalid endpoint: ${error!}`}, 400)

  if (data.type === 'generate') {
    const existingSameGen = getEndpointByGenerate(existingEp.providerId, data.generate ?? "")
    if (existingSameGen && existingSameGen.id !== id) {
      return c.json({error: duplicateMessage(data)}, 409)
    }
  }

  try {
    const updated = updateEndpoint(id, data)
    if (!updated) return c.json({error: 'Endpoint not found'}, 404)
    return c.json(updated)
  } catch (err) {
    if (isUniqueViolation(err)) return c.json({error: duplicateMessage(data)}, 409)
    throw err
  }
})

/** 删除 */
endpoints.delete('/providers/:providerId/endpoints/:id', (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({error: 'Endpoint not found'}, 404)
  if (!removeEndpoint(id)) return c.json({error: 'Endpoint not found'}, 404)
  return c.json({ok: true})
})
