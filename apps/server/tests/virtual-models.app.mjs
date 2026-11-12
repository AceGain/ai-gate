import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { eq } from 'drizzle-orm'

process.env.AI_GATE_DB_PATH = ':memory:'
const source = file => pathToFileURL(path.resolve('src', file)).href
const { default: app } = await import(source('app.ts'))
const { db, sqlite } = await import(source('db/index.ts'))
const { sProvider, sModel, rRoute, rModel } = await import(source('db/schema.ts'))
const provider = db.insert(sProvider).values({ code: 'source', name: 'Provider', base_url: 'https://example.invalid', enabled: true }).returning().get()
for (const code of ['first', 'second']) db.insert(sModel).values({ provider_id: provider.id, code, name: code,
  enabled: true, type: 'TEXT', gen_type: ['Responses'], config: { inputModal: ['text', 'image'], maxContext: 8192 } }).run()

app.post('/__audit/source-state', async c => {
  const { scope, id, enabled, status } = await c.req.json()
  const table = scope === 'provider' ? sProvider : sModel
  db.update(table).set({ enabled, status }).where(eq(table.id, id)).run()
  return c.json({ ok: true })
})

// 通过真实路由表建立引用，验证删除保护；不开放当前尚未实现的虚拟模型发布功能。
app.post('/__audit/reference/:id', c => {
  const route = db.insert(rRoute).values({ code: 'reference', name: 'Reference' }).returning().get()
  db.insert(rModel).values({ route_id: route.id, source_type: 'V_MODEL', model_id: Number(c.req.param('id')), code: 'published' }).run()
  return c.json({ ok: true })
})
app.delete('/__audit/reference', c => { db.delete(rRoute).run(); return c.json({ ok: true }) })
app.get('/__audit/virtual', c => c.json({
  models: sqlite.prepare('SELECT count(*) AS count FROM v_model').get().count,
  relations: sqlite.prepare('SELECT count(*) AS count FROM v_model_relat').get().count,
  foreignKeyErrors: sqlite.pragma('foreign_key_check').length,
}))
export default app
