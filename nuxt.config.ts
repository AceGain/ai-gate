// https://nuxt.com/docs/api/configuration/nuxt-config
const host = process.env.TAURI_DEV_HOST

export default defineNuxtConfig({
  modules: [
    '@nuxt/ui'
  ],

  devtools: {
    enabled: true
  },

  // Tauri's beforeDevCommand runs without a TTY, disable the telemetry consent prompt
  telemetry: false,

  css: ['~/assets/css/main.css'],

  // Tauri expects a fixed port, fail if that port is not available
  devServer: {
    host: host || 'localhost',
    port: 1420
  },

  // Tauri serves static files from the webview, no SSR server involved
  ssr: false,

  compatibilityDate: '2026-06-30'
})
