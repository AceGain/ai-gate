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

// 从上游目录直接导入每个品牌的展示变体，避免动态查找图标全集带入文字标、头像等代码。
function lobeBrandIcons(): Plugin {
  const id = 'virtual:lobe-brand-icons'
  const loaderId = 'virtual:lobe-brand-icon-loader'
  let isBuild = false
  let devBase = '/'
  return {
    name: 'lobe-brand-icons',
    configResolved(config) { isBuild = config.command === 'build'; devBase = config.base },
    resolveId(source) {
      const requestId = source.split('?')[0]
      if (requestId === id || requestId === loaderId) return `\0${source}`
    },
    load(source, options) {
      const requestId = source.split('?')[0]
      if (requestId === `\0${loaderId}`) {
        if (options?.ssr) return `export default () => import('${id}')`
        const url = isBuild
          ? `import.meta.ROLLUP_FILE_URL_${this.emitFile({ type: 'chunk', id, preserveSignature: 'strict' })}`
          : JSON.stringify(`${devBase}@id/__x00__${id}`)
        // 更换重试请求 URL，避开浏览器对失败动态导入的缓存；不刷新或丢弃表单。
        return `export default (attempt) => import(/* @vite-ignore */ ${url} + (attempt ? '?retry=' + attempt : ''))`
      }
      if (requestId !== `\0${id}`) return
      const imports = brandIconImports.map((specifier, index) =>
        `import icon${index} from '${specifier}'`,
      )
      const entries = toc.map((brand, index) => `${JSON.stringify(brand.id)}: icon${index}`)
      return `${imports.join('\n')}\nexport default {${entries.join(',')}}`
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
