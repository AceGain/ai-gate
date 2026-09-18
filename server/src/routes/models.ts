/**
 * 供应商模型 API（/api/providers/:providerId/models）：sys_model 表的 CRUD
 */
import {Hono} from 'hono'
import {newId} from '../../../shared/sys-provider'
import {SYS_MODEL_DEFAULT_CATEGORY} from '../../../shared/sys-model'
import type {RemoteModelItem, SysModelInput, SysModelReasoning, SysModelStatus, SysModelType} from '../../../shared/sys-model'
import {insertModel, listEndpoints, listKeys, listModels, removeModel, reorderModels, updateModel} from '../store'
import {extractUpstreamDetail, joinUrl} from '../upstream'

export const models = new Hono()

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
      // 未指定分组时归入默认分组 Default
      category: (typeof p.category === 'string' && p.category.trim()) ? p.category.trim() : SYS_MODEL_DEFAULT_CATEGORY,
      enabled: p.enabled !== false,
      status: (p.status === 'INVALID' ? 'INVALID' : 'ACTIVE') as SysModelStatus,
      type: p.type as SysModelType,
      inputModal: Array.isArray(p.inputModal) ? p.inputModal : ['text'],
      outputModal: Array.isArray(p.outputModal) ? p.outputModal : ['text'],
      generates: Array.isArray(p.generates) ? p.generates : [],
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
models.get('/providers/:providerId/models', async (c) => {
  const providerId = c.req.param('providerId')
  return c.json(await listModels(providerId))
})

/** 批量排序（须在 PUT /:id 之前注册） */
models.put('/providers/:providerId/models/reorder', async (c) => {
  const body = await c.req.json<unknown>().catch(() => null)
  if (!Array.isArray(body) || !body.every(isReorderItem)) {
    return c.json({error: 'Body must be an array of {id, sort}'}, 400)
  }
  await reorderModels(body)
  return c.json({ok: true})
})

/** 依序取第一个非空字符串值 */
function firstNonEmptyString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

/**
 * 从上游响应解析模型列表：兼容 OpenAI 风格 {data: [...]}、{models: [...]} 与裸数组；
 * 条目编码取 id/code/name，显示名取 display_name/displayName；结构无法识别时返回 null
 */
function extractRemoteModels(json: unknown): RemoteModelItem[] | null {
  let arr: unknown[] | null = null
  if (Array.isArray(json)) {
    arr = json
  } else if (json && typeof json === 'object') {
    const {data, models} = json as {data?: unknown, models?: unknown}
    if (Array.isArray(data)) arr = data
    else if (Array.isArray(models)) arr = models
  }
  if (!arr) return null

  const items: RemoteModelItem[] = []
  const seen = new Set<string>()
  for (const entry of arr) {
    if (!entry || typeof entry !== 'object') continue
    const obj = entry as Record<string, unknown>
    const code = firstNonEmptyString(obj.id, obj.code, obj.name)
    if (!code || seen.has(code)) continue
    seen.add(code)
    items.push({code, name: firstNonEmptyString(obj.display_name, obj.displayName) ?? ''})
  }
  return items
}

/** 从上游模型列表端点拉取可用模型（经服务端转发，规避浏览器跨域） */
models.get('/providers/:providerId/models/remote', async (c) => {
  const providerId = c.req.param('providerId')
  const endpoints = await listEndpoints(providerId)
  const base = endpoints.find(e => e.type === 'base')
  const modelsEndpoint = endpoints.find(e => e.type === 'models')
  if (!base?.path?.trim()) return c.json({error: 'MISSING_BASE_ENDPOINT'}, 400)
  if (!modelsEndpoint?.path?.trim()) return c.json({error: 'MISSING_MODELS_ENDPOINT'}, 400)

  const url = joinUrl(base.path.trim(), modelsEndpoint.path.trim())
  const keys = await listKeys(providerId)
  const key = keys.find(k => k.enabled && k.status === 'ACTIVE')
  const headers: Record<string, string> = key ? {Authorization: `Bearer ${key.secret}`} : {}

  let res: Response
  try {
    res = await fetch(url, {headers, signal: AbortSignal.timeout(15_000)})
  } catch (err) {
    console.warn('[ai-gate] 拉取上游模型列表失败:', url, err)
    return c.json({error: 'UPSTREAM_UNREACHABLE'}, 502)
  }
  if (!res.ok) return c.json({error: 'UPSTREAM_ERROR', detail: `HTTP ${res.status}`}, 502)

  const json: unknown = await res.json().catch(() => null)
  const items = extractRemoteModels(json)
  if (!items) return c.json({error: 'UPSTREAM_INVALID_RESPONSE'}, 502)
  return c.json({models: items})
})

/** 组装最小生成测试请求：按生成端点类型选择请求体与认证头 */
function buildTestPayload(generate: string, code: string, key: string | undefined): {headers: Record<string, string>, body: unknown} {
  const headers: Record<string, string> = {'Content-Type': 'application/json'}
  if (key) {
    if (generate === 'Messages') {
      headers['x-api-key'] = key
      headers['anthropic-version'] = '2023-06-01'
    } else {
      headers.Authorization = `Bearer ${key}`
    }
  }
  const body = generate === 'Responses'
    ? {model: code, input: 'ping', max_output_tokens: 1}
    : {model: code, messages: [{role: 'user', content: 'ping'}], max_tokens: 1}
  return {headers, body}
}

