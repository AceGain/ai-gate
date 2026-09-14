export default defineAppConfig({
  ui: {
    colors: {
      primary: 'indigo',
      neutral: 'zinc'
    },
    // 全局基准：按钮/徽标等紧凑元素为 xs，表单控件（输入框、单选/复选、开关、下拉）为 sm 避免变形
    button: {defaultVariants: {size: 'xs'}},
    input: {defaultVariants: {size: 'sm'}},
    textarea: {defaultVariants: {size: 'sm'}},
    inputNumber: {defaultVariants: {size: 'sm'}},
    select: {defaultVariants: {size: 'sm'}},
    selectMenu: {defaultVariants: {size: 'sm'}},
    badge: {defaultVariants: {size: 'xs'}},
    switch: {defaultVariants: {size: 'sm'}},
    checkbox: {defaultVariants: {size: 'sm'}},
    checkboxGroup: {defaultVariants: {size: 'sm'}},
    tabs: {defaultVariants: {size: 'xs'}},
    formField: {defaultVariants: {size: 'sm'}},
    // 页面骨架：body 不滚动（裁切 + min-h-0 允许收缩），滚动统一交给页面内容容器（见 docs/DESIGN.md §3）
    dashboardPanel: {
      slots: {
        root: 'min-h-0',
        body: 'min-h-0 overflow-hidden p-0 sm:p-0 gap-0 sm:gap-0'
      }
    },
    modal: {
      slots: {
        content: 'bg-default divide-y divide-default flex flex-col focus:outline-none rounded-sm border border-default shadow-xl ring-0'
      },
      variants: {
        fullscreen: {
          false: {
            content: 'w-[calc(100vw-2rem)] sm:max-w-md rounded-sm border border-default bg-default shadow-xl ring-0'
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
