/**
 * 管理 API（/api/*）：供应商配置 CRUD 与模型列表拉取转发
 * 前端 useProviders / fetchProviderModels 的唯一后端入口
 */
import {Hono} from 'hono'
import type {Context} from 'hono'
import type {ProviderConfig, ProviderProtocolId} from '../../../shared/providers'
import {joinUrl} from '../../../shared/providers'
import {loadProviders, saveProviders} from '../store'
import {upstreamErrorMessage} from '../upstream'

export const admin = new Hono()

/** JSON 错误响应（status 为任意上游状态码，用原生 Response 绕开 Hono 的字面量类型约束） */
function jsonError(_c: Context, status: number, error: string): Response {
  return new Response(JSON.stringify({error}), {
    status,
    headers: {'Content-Type': 'application/json; charset=UTF-8'}
  })
}

/** 获取全部供应商配置 */
admin.get('/providers', async (c) => {
  return c.json(await loadProviders())
})

/** 全量替换供应商配置（前端防抖保存 / 一次性迁移的写入入口） */
admin.put('/providers', async (c) => {
  const body = await c.req.json<unknown>().catch(() => null)
  if (!Array.isArray(body)) {
    return jsonError(c, 400, 'Body must be a provider array')
  }

  // providerId 唯一性校验（与前端表单校验规则一致）
  const seen = new Set<string>()
  for (const item of body) {
    const p = item as Partial<ProviderConfig> | null
    if (!p || typeof p.id !== 'string' || !p.id || typeof p.providerId !== 'string' || !p.providerId) {
      return jsonError(c, 400, 'Invalid provider entry: missing id or providerId')
    }
    if (seen.has(p.providerId)) {
      return jsonError(c, 400, `Duplicate provider ID: ${p.providerId}`)
    }
    seen.add(p.providerId)
  }

  await saveProviders(body as ProviderConfig[])
  return c.json({ok: true})
})

interface FetchModelsBody {
  baseUrl: string
  protocol: ProviderProtocolId
  modelsEndpoint: string
  apiKey: string
}

/**
 * 模型列表拉取转发：前端直连供应商接口受 CORS 限制，统一由后端代理
 * 返回归一化的模型 id 列表（与前端 fetchProviderModels 约定 {models: string[]}）
 */
admin.post('/fetch-models', async (c) => {
  const body = await c.req.json<FetchModelsBody>().catch(() => null)
  const {baseUrl, protocol, modelsEndpoint, apiKey} = body ?? {}
  if (!baseUrl || !modelsEndpoint || !apiKey) {
    return jsonError(c, 400, 'Missing baseUrl, modelsEndpoint or apiKey')
  }

  const headers: Record<string, string> = {}
  if (protocol === 'openai') {
    headers.Authorization = `Bearer ${apiKey}`
  } else if (protocol === 'anthropic') {
    headers['x-api-key'] = apiKey
    headers['anthropic-version'] = '2023-06-01'
  } else {
    headers['x-goog-api-key'] = apiKey
  }

  const url = joinUrl(baseUrl, modelsEndpoint)

  let res: Response
  try {
    res = await fetch(url, {headers, signal: AbortSignal.timeout(30_000)})
  } catch (err) {
    return jsonError(c, 502, err instanceof Error ? err.message : 'Upstream request failed')
  }

  const text = await res.text()
  if (!res.ok) {
    return jsonError(c, res.status, `HTTP ${res.status}: ${upstreamErrorMessage(text)}`)
  }

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return jsonError(c, 502, 'Invalid JSON response from upstream')
  }

  // Gemini: {models: [{name: 'models/xxx'}]}；OpenAI/Anthropic: {data: [{id: 'xxx'}]}
  if (protocol === 'gemini') {
    const models = Array.isArray((json as {models?: unknown}).models)
      ? (json as {models: {name?: string}[]}).models
      : []
    return c.json({models: models.map(m => String(m.name ?? '').replace(/^models\//, '')).filter(Boolean)})
  }

  const data = Array.isArray((json as {data?: unknown}).data)
    ? (json as {data: {id?: string}[]}).data
    : []
  return c.json({models: data.map(m => String(m.id ?? '')).filter(Boolean)})
})
