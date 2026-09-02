/**
 * 上游错误信息提取：兼容 Anthropic / OpenAI / Gemini 等常见错误结构
 */

/** 从上游错误响应文本中提取可读信息 */
export function upstreamErrorMessage(text: string): string {
  try {
    const json = JSON.parse(text) as { error?: { message?: string }, message?: string }
    return json.error?.message || json.message || text.slice(0, 200)
  } catch {
    return text.slice(0, 200) || 'Upstream error'
  }
}

/** 读取上游失败响应并提取错误信息 */
export async function upstreamError(res: Response): Promise<string> {
  return `HTTP ${res.status}: ${upstreamErrorMessage(await res.text())}`
}
