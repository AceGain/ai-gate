import { serve } from '@hono/node-server'
import app from './app.js'

serve({
  fetch: app.fetch,
  port: Number(process.env.AI_GATE_PORT ?? 3000),
}, (info) => {
  console.log(`[ai-gate] server is running on http://127.0.0.1:${info.port}`)
})
