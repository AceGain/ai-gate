import type { BrandIconAssets } from './types'

export function createBrandIconResolver(
  assets: Readonly<Record<string, BrandIconAssets>>,
  resolveId: (icon: string) => string | undefined,
): (icon: string, isDark?: boolean) => string {
  return (icon, isDark = false) => {
    const id = resolveId(icon)
    if (!id || !Object.hasOwn(assets, id)) return ''
    const entry = assets[id]
    if (entry.color) return (isDark ? entry.colorDark : undefined) ?? entry.color
    return (isDark ? entry.dark ?? entry.light : entry.light ?? entry.dark) ?? ''
  }
}
