/**
 * 供应商密钥 API（/api/providers/:providerId/keys）：sys_key 表的 CRUD
 */
import type {Context} from 'hono'
import {Hono} from 'hono'
import {newId} from '../../../shared/sys-provider'
import type {SysKeyInput, SysKeyStatus} from '../../../shared/sys-key'
import {getKey, insertKey, listKeys, removeKey, reorderKeys, updateKey} from '../store'

export const keys = new Hono()

function jsonError(_c: Context, status: number, error: string): Response {
  return new Response(JSON.stringify({error}), {
    status,
    headers: {'Content-Type': 'application/json; charset=UTF-8'}
  })
}

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
      sort: typeof p.sort === 'number' && Number.isSafeInteger(p.sort) ? p.sort : 0,
      description: typeof p.description === 'string' ? p.description.trim() : ''
    }
  }
}

function isReorderItem(v: unknown): v is {id: string, sort: number} {
  const it = v as {id?: unknown, sort?: unknown} | null
  return !!it && typeof it.id === 'string' && !!it.id
    && typeof it.sort === 'number' && Number.isSafeInteger(it.sort) && it.sort >= 0
}

/** 列表 */
keys.get('/providers/:providerId/keys', (c) => {
  const providerId = c.req.param('providerId')
  return c.json(listKeys(providerId))
})

/** 批量排序（须在 PUT /:id 之前注册） */
keys.put('/providers/:providerId/keys/reorder', async (c) => {
  const body = await c.req.json<unknown>().catch(() => null)
  if (!Array.isArray(body) || !body.every(isReorderItem)) {
    return jsonError(c, 400, 'Body must be an array of {id, sort}')
  }
  reorderKeys(body)
  return c.json({ok: true})
})

/** 新增 */
keys.post('/providers/:providerId/keys', async (c) => {
  const providerId = c.req.param('providerId')
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseKeyBody(body)
  if (!data) return jsonError(c, 400, error!)

  const created = insertKey(newId(), providerId, data)
  return c.json(created, 201)
})

/** 更新 */
keys.put('/providers/:providerId/keys/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseKeyBody(body)
  if (!data) return jsonError(c, 400, error!)

  const updated = updateKey(id, data)
  if (!updated) return jsonError(c, 404, 'Key not found')
  return c.json(updated)
})

/** 删除 */
keys.delete('/providers/:providerId/keys/:id', (c) => {
  const id = c.req.param('id')
  if (!removeKey(id)) return jsonError(c, 404, 'Key not found')
  return c.json({ok: true})
})
