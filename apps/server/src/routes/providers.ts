/**
 * 出站供应商（S 域）API（/api/providers）：s_provider 表的逐条 CRUD
 * id 与时间戳由服务端/数据库维护；code 冲突返回 409，记录不存在返回 404
 */
import {Hono} from 'hono'
import * as v from 'valibot'
import {SProviderCreateSchema, SProviderUpdateSchema, SReorderSchema} from '@ai-gate/shared'
import {
  getProvider,
  insertProvider,
  listProviders,
  removeProvider,
  reorderProviders,
  updateProvider,
} from '../store.js'

export const providers = new Hono()

/** 路径参数 id 解析（自增主键，非正整数视为非法） */
export function parseId(raw: string): number | null {
  const n = Number(raw)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/** UNIQUE 约束冲突判断（better-sqlite3 以 SqliteError.code 暴露） */
export function isUniqueViolation(err: unknown): boolean {
  if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) return true
  const code = (err as {code?: string} | null)?.code
  return code === 'SQLITE_CONSTRAINT' || code === 'SQLITE_CONSTRAINT_UNIQUE'
}

/** 请求体校验：失败返回首个 issue 的文案 */
export function parseBody<T>(schema: v.GenericSchema<T>, raw: unknown): {data?: T, error?: string} {
  const result = v.safeParse(schema, raw)
  if (!result.success) {
    return {error: result.issues[0]?.message ?? 'Invalid request body'}
  }
  return {data: result.output}
}

/** 列表 */
providers.get('/providers', (c) => {
  return c.json(listProviders())
})

/** 批量排序（列表拖拽后的持久化）；须注册在 PUT /:id 之前，避免 "reorder" 被当作 :id */
providers.put('/providers/reorder', async (c) => {
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseBody(SReorderSchema, body)
  if (!data) return c.json({error: 'INVALID_REQUEST', detail: error!}, 400)
  reorderProviders(data)
  return c.json({ok: true})
})

/** 详情 */
providers.get('/providers/:id', (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({error: 'PROVIDER_NOT_FOUND'}, 404)
  const provider = getProvider(id)
  if (!provider) return c.json({error: 'PROVIDER_NOT_FOUND'}, 404)
  return c.json(provider)
})

/** 新增：事务内初始化 base/models 端点与可选的生成端点、初始密钥 */
providers.post('/providers', async (c) => {
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseBody(SProviderCreateSchema, body)
  if (!data) return c.json({error: 'INVALID_REQUEST', detail: error!}, 400)

  try {
    return c.json(insertProvider(data), 201)
  } catch (err) {
    if (isUniqueViolation(err)) return c.json({error: 'DUPLICATE_PROVIDER_CODE'}, 409)
    throw err
  }
})

/** 全量更新单条（code 创建后不可变，忽略） */
providers.put('/providers/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({error: 'PROVIDER_NOT_FOUND'}, 404)
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseBody(SProviderUpdateSchema, body)
  if (!data) return c.json({error: 'INVALID_REQUEST', detail: error!}, 400)

  try {
    const updated = updateProvider(id, data)
    if (!updated) return c.json({error: 'PROVIDER_NOT_FOUND'}, 404)
    return c.json(updated)
  } catch (err) {
    if (isUniqueViolation(err)) return c.json({error: 'DUPLICATE_PROVIDER_CODE'}, 409)
    throw err
  }
})

/** 删除 */
providers.delete('/providers/:id', (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({error: 'PROVIDER_NOT_FOUND'}, 404)
  if (!removeProvider(id)) return c.json({error: 'PROVIDER_NOT_FOUND'}, 404)
  return c.json({ok: true})
})
