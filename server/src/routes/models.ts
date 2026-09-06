/**
 * 供应商模型 API（/api/providers/:providerId/models）：sys_model 表的 CRUD
 */
import type {Context} from 'hono'
import {Hono} from 'hono'
import {newId} from '../../../shared/sys-provider'
import type {SysModelInput, SysModelReasoning, SysModelStatus, SysModelType} from '../../../shared/sys-model'
import {getModel, insertModel, listModels, removeModel, reorderModels, updateModel} from '../store'

export const models = new Hono()

function jsonError(_c: Context, status: number, error: string): Response {
  return new Response(JSON.stringify({error}), {
    status,
    headers: {'Content-Type': 'application/json; charset=UTF-8'}
  })
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && err.message.includes('UNIQUE constraint failed')
}

const VALID_TYPES = new Set<string>(['GenText', 'GenImage', 'GenAudio', 'GenVideo', 'Embedding', 'Rerank'])
const VALID_REASONINGS = new Set<string>(['DISABLE', 'ALWAYS', 'SWITCH', 'TOGGLE'])

function parseModelBody(raw: unknown): {data?: SysModelInput; error?: string} {
  const p = (raw ?? {}) as Partial<SysModelInput>
  if (typeof p.code !== 'string' || !p.code.trim()) {
    return {error: 'Invalid model: missing code'}
  }
  if (!p.type || !VALID_TYPES.has(p.type)) {
    return {error: 'Invalid model: type must be GenText, GenImage, GenAudio, GenVideo, Embedding, or Rerank'}
  }
  return {
    data: {
      code: p.code.trim(),
      name: typeof p.name === 'string' ? p.name.trim() : '',
      category: typeof p.category === 'string' ? p.category.trim() : '',
      enabled: p.enabled !== false,
      status: (p.status === 'INVALID' ? 'INVALID' : 'ACTIVE') as SysModelStatus,
      type: p.type as SysModelType,
      inputModal: Array.isArray(p.inputModal) ? p.inputModal : ['text'],
      outputModal: Array.isArray(p.outputModal) ? p.outputModal : ['text'],
      protocols: Array.isArray(p.protocols) ? p.protocols : [],
      maxContext: typeof p.maxContext === 'number' && p.maxContext >= 0 ? p.maxContext : 0,
      maxInput: typeof p.maxInput === 'number' && p.maxInput >= 0 ? p.maxInput : 0,
      maxOutput: typeof p.maxOutput === 'number' && p.maxOutput >= 0 ? p.maxOutput : 0,
      reasoning: (p.reasoning && VALID_REASONINGS.has(p.reasoning) ? p.reasoning : 'TOGGLE') as SysModelReasoning,
      effortLevel: Array.isArray(p.effortLevel) ? p.effortLevel : [],
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
models.get('/providers/:providerId/models', (c) => {
  const providerId = c.req.param('providerId')
  return c.json(listModels(providerId))
})

/** 批量排序（须在 PUT /:id 之前注册） */
models.put('/providers/:providerId/models/reorder', async (c) => {
  const body = await c.req.json<unknown>().catch(() => null)
  if (!Array.isArray(body) || !body.every(isReorderItem)) {
    return jsonError(c, 400, 'Body must be an array of {id, sort}')
  }
  reorderModels(body)
  return c.json({ok: true})
})

/** 新增 */
models.post('/providers/:providerId/models', async (c) => {
  const providerId = c.req.param('providerId')
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseModelBody(body)
  if (!data) return jsonError(c, 400, error!)

  try {
    const created = insertModel(newId(), providerId, data)
    return c.json(created, 201)
  } catch (err) {
    if (isUniqueViolation(err)) return jsonError(c, 409, `Duplicate model code: ${data.code}`)
    throw err
  }
})

/** 更新 */
models.put('/providers/:providerId/models/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseModelBody(body)
  if (!data) return jsonError(c, 400, error!)

  try {
    const updated = updateModel(id, data)
    if (!updated) return jsonError(c, 404, 'Model not found')
    return c.json(updated)
  } catch (err) {
    if (isUniqueViolation(err)) return jsonError(c, 409, `Duplicate model code: ${data.code}`)
    throw err
  }
})

/** 删除 */
models.delete('/providers/:providerId/models/:id', (c) => {
  const id = c.req.param('id')
  if (!removeModel(id)) return jsonError(c, 404, 'Model not found')
  return c.json({ok: true})
})
