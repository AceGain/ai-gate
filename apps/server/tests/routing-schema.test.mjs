import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { rRoute, rEndpoint, rKey, rModel } from '../src/db/schema.ts'
import { migrateRouteModels } from '../src/db/migrations.ts'

const serverDir = fileURLToPath(new URL('..', import.meta.url))
const fullSchema = fs.readFileSync(new URL('../sql/schema.sql', import.meta.url), 'utf8')
const routeMigration = fs.readFileSync(new URL('../sql/migrations/001_add_routes.sql', import.meta.url), 'utf8')
const outboundSchema = fullSchema.split('-- 入站域：')[0]

function fixture(t) {
  const sqlite = new Database(':memory:')
  t.after(() => sqlite.close())
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(fullSchema)
  return { sqlite, db: drizzle(sqlite) }
}

function routingDefinitions(sqlite) {
  return sqlite.prepare(`
    SELECT type, name, tbl_name, sql FROM sqlite_master
    WHERE tbl_name IN ('r_route', 'r_endpoint', 'r_key', 'r_model')
    ORDER BY type, name
  `).all().map(row => ({
    ...row,
    sql: row.sql?.replaceAll('IF NOT EXISTS ', '').replace(/\s+/g, ' ').trim(),
  }))
}

function initialize(dbPath, expectedError) {
  const result = spawnSync(process.execPath, [
    '--import', 'tsx', '--input-type=module', '-e',
    "const { sqlite } = await import('./src/db/index.ts'); sqlite.close()",
  ], {
    cwd: serverDir,
    env: { ...process.env, AI_GATE_DB_PATH: dbPath },
    encoding: 'utf8',
  })
  assert.ifError(result.error)
  if (expectedError) {
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, expectedError)
    return
  }
  assert.equal(result.status, 0, result.stderr || result.stdout)
}

function temporaryDatabase(t, name) {
  const parent = path.resolve(os.tmpdir())
  const dir = fs.mkdtempSync(path.join(parent, `ai-gate-routes-${name}-`))
  t.after(() => {
    const target = path.resolve(dir)
    assert.equal(path.dirname(target), parent)
    assert.ok(path.basename(target).startsWith(`ai-gate-routes-${name}-`))
    fs.rmSync(target, { recursive: true, force: true })
  })
  return path.join(dir, 'server.db')
}

test('shared prefixes and dedicated listeners have separate uniqueness scopes', t => {
  const { db } = fixture(t)
  const shared = db.insert(rRoute).values({ code: 'main', name: 'Main' }).returning().get()
  assert.equal(shared.mode, 'SHARED')
  assert.equal(shared.prefix_path, '/v1')
  assert.equal(shared.models_path, '/models')
  assert.equal(shared.host, null)
  assert.equal(shared.port, null)
  assert.equal(shared.enabled, false)

  assert.throws(() => db.insert(rRoute).values({ code: 'duplicate', name: 'Duplicate' }).run(), /UNIQUE/)
  db.insert(rRoute).values({ code: 'zen', name: 'Zen', prefix_path: '/zen' }).run()
  db.insert(rRoute).values({
    code: 'dedicated', name: 'Dedicated', mode: 'DEDICATED', host: '127.0.0.1', port: 5074,
  }).run()
  db.insert(rRoute).values({
    code: 'other-port', name: 'Other port', mode: 'DEDICATED', host: '127.0.0.1', port: 5075,
  }).run()
  assert.throws(() => db.insert(rRoute).values({
    code: 'duplicate-port', name: 'Duplicate port', mode: 'DEDICATED', host: '127.0.0.1', port: 5074,
  }).run(), /UNIQUE/)
})

test('each route has one endpoint per protocol and no duplicate generation paths', t => {
  const { db } = fixture(t)
  const first = db.insert(rRoute).values({ code: 'first', name: 'First' }).returning().get()
  const second = db.insert(rRoute).values({ code: 'second', name: 'Second', prefix_path: '/zen' }).returning().get()
  const endpoint = { route_id: first.id, type: 'Messages', path: '/messages' }
  db.insert(rEndpoint).values(endpoint).run()
  assert.throws(() => db.insert(rEndpoint).values({ ...endpoint, path: '/alias' }).run(), /UNIQUE/)
  assert.throws(() => db.insert(rEndpoint).values({ ...endpoint, type: 'Responses' }).run(), /UNIQUE/)
  db.insert(rEndpoint).values({ ...endpoint, route_id: second.id }).run()
  assert.throws(() => db.insert(rEndpoint).values({ ...endpoint, route_id: 999 }).run(), /FOREIGN KEY/)
})

