/**
 * AI Gate 后端入口（Hono）
 * 承载：管理 API（/api/*）+ 网关数据面（/v1/*）+ 生产形态下服务 Nuxt 静态资源（dist/）
 * 开发：pnpm dev:api（默认端口 9256，前端经 Nuxt devProxy 以 /api 相对路径访问）
 * 生产：pnpm generate 后启动本服务，即可同源提供页面与全部接口
 */
import {existsSync} from 'node:fs'
import {serve} from '@hono/node-server'
import {serveStatic} from '@hono/node-server/serve-static'
import {Hono} from 'hono'
import {cors} from 'hono/cors'
import {admin} from './routes/admin'
import {gateway} from './routes/gateway'

const app = new Hono()

// 浏览器开发态（跨端口）与 Tauri 桌面端 webview（跨源）调用放行
app.use('*', cors())

// 管理 API（前端配置面板）
app.route('/api', admin)
// 网关数据面（OpenAI 兼容入口）
app.route('/', gateway)

// 生产形态：服务 Nuxt 静态资源（pnpm generate 产出到 dist/），未命中路径回退 index.html（SPA）
if (existsSync('dist/index.html')) {
  app.use('*', serveStatic({root: 'dist'}))
  app.get('*', serveStatic({root: 'dist', path: 'index.html'}))
}

const port = Number(process.env.AI_GATE_PORT ?? 9256)
const hostname = process.env.AI_GATE_HOST ?? '0.0.0.0'
serve({fetch: app.fetch, port, hostname}, (info) => {
  console.log(`[ai-gate] server listening on http://localhost:${info.port}`)
  console.log(`[ai-gate] gateway:      POST /v1/chat/completions | GET /v1/models`)
  console.log(`[ai-gate] admin api:    /api/providers | /api/fetch-models`)
  if (existsSync('dist/index.html')) {
    console.log('[ai-gate] serving static site from dist/')
  }
})
