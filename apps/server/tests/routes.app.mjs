import path from 'node:path'
import { pathToFileURL } from 'node:url'

process.env.AI_GATE_DB_PATH = ':memory:'
const source = file => pathToFileURL(path.resolve('src', file)).href
const {default: app} = await import(source('app.ts'))
const {db, sqlite} = await import(source('db/index.ts'))
const {sProvider, sModel} = await import(source('db/schema.ts'))

const provider = db.insert(sProvider).values({code: 'test-provider', name: 'Test provider', base_url: 'https://example.invalid', enabled: true}).returning().get()
db.insert(sModel).values({provider_id: provider.id, code: 'source-model', name: 'Source model', enabled: true,
  type: 'TEXT', gen_type: ['Chat Completions'], config: {maxContext: 8192}}).run()

app.get('/__audit/routes', c => c.json({
  routes: sqlite.prepare('SELECT count(*) AS count FROM r_route').get().count,
  endpoints: sqlite.prepare('SELECT count(*) AS count FROM r_endpoint').get().count,
  keys: sqlite.prepare('SELECT count(*) AS count FROM r_key').get().count,
  models: sqlite.prepare('SELECT count(*) AS count FROM r_model').get().count,
  foreignKeyErrors: sqlite.pragma('foreign_key_check').length,
}))
export default app
