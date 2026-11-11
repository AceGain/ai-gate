import { toc } from '@lobehub/icons-vue/es/toc'
import { defineAsyncComponent, shallowReactive, type Component } from 'vue'
import iconLoaders from 'virtual:lobe-brand-icon-loader'

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

const loadedBrandIcons = shallowReactive(new Map<string, Component>())
const iconRequests = new Map<string, Promise<Component>>()
const loadAttempts = new Map<string, number>()

/** 按品牌合并并发请求并缓存；单个品牌失败不影响其他图标。 */
export function loadBrandIcon(icon: string): Promise<Component> {
  const id = resolveBrandId(icon)
  if (!id) return Promise.reject(new Error(`Unknown brand icon: ${icon}`))
  const existing = iconRequests.get(id)
  if (existing) return existing
  const attempt = loadAttempts.get(id) ?? 0
  loadAttempts.set(id, attempt + 1)
  const request = iconLoaders[id](attempt)
    .then(({ default: component }) => {
      loadedBrandIcons.set(id, component)
      return component
    })
    .catch(error => {
      iconRequests.delete(id)
      throw error
    })
  iconRequests.set(id, request)
  return request
}

export function getLoadedBrandIcon(icon: string): Component | undefined {
  const id = resolveBrandId(icon)
  return id ? loadedBrandIcons.get(id) : undefined
}

// 图标代码首次使用时加载；默认组件按品牌复用，头像可提供独立的回退内容。
const brandIcons = new Map(toc.map(brand => {
  const loader = () => loadBrandIcon(brand.id.toLowerCase())
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
  // 同一品牌重试成功时通知已有头像，替换其已失败的异步组件。
  const loaded = loadedBrandIcons.get(id)
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
