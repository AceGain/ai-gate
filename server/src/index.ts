import {existsSync} from 'node:fs'
import {serve} from '@hono/node-server'
import {serveStatic} from '@hono/node-server/serve-static'
import {Hono} from 'hono'
import {cors} from 'hono/cors'
import {providers} from './routes/providers'

const app = new Hono()

app.use('*', cors())

app.route('/api', providers)

if (existsSync('dist/index.html')) {
  app.use('*', serveStatic({root: 'dist'}))
  app.get('*', serveStatic({root: 'dist', path: 'index.html'}))
}

const port = Number(process.env.AI_GATE_PORT ?? 9256)
const hostname = process.env.AI_GATE_HOST ?? '0.0.0.0'
serve({fetch: app.fetch, port, hostname}, (info) => {
  console.log(`[ai-gate] server listening on http://localhost:${info.port}`)
  console.log('[ai-gate] providers api: /api/providers (sqlite)')
  if (existsSync('dist/index.html')) {
    console.log('[ai-gate] serving static site from dist/')
  }
})
