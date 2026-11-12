import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { endpoints } from './routes/endpoints.js'
import { keys } from './routes/keys.js'
import { models } from './routes/models.js'
import { providers } from './routes/providers.js'
import { routes } from './routes/routes.js'
import { virtualModels } from './routes/virtual-models.js'

const app = new Hono()

// 开发期 web（Vite 1420）与后端（3000）跨端口访问；生产同源部署时无副作用
app.use('*', cors())

// 配置模块（s_*、r_*、v_*）统一使用 /api/set；模板模块（t_*）使用 /api/temp。
app.route('/api/set', providers)
app.route('/api/set', endpoints)
app.route('/api/set', keys)
app.route('/api/set', models)
app.route('/api/set', routes)
app.route('/api/set', virtualModels)

app.get('/', (c) => {
  return c.json({ status: 'ok' })
})

app.onError((err, c) => {
  console.error('[ai-gate] uncaught error:', err)
  return c.json({ error: 'INTERNAL_ERROR' }, 500)
})

export default app
