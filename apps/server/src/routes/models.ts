/**
 * 出站供应商模型（S 域）API（/api/providers/:providerId/models）：s_model 表的 CRUD
 * + 上游模型列表拉取 / 单模型测试 / 批量导入（含密钥-模型绑定 s_relat）
 */
import {Hono} from 'hono'
import type {SRemoteModelItem, SRemoteModelKeyFetch} from '@ai-gate/shared'
import {SModelImportSchema, SModelInputSchema, MODEL_DEFAULT_CATEGORY, SReorderSchema} from '@ai-gate/shared'
import type {SKey, SModelInput, ModelType} from '@ai-gate/shared'
import {
  importModelsWithBindings,
  insertModel,
  listEndpoints,
  listKeys,
  listModels,
  removeModel,
  reorderModels,
  updateModel,
} from '../store.js'
import type {SModelImportItem} from '../store.js'
import {buildAuthHeaders, extractUpstreamDetail, joinUrl} from '../upstream.js'
import {isUniqueViolation, parseBody, parseId} from './providers.js'

export const models = new Hono()

/** 列表 */
models.get('/providers/:providerId/models', (c) => {
  const providerId = parseId(c.req.param('providerId'))
  if (!providerId) return c.json({error: 'PROVIDER_NOT_FOUND'}, 404)
  return c.json(listModels(providerId))
})

/** 批量排序（须在 PUT /:id 之前注册） */
models.put('/providers/:providerId/models/reorder', async (c) => {
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseBody(SReorderSchema, body)
  if (!data) return c.json({error: 'INVALID_REQUEST', detail: error!}, 400)
  reorderModels(data)
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
function extractRemoteModels(json: unknown): SRemoteModelItem[] | null {
  let arr: unknown[] | null = null
  if (Array.isArray(json)) {
    arr = json
  } else if (json && typeof json === 'object') {
    const {data, models} = json as {data?: unknown, models?: unknown}
    if (Array.isArray(data)) arr = data
    else if (Array.isArray(models)) arr = models
  }
  if (!arr) return null

  const items: SRemoteModelItem[] = []
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

/** 单把密钥拉取的并发上限：避免密钥较多时瞬时打满上游限频 */
const REMOTE_FETCH_CONCURRENCY = 4

/** 受限并发遍历（保序返回结果） */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index]!)
    }
  }
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, () => worker()))
  return results
}

/** 以单把密钥拉取上游模型列表；网络/超时/解析失败不影响其它密钥，以失败条目返回 */
async function fetchModelsForKey(url: string, generate: string | undefined, key: SKey): Promise<SRemoteModelKeyFetch> {
  const base: SRemoteModelKeyFetch = {keyId: key.id, keyName: key.name, ok: false, models: []}
  const headers = buildAuthHeaders(generate, key.secret)
  let res: Response
  try {
    res = await fetch(url, {headers, signal: AbortSignal.timeout(15_000)})
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return {...base, error: 'UPSTREAM_TIMEOUT'}
    }
    console.warn('[ai-gate] 拉取上游模型列表失败:', url, err)
    return {...base, error: 'UPSTREAM_UNREACHABLE'}
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return {...base, error: 'UPSTREAM_ERROR', detail: extractUpstreamDetail(res.status, text)}
  }
  const json: unknown = await res.json().catch(() => null)
  const items = extractRemoteModels(json)
  if (!items) return {...base, error: 'UPSTREAM_INVALID_RESPONSE'}
  return {keyId: key.id, keyName: key.name, ok: true, models: items}
}

/**
 * 按密钥拉取上游模型列表（经服务端转发，规避浏览器跨域）：
 * keys 查询参数（逗号分隔 id）指定密钥子集，缺省遍历全部启用且有效的密钥；
 * 逐密钥分组返回，单把失败不影响整体
 */