test('route deletion cascades to its endpoints, keys and models without affecting another route', t => {
  const { sqlite, db } = fixture(t)
  const first = db.insert(rRoute).values({ code: 'first', name: 'First' }).returning().get()
  const second = db.insert(rRoute).values({ code: 'second', name: 'Second', prefix_path: '/zen' }).returning().get()
  db.insert(rEndpoint).values({ route_id: first.id, type: 'Chat', path: '/chat/completions' }).run()
  db.insert(rKey).values({ route_id: first.id, name: 'Test', secret: 'test-only-token' }).run()
  const model = { route_id: first.id, model_id: 1, code: 'assistant', mode: 'CUSTOM', type: 'TEXT', gen_type: ['Messages'], config: {} }
  db.insert(rModel).values(model).run()
  assert.throws(() => db.insert(rModel).values(model).run(), /UNIQUE/)
  db.insert(rModel).values({ ...model, route_id: second.id }).run()
  assert.throws(() => sqlite.prepare(`
    INSERT INTO r_model (route_id, model_id, code, type, gen_type, config, create_time, update_time)
    VALUES (?, 1, 'invalid', 'TEXT', 'invalid-json', '{}', datetime('now'), datetime('now'))
  `).run(second.id), /CHECK/)

  db.delete(rRoute).where(eq(rRoute.id, first.id)).run()
  assert.equal(db.select().from(rEndpoint).all().length, 0)
  assert.equal(db.select().from(rKey).all().length, 0)
  const remaining = db.select().from(rModel).all()
  assert.equal(remaining.length, 1)
  assert.equal(remaining[0].route_id, second.id)
  assert.deepEqual(remaining[0].gen_type, ['Messages'])
  assert.deepEqual(remaining[0].config, {})
  assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
})

test('additive migration matches fresh routing DDL and is safe to run repeatedly', t => {
  const { sqlite: fresh } = fixture(t)
  const upgraded = new Database(':memory:')
  t.after(() => upgraded.close())
  upgraded.exec(outboundSchema)
  upgraded.exec(routeMigration)
  migrateRouteModels(upgraded)
  migrateRouteModels(upgraded)
  assert.deepEqual(routingDefinitions(upgraded), routingDefinitions(fresh))
})

test('source type distinguishes actual and virtual IDs; DIRECT supports null overrides and CUSTOM supports partial overrides', t => {
  const { db, sqlite } = fixture(t)
  const route = db.insert(rRoute).values({ code: 'main', name: 'Main' }).returning().get()
  const direct = db.insert(rModel).values({
    route_id: route.id, model_id: 7, code: 'actual',
  }).returning().get()
  assert.equal(direct.source_type, 'S_MODEL')
  assert.equal(direct.mode, 'DIRECT')
  assert.equal(direct.type, null)
  assert.equal(direct.gen_type, null)
  assert.equal(direct.config, null)
  assert.equal(direct.category, 'Default')
  const virtual = db.insert(rModel).values({
    route_id: route.id, source_type: 'V_MODEL', model_id: 7, code: 'fusion',
    mode: 'CUSTOM', category: 'Coding', gen_type: ['Messages'], config: { maxOutput: 4096 },
  }).returning().get()
  assert.equal(virtual.source_type, 'V_MODEL')
  assert.equal(virtual.model_id, direct.model_id)
  assert.equal(virtual.type, null)
  assert.deepEqual(virtual.gen_type, ['Messages'])
  assert.deepEqual(virtual.config, { maxOutput: 4096 })
  db.insert(rModel).values({ route_id: route.id, model_id: 7, code: 'another-alias' }).run()
  assert.throws(() => db.insert(rModel).values({ route_id: route.id, code: 'missing-source' }).run(), /NOT NULL/)
  assert.throws(() => sqlite.prepare(`
    INSERT INTO r_model (route_id, model_id, code, config, create_time, update_time)
    VALUES (?, 7, 'invalid-config', 'bad-json', datetime('now'), datetime('now'))
  `).run(route.id), /CHECK/)
})

test('legacy populated model migration fails without changing data or indexes', t => {
  const sqlite = new Database(':memory:')
  t.after(() => sqlite.close())
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(outboundSchema)
  sqlite.exec(routeMigration)
  sqlite.exec(`
    INSERT INTO r_route (code, name, create_time, update_time)
    VALUES ('legacy', 'Legacy', datetime('now'), datetime('now'));
    INSERT INTO r_model (route_id, code, type, gen_type, config, create_time, update_time)
    VALUES (1, 'legacy-model', 'TEXT', '["Messages"]', '{}', datetime('now'), datetime('now'));
  `)
  const definitions = routingDefinitions(sqlite)
  const rows = sqlite.prepare('SELECT * FROM r_model').all()
  assert.throws(() => migrateRouteModels(sqlite), /explicit source_type and model_id mappings are required/)
  assert.deepEqual(sqlite.prepare('SELECT * FROM r_model').all(), rows)
  assert.deepEqual(routingDefinitions(sqlite), definitions)
  assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
})

