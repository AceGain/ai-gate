import path from 'node:path'
import { pathToFileURL } from 'node:url'

process.env.AI_GATE_DB_PATH = ':memory:'
const source = file => pathToFileURL(path.resolve('src', file)).href
const { default: app } = await import(source('app.ts'))
const { sqlite } = await import(source('db/index.ts'))

let lastRequest = null
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input))
  if (!['https://first.audit.invalid', 'https://second.audit.invalid', 'https://catalog.audit.invalid'].includes(url.origin)) {
    throw new Error(`Unexpected upstream: ${url.origin}`)
  }
  const headers = new Headers(init?.headers)
  lastRequest = {
    url: url.href,
    method: init?.method ?? 'GET',
    auth: headers.has('x-api-key') ? 'Messages' : headers.has('Authorization') ? 'Bearer' : 'none',
    model: init?.body ? JSON.parse(init.body).model : null,
  }
  return lastRequest.method === 'GET'
    ? Response.json({ data: [{ id: 'remote-model', type: 'TEXT' }] })
    : Response.json({ id: 'mock-generation' })
}

app.get('/__audit/state', c => c.json({
  lastRequest,
  providerColumns: sqlite.pragma('table_info(s_provider)').map(column => column.name),
  endpointColumns: sqlite.pragma('table_info(s_endpoint)').map(column => column.name),
  endpointCount: sqlite.prepare('SELECT COUNT(*) AS count FROM s_endpoint').get().count,
  defaultCount: sqlite.prepare('SELECT COUNT(*) AS count FROM s_endpoint WHERE provider_id = 1 AND is_default = 1').get().count,
  foreignKeyErrors: sqlite.pragma('foreign_key_check').length,
}))

export default app
