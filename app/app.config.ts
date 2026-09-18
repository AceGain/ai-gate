export default defineAppConfig({
  ui: {
    colors: {
      primary: 'indigo',
      neutral: 'zinc'
    },
    // 徽章全局默认尺寸 sm（Nuxt UI 默认 md）
    badge: {
      defaultVariants: {
        size: 'sm'
      }
    },
    button: {
      // 按钮全局默认尺寸 sm（Nuxt UI 默认 md），与徽章保持一致
      defaultVariants: {
        size: 'sm'
      },
      variants: {
        square: {
          true: 'justify-center'
        }
      }
    },
    // 开关全局默认尺寸 xs（Nuxt UI 默认 md）：sm 视觉上比 sm 按钮偏大，再降一档
    switch: {
      defaultVariants: {
        size: 'xs'
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
    // 禁用态表单控件：灰底 + 弱化文字 + 不透明度拉满（默认仅 opacity-75，只读灰化不明显）；经主题插槽覆盖以同时作用于 UInput/UTextarea/USelect
    input: {
      slots: {
        base: 'disabled:bg-elevated disabled:text-dimmed disabled:opacity-100'
      }
    },
    textarea: {
      slots: {
        base: 'disabled:bg-elevated disabled:text-dimmed disabled:opacity-100'
      }
    },
    select: {
      slots: {
        base: 'disabled:bg-elevated disabled:text-dimmed disabled:opacity-100'
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
