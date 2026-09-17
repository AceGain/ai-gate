export default defineAppConfig({
  ui: {
    colors: {
      primary: 'indigo',
      neutral: 'zinc'
    },
    button: {
      variants: {
        square: {
          true: 'justify-center'
        }
      }
    },
    navigationMenu: {
      variants: {
        active: {
          // 未激活菜单项深色文字（黑），激活项保持主题色（Nuxt UI 默认未激活为 text-muted 过浅）
          false: {
            link: 'text-default',
            linkLeadingIcon: 'text-default'
          }
        }
      }
    },
    popover: {
      slots: {
        content: 'bg-default shadow-xl border border-default ring-0 focus:outline-none pointer-events-auto'
      }
    },
    // 页面骨架：body 不滚动（裁切 + min-h-0 允许收缩），滚动统一交给页面内容容器（见 docs/DESIGN.md §3）
    dashboardPanel: {
      slots: {
        root: 'min-h-0',
        body: 'min-h-0 overflow-hidden p-0 sm:p-0 gap-0 sm:gap-0'
      }
    },
    modal: {
      slots: {
        content: 'bg-default divide-y divide-default flex flex-col focus:outline-none border border-default shadow-xl ring-0'
      },
      variants: {
        fullscreen: {
          false: {
            content: 'w-[calc(100vw-2rem)] sm:max-w-md border border-default bg-default shadow-xl ring-0'
          }
        },
        overlay: {
          true: {
            overlay: 'bg-(--ui-overlay) backdrop-blur-xs'
          }
        }
      }
    }
  }
})
