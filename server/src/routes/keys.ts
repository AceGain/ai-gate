/**
 * 供应商密钥 API（/api/providers/:providerId/keys）：sys_key 表的 CRUD
 */
import {Hono} from 'hono'
import {newId} from '../../../shared/sys-provider'
import type {SysKeyInput, SysKeyStatus} from '../../../shared/sys-key'
import {insertKey, listEndpoints, listKeys, removeKey, reorderKeys, updateKey} from '../store'
import {extractUpstreamDetail, joinUrl} from '../upstream'

export const keys = new Hono()

function parseKeyBody(raw: unknown): {data?: SysKeyInput; error?: string} {
  const p = (raw ?? {}) as Partial<SysKeyInput>
  if (typeof p.name !== 'string' || !p.name.trim()) {
    return {error: 'Invalid key: missing name'}
  }
  if (typeof p.secret !== 'string' || !p.secret.trim()) {
    return {error: 'Invalid key: missing secret'}
  }
  return {
    data: {
      name: p.name.trim(),
      secret: p.secret.trim(),
      enabled: p.enabled !== false,
      status: (p.status === 'INVALID' ? 'INVALID' : 'ACTIVE') as SysKeyStatus,
      expiresTime: typeof p.expiresTime === 'string' && p.expiresTime.trim() ? p.expiresTime.trim() : null,
      sort: typeof p.sort === 'number' && Number.isSafeInteger(p.sort) ? p.sort : 0
    }
  }
}

function isReorderItem(v: unknown): v is {id: string, sort: number} {
  const it = v as {id?: unknown, sort?: unknown} | null
  return !!it && typeof it.id === 'string' && !!it.id
    && typeof it.sort === 'number' && Number.isSafeInteger(it.sort) && it.sort >= 0
}

/** 列表 */
keys.get('/providers/:providerId/keys', async (c) => {
  const providerId = c.req.param('providerId')
  return c.json(await listKeys(providerId))
})

/** 批量排序（须在 PUT /:id 之前注册） */
keys.put('/providers/:providerId/keys/reorder', async (c) => {
  const body = await c.req.json<unknown>().catch(() => null)
  if (!Array.isArray(body) || !body.every(isReorderItem)) {
    return c.json({error: 'Body must be an array of {id, sort}'}, 400)
  }
  await reorderKeys(body)
  return c.json({ok: true})
})

/** 新增 */
keys.post('/providers/:providerId/keys', async (c) => {
  const providerId = c.req.param('providerId')
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseKeyBody(body)
  if (!data) return c.json({error: error!}, 400)

  const created = await insertKey(newId(), providerId, data)
  return c.json(created, 201)
})

/** 组装密钥测试请求头：按默认生成端点类型选择认证风格（Anthropic Messages 用 x-api-key） */
function buildKeyTestHeaders(generate: string | undefined, secret: string): Record<string, string> {
  if (generate === 'Messages') {
    return {'x-api-key': secret, 'anthropic-version': '2023-06-01'}
  }
  return {Authorization: `Bearer ${secret}`}
}

/** 测试单个密钥可用性：以最小 GET 请求打模型列表端点验证鉴权，返回延迟；失败返回错误码 + 详情 */
keys.post('/providers/:providerId/keys/:id/test', async (c) => {
  const providerId = c.req.param('providerId')
  const id = c.req.param('id')
  const key = (await listKeys(providerId)).find(k => k.id === id)
  if (!key) return c.json({error: 'KEY_NOT_FOUND'}, 404)

  const endpoints = await listEndpoints(providerId)
  const base = endpoints.find(e => e.type === 'base')
  if (!base?.path?.trim()) return c.json({error: 'MISSING_BASE_ENDPOINT'}, 400)
  const modelsEndpoint = endpoints.find(e => e.type === 'models')
  if (!modelsEndpoint?.path?.trim()) return c.json({error: 'MISSING_MODELS_ENDPOINT'}, 400)

  const defaultGenerate = endpoints.find(e => e.type === 'generate' && e.isDefault)
    ?? endpoints.find(e => e.type === 'generate')
  const headers = buildKeyTestHeaders(defaultGenerate?.generate, key.secret)

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
  const id = c.req.param('id')
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseKeyBody(body)
  if (!data) return c.json({error: error!}, 400)

  const updated = await updateKey(id, data)
  if (!updated) return c.json({error: 'Key not found'}, 404)
  return c.json(updated)
})

/** 删除 */
keys.delete('/providers/:providerId/keys/:id', async (c) => {
  const id = c.req.param('id')
  if (!(await removeKey(id))) return c.json({error: 'Key not found'}, 404)
  return c.json({ok: true})
})
