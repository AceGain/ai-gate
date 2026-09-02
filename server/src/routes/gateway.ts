/**
 * 网关数据面（/v1/*）：OpenAI 兼容入口
 * - GET  /v1/models            对外汇总已启用模型
 * - POST /v1/chat/completions  按模型路由转发：
 *   openai 上游原样透传（含 SSE 流式）；anthropic / gemini 上游做非流式协议转换
 */
import type {Context} from 'hono'
import {Hono} from 'hono'
import {loadProviders} from '../store'
import {collectEnabledModels, resolveModel} from '../router'
import {
  fromAnthropicResponse,
  fromGeminiResponse,
  type OpenAIChatRequest,
  toAnthropicRequest,
  toGeminiRequest
} from '../translate'
import {upstreamErrorMessage} from '../upstream'

export const gateway = new Hono()

/** OpenAI 风格错误响应（用原生 Response 绕开 Hono 的字面量类型约束） */
function openaiError(_c: Context, status: number, message: string): Response {
  return new Response(JSON.stringify({error: {message, type: 'ai_gate_error', code: status}}), {
    status,
    headers: {'Content-Type': 'application/json; charset=UTF-8'}
  })
}

/** 对外模型列表（OpenAI /v1/models 格式） */
gateway.get('/v1/models', async (c) => {
  const providers = await loadProviders()
  const data = collectEnabledModels(providers).map(({model, providerId}) => ({
    id: model,
    object: 'model',
    created: 0,
    owned_by: providerId
  }))
  return c.json({object: 'list', data})
})

/** 对话转发（OpenAI /v1/chat/completions 格式） */
gateway.post('/v1/chat/completions', async (c) => {
  let body: OpenAIChatRequest
  try {
    body = await c.req.json<OpenAIChatRequest>()
  } catch {
    return openaiError(c, 400, 'Invalid JSON body')
  }
  if (!body?.model) {
    return openaiError(c, 400, 'Missing "model" in request body')
  }

  const providers = await loadProviders()
  const target = resolveModel(providers, body.model)
  if (!target) {
    return openaiError(c, 404, `Model "${body.model}" is not available: not enabled or no usable key`)
  }

  try {
    // openai 上游：原样透传（客户端与上游同协议，流式直接管道转发）
    if (target.protocol === 'openai') {
      const res = await fetch(target.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${target.key.value}`
        },
        body: JSON.stringify(body),
        ...(body.stream ? {} : {signal: AbortSignal.timeout(120_000)})
      })
      return new Response(res.body, {
        status: res.status,
        headers: {'Content-Type': res.headers.get('content-type') ?? 'application/json'}
      })
    }

    if (body.stream) {
      return openaiError(c, 400, `Streaming is not yet supported for "${target.protocol}" upstream`)
    }
    if (body.tools?.length) {
      return openaiError(c, 400, `Tools are not yet supported for "${target.protocol}" upstream`)
    }

    if (target.protocol === 'anthropic') {
      const res = await fetch(target.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': target.key.value,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(toAnthropicRequest(body)),
        signal: AbortSignal.timeout(120_000)
      })
      const text = await res.text()
      if (!res.ok) {
        return openaiError(c, res.status, `HTTP ${res.status}: ${upstreamErrorMessage(text)}`)
      }
      const json = JSON.parse(text) as Parameters<typeof fromAnthropicResponse>[0]
      return c.json(fromAnthropicResponse(json, body.model))
    }

    // gemini 上游
    const res = await fetch(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': target.key.value
      },
      body: JSON.stringify(toGeminiRequest(body)),
      signal: AbortSignal.timeout(120_000)
    })
    const text = await res.text()
    if (!res.ok) {
      return openaiError(c, res.status, `HTTP ${res.status}: ${upstreamErrorMessage(text)}`)
    }
    const json = JSON.parse(text) as Parameters<typeof fromGeminiResponse>[0]
    return c.json(fromGeminiResponse(json, body.model))
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return openaiError(c, 504, 'Upstream request timed out')
    }
    return openaiError(c, 502, err instanceof Error ? err.message : 'Upstream request failed')
  }
})
