import { toc } from '@lobehub/icons-vue/es/toc'
import { defineAsyncComponent, shallowRef, type Component } from 'vue'
import importIconBundle from 'virtual:lobe-brand-icon-loader'

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

export type BrandIconComponents = Readonly<Record<string, Component>>
const loadedBrandIcons = shallowRef<BrandIconComponents>()
let iconBundle: Promise<BrandIconComponents> | undefined
let loadAttempt = 0

/** 合并并发请求；失败后清除请求缓存，允许选择器重试。 */
export function loadBrandIcons(): Promise<BrandIconComponents> {
  return iconBundle ??= importIconBundle(loadAttempt++)
    .then(({ default: icons }) => {
      const components = Object.fromEntries(
        Object.entries(icons).map(([id, component]) => [id.toLowerCase(), component]),
      )
      loadedBrandIcons.value = components
      return components
    })
    .catch(error => {
      iconBundle = undefined
      throw error
    })
}

// 图标代码首次使用时加载；默认组件按品牌复用，头像可提供独立的回退内容。
const brandIcons = new Map(toc.map(brand => {
  const loader = async () => {
    const icons = await loadBrandIcons()
    return icons[brand.id.toLowerCase()]
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
  if (!id) return undefined
  const entry = brandIcons.get(id)
  if (!entry) return undefined
  // 共享分包恢复时通知已有头像，直接使用 SVG，替换其已失败的异步组件。
  const loaded = loadedBrandIcons.value?.[id]
  if (loaded) return loaded
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
