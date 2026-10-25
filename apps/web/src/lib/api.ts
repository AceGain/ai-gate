/**
 * 后端 API 客户端：统一基地址、JSON 序列化与错误形态
 * 后端错误体为 {error, detail?}；此处聚合成 ApiError 便于调用方按码就近提示
 */

/** 后端 API 基地址：默认同源（dev 经 Vite 代理，生产同源部署）；Tauri 桌面端构建时通过 VITE_API_BASE 指向后端 */
export function apiBase(): string {
  const base = import.meta.env.VITE_API_BASE as string | undefined
  return base ?? ''
}

/** 统一错误形态：status 为 HTTP 状态码，error/detail 来自后端错误体 */
export class ApiError extends Error {
  status: number
  code: string
  detail?: string

  constructor(status: number, code: string, detail?: string) {
    super(detail ? `${code}: ${detail}` : code)
    this.status = status
    this.code = code
    this.detail = detail
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let code = `HTTP ${res.status}`
  let detail: string | undefined
  try {
    const body = await res.json() as {error?: string, detail?: string}
    if (body.error) code = body.error
    detail = body.detail
  } catch { /* 非 JSON 错误体仅保留状态码 */ }
  return new ApiError(res.status, code, detail)
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}/api${path}`, {
    ...init,
    headers: {
      ...(init?.body !== undefined ? {'Content-Type': 'application/json'} : {}),
      ...init?.headers,
    },
  })
  if (!res.ok) throw await parseError(res)
  if (res.status === 204) return undefined as T
  return await res.json() as T
}
