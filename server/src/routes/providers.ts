/**
 * 供应商 API（/api/providers）：sys_provider 表的逐条 CRUD
 * id 与时间戳由服务端/数据库维护；code 冲突返回 409，记录不存在返回 404
 */
import {Hono} from 'hono'
import {newId} from '../../../shared/sys-provider'
import type {SysProviderInput} from '../../../shared/sys-provider'
import {getProvider, insertProvider, listProviders, removeProvider, reorderProviders, updateProvider} from '../store'

export const providers = new Hono()

/** 请求体解析与校验：code/name 必填，新增时 baseUrl 必填，sort 为非负整数 */
function parseProviderBody(raw: unknown, isCreate = false): {data?: SysProviderInput; error?: string} {
  const p = (raw ?? {}) as Partial<SysProviderInput>
  if (typeof p.code !== 'string' || !p.code.trim()) {
    return {error: 'Invalid provider entry: missing code'}
  }
  if (typeof p.name !== 'string' || !p.name.trim()) {
    return {error: 'Invalid provider entry: missing name'}
  }
  if (isCreate && (typeof p.baseUrl !== 'string' || !p.baseUrl.trim())) {
    return {error: 'Invalid provider entry: missing baseUrl'}
  }
  if (p.sort !== undefined && (!Number.isSafeInteger(p.sort) || p.sort < 0)) {
    return {error: 'Invalid provider entry: sort must be a non-negative integer'}
  }
  return {
    data: {
      code: p.code.trim(),
      name: p.name.trim(),
      icon: p.icon,
      enabled: p.enabled,
      description: p.description,
      sort: p.sort,
      ...(p.baseUrl ? {baseUrl: p.baseUrl.trim()} : {})
    }
  }
}

/** code 唯一约束冲突 → 409 */
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

/** 排序项校验 */
function isReorderItem(v: unknown): v is {id: string, sort: number} {
  const it = v as {id?: unknown, sort?: unknown} | null
  return !!it && typeof it.id === 'string' && !!it.id
    && typeof it.sort === 'number' && Number.isSafeInteger(it.sort) && it.sort >= 0
}

/** 列表 */
providers.get('/providers', async (c) => {
  return c.json(await listProviders())
})

/** 批量排序（列表拖拽后的持久化）；须注册在 PUT /:id 之前，避免 "reorder" 被当作 :id */
providers.put('/providers/reorder', async (c) => {
  const body = await c.req.json<unknown>().catch(() => null)
  if (!Array.isArray(body) || !body.every(isReorderItem)) {
    return c.json({error: 'Body must be an array of {id, sort}'}, 400)
  }
  await reorderProviders(body)
  return c.json({ok: true})
})

/** 详情 */
providers.get('/providers/:id', async (c) => {
  const provider = await getProvider(c.req.param('id'))
  if (!provider) return c.json({error: 'Provider not found'}, 404)
  return c.json(provider)
})

/** 新增 */
providers.post('/providers', async (c) => {
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseProviderBody(body, true)
  if (!data) return c.json({error: error!}, 400)

  try {
    const created = await insertProvider(newId(), data)
    return c.json(created, 201)
  } catch (err) {
    if (isUniqueViolation(err)) return c.json({error: `Duplicate provider code: ${data.code}`}, 409)
    throw err
  }
})

/** 全量更新单条 */
providers.put('/providers/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseProviderBody(body, false)
  if (!data) return c.json({error: error!}, 400)

  try {
    const updated = await updateProvider(id, data)
    if (!updated) return c.json({error: 'Provider not found'}, 404)
    return c.json(updated)
  } catch (err) {
    if (isUniqueViolation(err)) return c.json({error: `Duplicate provider code: ${data.code}`}, 409)
    throw err
  }
})

/** 删除 */
providers.delete('/providers/:id', async (c) => {
  if (!(await removeProvider(c.req.param('id')))) return c.json({error: 'Provider not found'}, 404)
  return c.json({ok: true})
})
