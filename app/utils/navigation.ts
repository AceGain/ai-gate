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

// 顺序约定：按数据流排列 —— 总览 → 供给侧（供应商/路由）→ 网关（虚拟模型）→ 分发面（Agent/Skills/MCP）
export const navRoutes: NavRoute[] = [
  {
    labelKey: 'nav.dashboard',
    icon: 'i-lucide-layout-dashboard',
    to: '/'
  },
  {
    labelKey: 'nav.providers',
    icon: 'i-lucide-server',
    to: '/providers'
  },
  {
    labelKey: 'nav.endpoints',
    icon: 'i-lucide-route',
    to: '/endpoints'
  },
  {
    labelKey: 'nav.virtualModels',
    icon: 'i-lucide-layers',
    to: '/models'
  },
  {
    labelKey: 'nav.agent',
    icon: 'i-lucide-bot',
    to: '/agent'
  },
  {
    labelKey: 'nav.skills',
    icon: 'i-lucide-sparkles',
    to: '/skills'
  },
  {
    labelKey: 'nav.mcp',
    icon: 'i-lucide-plug',
    to: '/mcp'
  }
]
