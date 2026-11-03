import { toc } from '@lobehub/icons-vue/es/toc'
import { defineAsyncComponent, type Component } from 'vue'

/** 持久化 ID 沿用小写品牌名；目录直接使用上游 Vue 包。 */
export const providerIconOptions = toc.map(brand => ({
  value: brand.id.toLowerCase(),
  label: brand.fullTitle,
})).sort((a, b) => a.value.localeCompare(b.value))

const legacyBrandIconKeys = new Map([
  ['googlegemini', 'gemini'],
  ['moonshotai', 'moonshot'],
  ['mistralai', 'mistral'],
])

// 图标代码首次使用时加载；默认组件按品牌复用，头像可提供独立的回退内容。
const brandIcons = new Map(toc.map(brand => {
  const loader = async () => {
    const { default: icons } = await import('virtual:lobe-brand-icons')
    return icons[brand.id]
  }
  return [brand.id.toLowerCase(), { loader, component: defineAsyncComponent(loader) }] as const
}))

/** 历史别名解析为当前 ID；未知值返回 undefined，交由头像展示首字母。 */
export function resolveBrandId(icon: string): string | undefined {
  const id = legacyBrandIconKeys.get(icon) ?? icon
  return brandIcons.has(id) ? id : undefined
}

export function resolveBrandIcon(icon: string, fallback?: Component) {
  const id = resolveBrandId(icon)
  const entry = id ? brandIcons.get(id) : undefined
  if (!entry) return undefined
  if (!fallback) return entry.component
  return defineAsyncComponent({
    loader: entry.loader,
    loadingComponent: fallback,
    errorComponent: fallback,
    delay: 0,
  })
}

/** 空串表示自动，使用供应商名称首字母回退。 */
export const defaultProviderIcon = ''

/** 自定义上传图片或外部图片地址，由应用层处理。 */
export function isCustomIcon(icon: string): boolean {
  return icon.startsWith('data:') || icon.startsWith('http://') || icon.startsWith('https://')
}
