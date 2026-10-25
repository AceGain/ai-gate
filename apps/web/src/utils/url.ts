/**
 * 将基地址与相对路径拼接为完整 URL，并返回拆分后的结构
 * basePart 弱化展示域名、pathPart 高亮路径；端点为绝对地址时直接拆其自身
 */
export function splitUrl(baseUrl?: string, path?: string): {basePart: string, pathPart: string, fullUrl: string} {
  if (!path) return {basePart: '', pathPart: '', fullUrl: ''}
  const trimmedPath = path.trim()
  if (!trimmedPath) return {basePart: '', pathPart: '', fullUrl: ''}

  if (/^https?:\/\//i.test(trimmedPath)) {
    try {
      const u = new URL(trimmedPath)
      const origin = u.origin
      const pathname = trimmedPath.slice(origin.length)
      return {basePart: origin, pathPart: pathname, fullUrl: trimmedPath}
    } catch {
      return {basePart: '', pathPart: trimmedPath, fullUrl: trimmedPath}
    }
  }

  const base = baseUrl?.trim()
  if (!base) {
    return {basePart: '', pathPart: trimmedPath, fullUrl: trimmedPath}
  }

  const baseNormalized = base.replace(/\/+$/, '')
  const subNormalized = trimmedPath.replace(/^\/+/, '')
  const full = `${baseNormalized}/${subNormalized}`
  return {basePart: baseNormalized, pathPart: `/${subNormalized}`, fullUrl: full}
}
