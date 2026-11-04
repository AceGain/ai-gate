import type { Plugin } from 'vite'

/** 在 Happy DOM 中运行真实 SFC 的客户端 render，而不是只验证 SSR 输出。 */
export function clientVueRendering(): Plugin {
  return {
    name: 'client-vue-rendering-for-tests',
    enforce: 'post',
    configResolved(config) {
      const vue = config.plugins.find(plugin => plugin.name === 'vite:vue')
      if (!vue || !vue.transform || typeof vue.transform === 'function') throw new Error('Vue transform hook missing')
      const transform = vue.transform.handler
      vue.transform = {
        ...vue.transform,
        handler(code, id, options) {
          return transform.call(this, code, id, { ...options, ssr: false })
        },
      }
      vue.api.options = { ...vue.api.options, isProduction: true, devToolsEnabled: false }
    },
  }
}
