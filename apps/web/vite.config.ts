import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import vueI18n from '@intlify/unplugin-vue-i18n/vite'
import { defineConfig } from 'vite'

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    vueI18n({ include: fileURLToPath(new URL('./src/locales/**', import.meta.url)), strictMessage: true }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  clearScreen: false,
  // 品牌图标等 PNG 一律外置为资源文件，按需加载，避免内联撑大 JS 产物
  build: {
    assetsInlineLimit: 0,
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || '127.0.0.1',
    // 开发期将 /api 代理到本地 Hono 后端（生产同源部署或经 VITE_API_BASE 指向）
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
  },
})