models.get('/providers/:providerId/models/remote', async (c) => {
  const providerId = parseId(c.req.param('providerId'))
  if (!providerId) return c.json({error: 'PROVIDER_NOT_FOUND'}, 404)
  const endpoints = listEndpoints(providerId)
  const base = endpoints.find(e => e.type === 'base')
  const modelsEndpoint = endpoints.find(e => e.type === 'models')
  if (!base?.path?.trim()) return c.json({error: 'MISSING_BASE_ENDPOINT'}, 400)
  if (!modelsEndpoint?.path?.trim()) return c.json({error: 'MISSING_MODELS_ENDPOINT'}, 400)

  const defaultGenerate = endpoints.find(e => e.type === 'generate' && e.isDefault)
    ?? endpoints.find(e => e.type === 'generate')

  const allKeys = listKeys(providerId)
  const activeKeys = allKeys.filter(k => k.enabled && k.status === 'ACTIVE')
  if (!activeKeys.length) return c.json({error: 'NO_ACTIVE_KEYS'}, 400)
  const requestedIds = [...new Set(
    c.req.query('keys')?.split(',').map(s => Number(s.trim())).filter(n => Number.isSafeInteger(n) && n > 0) ?? []
  )]
  const targets = requestedIds.length
    ? activeKeys.filter(k => requestedIds.includes(k.id))
    : activeKeys

  const url = joinUrl(base.path.trim(), modelsEndpoint.path.trim())
  const results = await mapWithConcurrency(targets, REMOTE_FETCH_CONCURRENCY,
    key => fetchModelsForKey(url, defaultGenerate?.generate, key))

  // 请求中不可用（停用/失效/不存在）的密钥以失败条目返回，便于前端就地提示
  for (const id of requestedIds) {
    if (targets.some(k => k.id === id)) continue
    results.push({
      keyId: id,
      keyName: allKeys.find(k => k.id === id)?.name ?? '',
      ok: false,
      models: [],
      error: 'KEY_INACTIVE',
    })
  }
  return c.json({results})
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
  const providerId = parseId(c.req.param('providerId'))
  const id = parseId(c.req.param('id'))
  if (!providerId || !id) return c.json({error: 'MODEL_NOT_FOUND'}, 404)
  const model = listModels(providerId).find(m => m.id === id)
  if (!model) return c.json({error: 'MODEL_NOT_FOUND'}, 404)

  const endpoints = listEndpoints(providerId)
  const base = endpoints.find(e => e.type === 'base')
  if (!base?.path?.trim()) return c.json({error: 'MISSING_BASE_ENDPOINT'}, 400)
  const generate = endpoints.find(e => e.type === 'generate' && model.generates.includes(e.generate))
    ?? endpoints.find(e => e.type === 'generate' && e.isDefault)
    ?? endpoints.find(e => e.type === 'generate')
  if (!generate?.path?.trim()) return c.json({error: 'MISSING_GENERATE_ENDPOINT'}, 400)

  const keys = listKeys(providerId)
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
      signal: AbortSignal.timeout(20_000),
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

/** 批量导入模型：跳过已存在编码，其余以最小配置落库；请求中的密钥-模型绑定随同一事务写入（只增不删，冲突忽略） */
models.post('/providers/:providerId/models/import', async (c) => {
  const providerId = parseId(c.req.param('providerId'))
  if (!providerId) return c.json({error: 'PROVIDER_NOT_FOUND'}, 404)
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseBody(SModelImportSchema, body)
  if (!data) return c.json({error: 'INVALID_REQUEST', detail: error!}, 400)
  if (!data.models.length) {
    return c.json({error: 'INVALID_IMPORT_PAYLOAD'}, 400)
  }

  // 绑定校验：keyId 必须属于该供应商
  const providerKeyIds = new Set(listKeys(providerId).map(k => k.id))
  for (const binding of data.bindings ?? []) {
    if (!providerKeyIds.has(binding.keyId)) {
      return c.json({error: 'INVALID_BINDINGS'}, 400)
    }
  }

  const endpoints = listEndpoints(providerId)
  const defaultGenerate = endpoints.find(e => e.type === 'generate' && e.isDefault)
    ?? endpoints.find(e => e.type === 'generate')
  const initialGenerate = defaultGenerate?.generate || ''

  const items: SModelImportItem[] = data.models.map(item => ({
    input: {
      code: item.code,
      name: item.name,
      category: MODEL_DEFAULT_CATEGORY,
      type: item.type as ModelType,
      inputModal: ['text'],
      outputModal: ['text'],
      generates: initialGenerate ? [initialGenerate] : [],
    } satisfies SModelInput,
    keyIds: (data.bindings ?? [])
      .filter(binding => binding.codes.includes(item.code))
      .map(binding => binding.keyId),
  }))

  try {
    const {imported, skipped, bindings} = importModelsWithBindings(providerId, items)
    return c.json({imported, skipped, bindings}, 201)
  } catch (err) {
    if (isUniqueViolation(err)) return c.json({error: 'DUPLICATE_MODEL_CODE'}, 409)
    throw err
  }
})

/** 新增 */
models.post('/providers/:providerId/models', async (c) => {
  const providerId = parseId(c.req.param('providerId'))
  if (!providerId) return c.json({error: 'PROVIDER_NOT_FOUND'}, 404)
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseBody(SModelInputSchema, body)
  if (!data) return c.json({error: 'INVALID_REQUEST', detail: error!}, 400)

  try {
    return c.json(insertModel(providerId, data), 201)
  } catch (err) {
    if (isUniqueViolation(err)) return c.json({error: 'DUPLICATE_MODEL_CODE'}, 409)
    throw err
  }
})

/** 更新 */
models.put('/providers/:providerId/models/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({error: 'MODEL_NOT_FOUND'}, 404)
  const body = await c.req.json<unknown>().catch(() => null)
  const {data, error} = parseBody(SModelInputSchema, body)
  if (!data) return c.json({error: 'INVALID_REQUEST', detail: error!}, 400)

  try {
    const updated = updateModel(id, data)
    if (!updated) return c.json({error: 'MODEL_NOT_FOUND'}, 404)
    return c.json(updated)
  } catch (err) {
    if (isUniqueViolation(err)) return c.json({error: 'DUPLICATE_MODEL_CODE'}, 409)
    throw err
  }
})

/** 删除 */
models.delete('/providers/:providerId/models/:id', (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({error: 'MODEL_NOT_FOUND'}, 404)
  if (!removeModel(id)) return c.json({error: 'MODEL_NOT_FOUND'}, 404)
  return c.json({ok: true})
})