/** 测试单个模型可用性：以最小生成请求打到上游，返回延迟；失败返回错误码 + 详情 */
models.post('/providers/:providerId/models/:id/test', async (c) => {
  const providerId = c.req.param('providerId')
  const id = c.req.param('id')
  const model = (await listModels(providerId)).find(m => m.id === id)
  if (!model) return c.json({error: 'MODEL_NOT_FOUND'}, 404)

  const endpoints = await listEndpoints(providerId)
  const base = endpoints.find(e => e.type === 'base')
  if (!base?.path?.trim()) return c.json({error: 'MISSING_BASE_ENDPOINT'}, 400)
  const generate = endpoints.find(e => e.type === 'generate' && model.generates.includes(e.generate))
    ?? endpoints.find(e => e.type === 'generate' && e.isDefault)
    ?? endpoints.find(e => e.type === 'generate')
  if (!generate?.path?.trim()) return c.json({error: 'MISSING_GENERATE_ENDPOINT'}, 400)

  const keys = await listKeys(providerId)
  const key = keys.find(k => k.enabled && k.status === 'ACTIVE')?.secret

  const url = joinUrl(base.path.trim(), generate.path.trim())
  const {headers, body} = buildTestPayload(generate.generate, model.code, key)

  const startedAt = Date.now()
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000)
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return c.json({error: 'UPSTREAM_TIMEOUT'}, 502)
    }
    console.warn('[ai-gate] 测试模型失败:', url, err)
    return c.json({error: 'UPSTREAM_UNREACHABLE'}, 502)
  }
  const latencyMs = Date.now() - startedAt
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return c.json({error: 'UPSTREAM_ERROR', detail: extractUpstreamDetail(res.status, text)}, 502)
  }
  return c.json({ok: true, latencyMs})
})

/** 批量导入模型：跳过已存在的编码，其余以最小配置落库（类型、分组等后续在编辑弹窗完善） */
models.post('/providers/:providerId/models/import', async (c) => {
  const providerId = c.req.param('providerId')
  const body = await c.req.json<unknown>().catch(() => null)
  const rawModels = (body as {models?: unknown} | null)?.models
  if (!Array.isArray(rawModels) || rawModels.length === 0) {
    return c.json({error: 'Body must be {models: [{code, name?, type?}]}'}, 400)
  }

  const parsed: {code: string, name: string, type: SysModelType}[] = []
  for (const raw of rawModels) {
    const p = (raw ?? {}) as Partial<SysModelInput>
    const code = typeof p.code === 'string' ? p.code.trim() : ''
    if (!code) return c.json({error: 'Invalid model: missing code'}, 400)
    if (!p.type || !VALID_TYPES.has(p.type)) {
      return c.json({error: 'Invalid model: type must be GenText, GenImage, GenAudio, GenVideo, Embedding, or Rerank'}, 400)
    }
    parsed.push({code, name: typeof p.name === 'string' ? p.name.trim() : '', type: p.type})
  }

  const endpoints = await listEndpoints(providerId)
  const defaultGenerate = endpoints.find(e => e.type === 'generate' && e.isDefault)
    ?? endpoints.find(e => e.type === 'generate')
  const initialGenerate = defaultGenerate?.generate || defaultGenerate?.path || ''

  const existing = await listModels(providerId)
  const existingCodes = new Set(existing.map(m => m.code))
  let nextSort = existing.reduce((max, m) => Math.max(max, m.sort), -1) + 1

  let imported = 0
  let skipped = 0
  for (const item of parsed) {
    if (existingCodes.has(item.code)) {
      skipped++
      continue
    }
    await insertModel(newId(), providerId, {
      code: item.code,
      name: item.name,
      category: SYS_MODEL_DEFAULT_CATEGORY,
      type: item.type,
      inputModal: ['text'],
      outputModal: ['text'],
      generates: initialGenerate ? [initialGenerate] : [],
      sort: nextSort++
    })
    existingCodes.add(item.code)
    imported++
  }
  return c.json({imported, skipped}, 201)
})

/** 新增 */
models.post('/providers/:providerId/models', async (c) => {
  const providerId = c.req.param('providerId')
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseModelBody(body)
  if (!data) return c.json({error: error!}, 400)

  try {
    const created = await insertModel(newId(), providerId, data)
    return c.json(created, 201)
  } catch (err) {
    if (isUniqueViolation(err)) return c.json({error: `Duplicate model code: ${data.code}`}, 409)
    throw err
  }
})

/** 更新 */
models.put('/providers/:providerId/models/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseModelBody(body)
  if (!data) return c.json({error: error!}, 400)

  try {
    const updated = await updateModel(id, data)
    if (!updated) return c.json({error: 'Model not found'}, 404)
    return c.json(updated)
  } catch (err) {
    if (isUniqueViolation(err)) return c.json({error: `Duplicate model code: ${data.code}`}, 409)
    throw err
  }
})

/** 删除 */
models.delete('/providers/:providerId/models/:id', async (c) => {
  const id = c.req.param('id')
  if (!(await removeModel(id))) return c.json({error: 'Model not found'}, 404)
  return c.json({ok: true})
})
