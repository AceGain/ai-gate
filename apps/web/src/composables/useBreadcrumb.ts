import type { MessageKey } from '@/i18n'
import type { InjectionKey, MaybeRefOrGetter, ShallowRef } from 'vue'
import { inject, onScopeDispose, provide, shallowRef, toValue, watchEffect } from 'vue'

export interface BreadcrumbItemRecord {
  label: string
  to?: string
}

declare module 'vue-router' {
  interface RouteMeta {
    titleKey?: MessageKey
    breadcrumbs?: { labelKey: MessageKey, to?: string }[]
  }
}

export interface BreadcrumbContext {
  customBreadcrumbs: ShallowRef<BreadcrumbItemRecord[] | null>
  setBreadcrumbs: (items: BreadcrumbItemRecord[]) => void
  clearBreadcrumbs: () => void
}

export const breadcrumbContextKey: InjectionKey<BreadcrumbContext> = Symbol('breadcrumbContext')

/**
 * 在 Layout 中初始化面包屑上下文并提供给子组件
 */
export function useProvideBreadcrumb(): BreadcrumbContext {
  const customBreadcrumbs = shallowRef<BreadcrumbItemRecord[] | null>(null)

  function setBreadcrumbs(items: BreadcrumbItemRecord[]) {
    customBreadcrumbs.value = items
  }

  function clearBreadcrumbs() {
    customBreadcrumbs.value = null
  }

  const context: BreadcrumbContext = {
    customBreadcrumbs,
    setBreadcrumbs,
    clearBreadcrumbs,
  }

  provide(breadcrumbContextKey, context)

  return context
}

/**
 * 页面级组件调用，用于动态设置当前页面的面包屑层级。
 * 组件销毁或作用域清理时会自动还原。
 */
export function useBreadcrumb(items: MaybeRefOrGetter<BreadcrumbItemRecord[]>) {
  const ctx = inject(breadcrumbContextKey, null)
  if (!ctx) return

  watchEffect(() => {
    ctx.setBreadcrumbs(toValue(items))
  })

  onScopeDispose(() => {
    ctx.clearBreadcrumbs()
  })
}

export const useBreadcrumbs = useBreadcrumb
