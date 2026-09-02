// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-06-30',

  modules: [
    '@nuxt/ui',
    '@nuxtjs/i18n'
  ],

  // 国际化：支持简体中文（默认）和美式英语
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'zh-CN',
    locales: [
      { code: 'zh-CN', language: 'zh-CN', name: '简体中文', file: 'zh-CN.json' },
      { code: 'en-US', language: 'en-US', name: 'English (US)', file: 'en-US.json' }
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root'
    }
  },

  // 启用 Nuxt 调试工具
  devtools: {
    enabled: true
  },

  // Tauri 从 webview 中提供静态文件，不涉及 SSR 服务器
  ssr: false,

  // Tauri 的 beforeDevCommand 运行时没有 TTY，禁用 telemetry 同意提示
  telemetry: false,

  // 前后端分离：开发期将 /api 代理到独立 Hono 后端（pnpm dev:api，默认端口 9256）
  // 注意：devProxy 匹配 /api 前缀后会把前缀从转发路径中剥掉，因此 target 需带 /api 补回
  nitro: {
    devProxy: {
      '/api': {
        target: 'http://localhost:9256/api',
        changeOrigin: true
      }
    }
  },

  devServer: {
    // 固定端口：Tauri devUrl 依赖；极少数情况下端口处于 TIME_WAIT 时 Nuxt 可能回退到其他端口
    port: 9255,
    // 使开发服务器能够被其他设备发现，以便在 iOS 物理机运行。
    host:
      process.env.TAURI_DEV_HOST || 'localhost'
  },

  vite: {
    // 为 Tauri 命令输出提供更好的支持
    clearScreen: false,
    // 启用环境变量
    // 其他环境变量可以在如下网页中获知：
    // https://v2.tauri.app/reference/environment-variables/
    envPrefix: ['VITE_', 'TAURI_'],
    server: {
      // Tauri需要一个确定的端口
      strictPort: true,
    }
  },

  // 全局样式
  css: ['~/assets/css/main.css']
})
