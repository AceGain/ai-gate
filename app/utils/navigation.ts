/**
 * 导航路由表：单一数据源
 * 路径需与 app/pages/ 文件系统路由保持一致；新增页面时在此登记
 */
export interface NavRoute {
  /** i18n 文案 key（nav.*） */
  labelKey: string
  /** Iconify 图标名 */
  icon: string
  /** 目标路由路径 */
  to: string
}

export const navRoutes: NavRoute[] = [
  {
    labelKey: 'nav.dashboard',
    icon: 'i-lucide-layout-dashboard',
    to: '/'
  },
  {
    labelKey: 'nav.endpoints',
    icon: 'i-lucide-network',
    to: '/endpoints'
  },
  {
    labelKey: 'nav.providers',
    icon: 'i-lucide-server',
    to: '/providers'
  },
  {
    labelKey: 'nav.virtualModels',
    icon: 'i-lucide-layers',
    to: '/models'
  }
]
