/**
 * 上游请求共享工具：模型/密钥测试与远程列表拉取共用的 URL 拼接与错误解析
 */

/** 拼接基地址与端点路径（端点为绝对地址时直接使用） */
export function joinUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

/** 从上游错误响应提取可读详情（兼容 OpenAI/Anthropic 的 error.message 结构） */
export function extractUpstreamDetail(status: number, text: string): string {
  try {
    const json = JSON.parse(text) as {error?: {message?: string} | string, message?: string}
    const msg = typeof json.error === 'string' ? json.error : json.error?.message ?? json.message
    if (msg) return `HTTP ${status}: ${msg}`
  } catch { /* 非 JSON 响应仅保留状态码 */ }
  return `HTTP ${status}`
}