test('startup initializes a fresh database and can reopen it', t => {
  const dbPath = temporaryDatabase(t, 'fresh')
  initialize(dbPath)
  initialize(dbPath)
  const sqlite = new Database(dbPath)
  try {
    assert.equal(sqlite.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('r_route', 'r_endpoint', 'r_key', 'r_model')").get().count, 4)
  } finally {
    sqlite.close()
  }
})

test('startup upgrades an existing outbound database and preserves data on subsequent starts', t => {
  const dbPath = temporaryDatabase(t, 'upgrade')
  const before = new Database(dbPath)
  before.exec(outboundSchema)
  before.exec(`
    INSERT INTO s_provider (code, name, base_url, create_time, update_time)
    VALUES ('existing', 'Existing provider', 'https://upstream.audit.invalid', datetime('now'), datetime('now'))
  `)
  const originalProvider = before.prepare('SELECT * FROM s_provider').get()
  before.close()

  initialize(dbPath)
  const upgraded = new Database(dbPath)
  upgraded.exec(`
    INSERT INTO r_route (code, name, create_time, update_time)
    VALUES ('saved', 'Saved route', datetime('now'), datetime('now'))
  `)
  upgraded.close()
  initialize(dbPath)

  const after = new Database(dbPath)
  try {
    assert.deepEqual(after.prepare('SELECT * FROM s_provider').get(), originalProvider)
    assert.equal(after.prepare('SELECT code FROM r_route').get().code, 'saved')
    assert.deepEqual(after.pragma('foreign_key_check'), [])
  } finally {
    after.close()
  }
})

test('startup upgrades the empty legacy model table while preserving route, key and endpoint data', t => {
  const dbPath = temporaryDatabase(t, 'legacy')
  const before = new Database(dbPath)
  before.exec(outboundSchema)
  before.exec(routeMigration)
  before.exec(`
    INSERT INTO r_route (code, name, create_time, update_time)
    VALUES ('legacy', 'Legacy', datetime('now'), datetime('now'));
    INSERT INTO r_key (route_id, name, secret, create_time, update_time)
    VALUES (1, 'Test', 'test-only-token', datetime('now'), datetime('now'));
    INSERT INTO r_endpoint (route_id, type, path, create_time, update_time)
    VALUES (1, 'Messages', '/messages', datetime('now'), datetime('now'));
  `)
  const snapshot = ['r_route', 'r_key', 'r_endpoint'].map(table => before.prepare(`SELECT * FROM ${table}`).all())
  before.close()
  initialize(dbPath)
  const upgraded = new Database(dbPath)
  upgraded.prepare(`
    INSERT INTO r_model (route_id, source_type, model_id, code, create_time, update_time)
    VALUES (1, 'V_MODEL', 7, 'fusion', datetime('now'), datetime('now'))
  `).run()
  upgraded.close()
  initialize(dbPath)
  const after = new Database(dbPath)
  try {
    assert.deepEqual(['r_route', 'r_key', 'r_endpoint'].map(table => after.prepare(`SELECT * FROM ${table}`).all()), snapshot)
    const model = after.prepare('SELECT * FROM r_model').get()
    assert.equal(model.source_type, 'V_MODEL')
    assert.equal(model.model_id, 7)
    assert.equal(model.mode, 'DIRECT')
    const { sqlite: fresh } = fixture(t)
    assert.deepEqual(routingDefinitions(after), routingDefinitions(fresh))
  } finally {
    after.close()
  }
})

test('startup refuses to guess legacy source mappings and preserves the populated model', t => {
  const dbPath = temporaryDatabase(t, 'unmapped')
  const before = new Database(dbPath)
  before.exec(outboundSchema)
  before.exec(routeMigration)
  before.exec(`
    INSERT INTO r_route (code, name, create_time, update_time)
    VALUES ('legacy', 'Legacy', datetime('now'), datetime('now'));
    INSERT INTO r_model (route_id, code, type, gen_type, config, create_time, update_time)
    VALUES (1, 'unmapped', 'TEXT', '[]', '{}', datetime('now'), datetime('now'));
  `)
  const snapshot = before.prepare('SELECT * FROM r_model').all()
  before.close()
  initialize(dbPath, /explicit source_type and model_id mappings are required/)
  const after = new Database(dbPath)
  try {
    assert.deepEqual(after.prepare('SELECT * FROM r_model').all(), snapshot)
    assert.ok(!after.pragma('table_info(r_model)').some(column => column.name === 'model_id'))
  } finally {
    after.close()
  }
})
