import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { Hono } from 'hono'

// Always isolate regression requests from the user's database.
process.env.AI_GATE_DB_PATH = ':memory:'
const source = file => pathToFileURL(path.resolve('src', file)).href
// Dynamic file imports preserve import.meta.url in the SQLite initializer when
// Hono CLI bundles this fixture. The test command loads TypeScript through tsx.
const { models } = await import(source('routes/models.ts'))
const { providers } = await import(source('routes/providers.ts'))
const { listModels } = await import(source('store.ts'))
const { TModelInputSchema } = await import('@ai-gate/shared')
const { safeParse } = await import('valibot')

const upstreamRequests = []
globalThis.fetch = async (input) => {
  const url = new URL(input instanceof Request ? input.url : String(input))
  if (url.origin !== 'https://upstream.audit.invalid') {
    throw new Error(`Unexpected upstream request: ${url.origin}`)
  }
  upstreamRequests.push(url.pathname)
  if (url.pathname === '/v1/models') {
    return Response.json({ data: [
      { id: 'remote-class' },
      { id: 'remote-class', type: 'class', display_name: 'Classifier' },
      { id: 'remote-omni', type: 'OMNI' },
      { id: 'remote-omni', type: 'CLASS' },
      { id: 'remote-unknown', type: 'unrecognized' },
      { id: 'remote-untyped' },
    ] })
  }
  return Response.json({ id: 'mock-generation' })
}

const app = new Hono()
app.route('/api', providers)
app.route('/api', models)
app.get('/__audit/state', c => {
  const items = listModels(1)
  return c.json({
    upstreamRequests: upstreamRequests.length,
    modelCount: items.length,
    types: Object.fromEntries(items.map(model => [model.code, model.type])),
    ids: Object.fromEntries(items.map(model => [model.code, model.id])),
  })
})
app.post('/__audit/template', async c => {
  const result = safeParse(TModelInputSchema, await c.req.json())
  return result.success
    ? c.json({ type: result.output.type })
    : c.json({ error: 'INVALID_REQUEST' }, 400)
})

export default app
