import type {CommandPaletteGroup, CommandPaletteItem, NavigationMenuItem} from '@nuxt/ui'
import {navRoutes} from '~/utils/navigation'

/**
 * 导航配置 composable：将路由表（navRoutes）映射为带 i18n 文案的导航菜单项与搜索分组
 */
export function useNavigation() {
  const {t} = useI18n()

  /** 主导航菜单项（侧栏主体） */
  const mainNav = computed<NavigationMenuItem[]>(() =>
    navRoutes.map(route => ({
      label: t(route.labelKey),
      icon: route.icon,
      to: route.to
    }))
  )

  /** 全局搜索面板分组（数据派生自主导航） */
  const searchGroups = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => [
    {
      id: 'links',
      label: t('nav.goTo'),
      items: mainNav.value.map(item => ({
        label: item.label,
        icon: item.icon,
        to: item.to
      }))
    }
  ])

  return {mainNav, searchGroups}
}
