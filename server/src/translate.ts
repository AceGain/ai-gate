/**
 * 协议转换：OpenAI 兼容请求 ↔ Anthropic / Gemini 上游（非流式）
 * 基础版本：仅覆盖文本对话（system/user/assistant）、max_tokens、temperature、top_p；
 * 工具调用与多模态内容暂不转换（openai 上游直接透传，不受此限制）
 */

export interface OpenAIChatMessage {
  role: string
  content: string | Array<{ type?: string; text?: string }> | null
}

export interface OpenAIChatRequest {
  model: string
  messages?: OpenAIChatMessage[]
  max_tokens?: number
  temperature?: number
  top_p?: number
  stream?: boolean
  tools?: unknown[]
}

/** 提取消息文本（兼容字符串与分段数组两种 content 形态） */
function textOf(content: OpenAIChatMessage['content']): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map(p => p?.text ?? '').join('')
  return ''
}

/** 拆分 system 消息与对话消息 */
function splitMessages(body: OpenAIChatRequest): {
  system: string
  messages: { role: 'user' | 'assistant'; content: string }[]
} {
  const systemParts: string[] = []
  const messages: { role: 'user' | 'assistant'; content: string }[] = []
  for (const m of body.messages ?? []) {
    const text = textOf(m.content)
    if (m.role === 'system') {
      if (text) systemParts.push(text)
      continue
    }
    messages.push({role: m.role === 'assistant' ? 'assistant' : 'user', content: text})
  }
  return {system: systemParts.join('\n\n'), messages}
}

// ---------- Anthropic ----------

export function toAnthropicRequest(body: OpenAIChatRequest): Record<string, unknown> {
  const {system, messages} = splitMessages(body)
  return {
    model: body.model,
    max_tokens: body.max_tokens ?? 4096,
    messages: messages.length > 0 ? messages : [{role: 'user', content: ''}],
    ...(system ? {system} : {}),
    ...(body.temperature != null ? {temperature: body.temperature} : {}),
    ...(body.top_p != null ? {top_p: body.top_p} : {})
  }
}

export function fromAnthropicResponse(
  resp: {
    id?: string
    content?: { type?: string; text?: string }[]
    stop_reason?: string
    usage?: { input_tokens?: number; output_tokens?: number }
  },
  model: string
): Record<string, unknown> {
  const content = (resp.content ?? []).filter(b => b.type === 'text').map(b => b.text ?? '').join('')
  const promptTokens = resp.usage?.input_tokens ?? 0
  const completionTokens = resp.usage?.output_tokens ?? 0
  return {
    id: `chatcmpl-${resp.id ?? crypto.randomUUID()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {role: 'assistant', content},
        finish_reason: resp.stop_reason === 'max_tokens' ? 'length' : 'stop'
      }
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens
    }
  }
}

// ---------- Gemini ----------

export function toGeminiRequest(body: OpenAIChatRequest): Record<string, unknown> {
  const {system, messages} = splitMessages(body)
  const contents = (messages.length > 0
      ? messages
      : [{role: 'user' as const, content: ''}]
  ).map(m => ({role: m.role === 'assistant' ? 'model' : 'user', parts: [{text: m.content}]}))

  const generationConfig: Record<string, number> = {}
  if (body.max_tokens != null) generationConfig.maxOutputTokens = body.max_tokens
  if (body.temperature != null) generationConfig.temperature = body.temperature
  if (body.top_p != null) generationConfig.topP = body.top_p

  return {
    contents,
    ...(system ? {systemInstruction: {parts: [{text: system}]}} : {}),
    ...(Object.keys(generationConfig).length > 0 ? {generationConfig} : {})
  }
}

export function fromGeminiResponse(
  resp: {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
  },
  model: string
): Record<string, unknown> {
  const candidate = resp.candidates?.[0]
  const content = (candidate?.content?.parts ?? []).map(p => p.text ?? '').join('')
  const promptTokens = resp.usageMetadata?.promptTokenCount ?? 0
  const completionTokens = resp.usageMetadata?.candidatesTokenCount ?? 0
  return {
    id: `chatcmpl-${crypto.randomUUID()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {role: 'assistant', content},
        finish_reason: candidate?.finishReason === 'MAX_TOKENS' ? 'length' : 'stop'
      }
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens
    }
  }
}
