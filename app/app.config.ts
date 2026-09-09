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
            overlay: 'bg-black/40 backdrop-blur-xs'
          }
        }
      }
    }
  }
})
