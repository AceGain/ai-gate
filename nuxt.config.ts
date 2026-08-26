// https://nuxt.com/docs/api/configuration/nuxt-config
const host = process.env.TAURI_DEV_HOST

export default defineNuxtConfig({
  compatibilityDate: '2026-06-30',

  modules: [
    '@nuxt/ui',
    '@nuxt/fonts'
  ],

  // 启用 Nuxt 调试工具
  devtools: {
    enabled: true
  },

  // Tauri 从 webview 中提供静态文件，不涉及 SSR 服务器
  ssr: false,

  // Tauri 的 beforeDevCommand 运行时没有 TTY，禁用 telemetry 同意提示
  telemetry: false,

  devServer: {
    port: 1420,
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
