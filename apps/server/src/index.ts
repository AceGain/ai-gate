import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { endpoints } from './routes/endpoints.js'
import { keys } from './routes/keys.js'
import { models } from './routes/models.js'
import { providers } from './routes/providers.js'

const app = new Hono()

// 开发期 web（Vite 1420）与后端（3000）跨端口访问；生产同源部署时无副作用
app.use('*', cors())

app.route('/api', providers)
app.route('/api', endpoints)
app.route('/api', keys)
app.route('/api', models)

app.get('/', (c) => {
  return c.json({ status: 'ok' })
})

app.onError((err, c) => {
  console.error('[ai-gate] uncaught error:', err)
  return c.json({ error: 'INTERNAL_ERROR' }, 500)
})

serve({
  fetch: app.fetch,
  port: Number(process.env.AI_GATE_PORT ?? 3000),
}, (info) => {
  console.log(`[ai-gate] server is running on http://127.0.0.1:${info.port}`)
})
