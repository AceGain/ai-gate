import {existsSync} from 'node:fs'
import {serve} from '@hono/node-server'
import {serveStatic} from '@hono/node-server/serve-static'
import {Hono} from 'hono'
import {cors} from 'hono/cors'
import {providers} from './routes/providers'
import {endpoints} from './routes/endpoints'
import {keys} from './routes/keys'
import {models} from './routes/models'
import {v1} from './routes/v1'

const app = new Hono()

app.use('*', cors())

app.route('/api', providers)
app.route('/api', endpoints)
app.route('/api', keys)
app.route('/api', models)
app.route('/v1', v1)

app.onError((err, c) => {
  console.error('[ai-gate] uncaught error:', err)
  return c.json({error: err.message || 'Internal Server Error'}, 500)
})

if (existsSync('dist/index.html')) {
  app.use('*', serveStatic({root: 'dist'}))
  app.get('*', serveStatic({root: 'dist', path: 'index.html'}))
} else {
  app.notFound((c) => c.json({error: 'Not Found'}, 404))
}

const port = Number(process.env.AI_GATE_PORT ?? 9256)
const hostname = process.env.AI_GATE_HOST ?? '0.0.0.0'
serve({fetch: app.fetch, port, hostname}, (info) => {
  console.log(`[ai-gate] server listening on http://localhost:${info.port}`)
  console.log('[ai-gate] providers api: /api/providers (libsql + drizzle)')
  if (existsSync('dist/index.html')) {
    console.log('[ai-gate] serving static site from dist/')
  }
})
