import { fileURLToPath, URL } from 'node:url'
import { toc } from '@lobehub/icons-vue/es/toc'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import vueI18n from '@intlify/unplugin-vue-i18n/vite'
import { defineConfig, type Plugin } from 'vite'

const host = process.env.TAURI_DEV_HOST
const brandIconImports = toc.map(brand =>
  `@lobehub/icons-vue/es/${brand.id}/components/${brand.param.hasColor ? 'Color' : 'Mono'}`,
)

// 每个品牌生成独立入口；注册表只包含加载函数，不静态引入 SVG。
function lobeBrandIcons(): Plugin {
  const iconPrefix = 'virtual:lobe-brand-icon/'
  const loaderId = 'virtual:lobe-brand-icon-loader'
  let isBuild = false
  let devBase = '/'
  return {
    name: 'lobe-brand-icons',
    configResolved(config) { isBuild = config.command === 'build'; devBase = config.base },
    resolveId(source) {
      const requestId = source.split('?')[0]
      if (requestId === loaderId || requestId.startsWith(iconPrefix)) return `\0${source}`
    },
    load(source, options) {
      const requestId = source.split('?')[0]
      if (requestId === `\0${loaderId}`) {
        const entries = toc.map(brand => {
          const key = brand.id.toLowerCase()
          const id = `${iconPrefix}${key}`
          if (options?.ssr) return `${JSON.stringify(key)}: () => import('${id}')`
          const url = isBuild
            ? `import.meta.ROLLUP_FILE_URL_${this.emitFile({ type: 'chunk', id, name: `brand-${key}`, preserveSignature: 'strict' })}`
            : JSON.stringify(`${devBase}@id/__x00__${id}`)
          // 每个品牌独立重试，避开浏览器对失败动态导入的缓存。
          return `${JSON.stringify(key)}: attempt => import(/* @vite-ignore */ ${url} + (attempt ? '?retry=' + attempt : ''))`
        })
        return `export default {${entries.join(',')}}`
      }
      if (!requestId.startsWith(`\0${iconPrefix}`)) return
      const key = requestId.slice(iconPrefix.length + 1)
      const index = toc.findIndex(brand => brand.id.toLowerCase() === key)
      if (index < 0) return
      return `export { default } from '${brandIconImports[index]}'`
    },
  }
}

export default defineConfig({
  plugins: [
    lobeBrandIcons(),
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
  // 虚拟模块的依赖无法在初始扫描中发现，提前预构建，避免首次显示图标时重新优化并刷新页面。
  optimizeDeps: {
    include: brandIconImports,
  },
  // 上传以外的静态图片独立输出为资源文件
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
