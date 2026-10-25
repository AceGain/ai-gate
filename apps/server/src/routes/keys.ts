/**
 * 供应商密钥 API（/api/providers/:providerId/keys）：s_key 表的 CRUD + 可用性测试
 */
import {Hono} from 'hono'
import {ApiKeyInputSchema, ReorderSchema} from '@ai-gate/shared'
import {
  insertKey,
  listEndpoints,
  listKeys,
  removeKey,
  reorderKeys,
  updateKey,
} from '../store.js'
import {buildAuthHeaders, extractUpstreamDetail, joinUrl} from '../upstream.js'
import {parseBody, parseId} from './providers.js'

export const keys = new Hono()

/** 列表 */
keys.get('/providers/:providerId/keys', (c) => {
  const providerId = parseId(c.req.param('providerId'))
  if (!providerId) return c.json({error: 'Provider not found'}, 404)
  return c.json(listKeys(providerId))
})

/** 批量排序（须在 PUT /:id 之前注册） */
keys.put('/providers/:providerId/keys/reorder', async (c) => {
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseBody(ReorderSchema, body)
  if (!data) return c.json({error: error!}, 400)
  reorderKeys(data)
  return c.json({ok: true})
})

/** 新增 */
keys.post('/providers/:providerId/keys', async (c) => {
  const providerId = parseId(c.req.param('providerId'))
  if (!providerId) return c.json({error: 'Provider not found'}, 404)
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseBody(ApiKeyInputSchema, body)
  if (!data) return c.json({error: `Invalid key: ${error!}`}, 400)

  return c.json(insertKey(providerId, data), 201)
})

/** 测试单个密钥可用性：以最小 GET 请求打模型列表端点验证鉴权，返回延迟；失败返回错误码 + 详情 */
keys.post('/providers/:providerId/keys/:id/test', async (c) => {
  const providerId = parseId(c.req.param('providerId'))
  const id = parseId(c.req.param('id'))
  if (!providerId || !id) return c.json({error: 'KEY_NOT_FOUND'}, 404)
  const key = listKeys(providerId).find(k => k.id === id)
  if (!key) return c.json({error: 'KEY_NOT_FOUND'}, 404)

  const endpoints = listEndpoints(providerId)
  const base = endpoints.find(e => e.type === 'base')
  if (!base?.path?.trim()) return c.json({error: 'MISSING_BASE_ENDPOINT'}, 400)
  const modelsEndpoint = endpoints.find(e => e.type === 'models')
  if (!modelsEndpoint?.path?.trim()) return c.json({error: 'MISSING_MODELS_ENDPOINT'}, 400)

  const defaultGenerate = endpoints.find(e => e.type === 'generate' && e.isDefault)
    ?? endpoints.find(e => e.type === 'generate')
  const headers = buildAuthHeaders(defaultGenerate?.generate, key.secret)

  const url = joinUrl(base.path.trim(), modelsEndpoint.path.trim())
  const startedAt = Date.now()
  let res: Response
  try {
    res = await fetch(url, {headers, signal: AbortSignal.timeout(15_000)})
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return c.json({error: 'UPSTREAM_TIMEOUT'}, 502)
    }
    console.warn('[ai-gate] 测试密钥失败:', url, err)
    return c.json({error: 'UPSTREAM_UNREACHABLE'}, 502)
  }
  const latencyMs = Date.now() - startedAt
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return c.json({error: 'UPSTREAM_ERROR', detail: extractUpstreamDetail(res.status, text)}, 502)
  }
  return c.json({ok: true, latencyMs})
})

/** 更新 */
keys.put('/providers/:providerId/keys/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({error: 'Key not found'}, 404)
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseBody(ApiKeyInputSchema, body)
  if (!data) return c.json({error: `Invalid key: ${error!}`}, 400)

  const updated = updateKey(id, data)
  if (!updated) return c.json({error: 'Key not found'}, 404)
  return c.json(updated)
})

/** 删除 */
keys.delete('/providers/:providerId/keys/:id', (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({error: 'Key not found'}, 404)
  if (!removeKey(id)) return c.json({error: 'Key not found'}, 404)
  return c.json({ok: true})
})
