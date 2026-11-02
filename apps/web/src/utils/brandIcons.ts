import { brandIconOptions, resolveBrandIcon } from '@ai-gate/brand-icons'

/** 可选的供应商显示图标（品牌目录由内部包统一维护）。 */
export const providerIconOptions = brandIconOptions

/** 空串表示自动，使用供应商名称首字母回退。 */
export const defaultProviderIcon = ''

/** 自定义上传图片或外部图片地址，由应用层处理。 */
export function isCustomIcon(icon: string): boolean {
  return icon.startsWith('data:') || icon.startsWith('http://') || icon.startsWith('https://')
}

/** 自定义图片原样返回；品牌图标由内部包解析；未知品牌返回空串。 */
export function brandIconUrl(icon: string, isDark = false): string {
  if (isCustomIcon(icon)) return icon
  return resolveBrandIcon(icon, isDark)
}
