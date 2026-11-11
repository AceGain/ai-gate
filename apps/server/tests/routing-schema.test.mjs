import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { rRoute, rEndpoint, rKey, rModel, sProvider, sModel, vModel, vModelRelat } from '../src/db/schema.ts'

const serverDir = fileURLToPath(new URL('..', import.meta.url))
const fullSchema = fs.readFileSync(new URL('../sql/schema.sql', import.meta.url), 'utf8')

function fixture(t) {
  const sqlite = new Database(':memory:')
  t.after(() => sqlite.close())
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(fullSchema)
  return { sqlite, db: drizzle(sqlite) }
}

function initialize(dbPath) {
  const result = spawnSync(process.execPath, [
    '--import', 'tsx', '--input-type=module', '-e',
    "const { sqlite } = await import('./src/db/index.ts'); sqlite.close()",
  ], {
    cwd: serverDir,
    env: { ...process.env, AI_GATE_DB_PATH: dbPath },
    encoding: 'utf8',
  })
  assert.ifError(result.error)
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

test('virtual models persist orchestration JSON and protect role-scoped source references', t => {
  const { db, sqlite } = fixture(t)
  const group = db.insert(vModel).values({ code: 'group', kind: 'GROUP', type: 'TEXT' }).returning().get()
  assert.equal(group.category, 'Default')
  assert.equal(group.enabled, false)
  assert.equal(group.status, 'ACTIVE')
  assert.equal(group.gen_type, null)
  assert.equal(group.config, null)
  assert.deepEqual(group.orch_config, {})
  assert.equal(group.timeout, 180000)
  assert.equal(group.max_calls, 16)
  assert.match(group.create_time, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)

  const orchConfig = { PROPOSER: { maxConcurrency: 3, minSuccess: 2 }, EXECUTOR: { strategy: 'WEIGHTED' } }
  const decision = db.insert(vModel).values({ code: 'decision', kind: 'DECISION', type: 'TEXT',
    gen_type: ['Responses'], config: { inputModal: ['text', 'image'] }, orch_config: orchConfig,
  }).returning().get()
  assert.deepEqual(decision.orch_config, orchConfig)
  assert.deepEqual(decision.gen_type, ['Responses'])
  assert.deepEqual(decision.config, { inputModal: ['text', 'image'] })
  const fusion = db.insert(vModel).values({ code: 'fusion', kind: 'FUSION', type: 'TEXT' }).returning().get()
  assert.throws(() => db.insert(vModel).values({ code: 'group', kind: 'FUSION', type: 'TEXT' }).run(), /UNIQUE/)

  const provider = db.insert(sProvider).values({ code: 'source', name: 'Source', base_url: 'https://example.invalid' }).returning().get()
  const source = db.insert(sModel).values({ provider_id: provider.id, code: 'source', type: 'TEXT', gen_type: [], config: {} }).returning().get()
  const relation = { v_model_id: decision.id, s_model_id: source.id, role: 'PROPOSER' }
  const saved = db.insert(vModelRelat).values(relation).returning().get()
  assert.equal(saved.enabled, false)
  assert.equal(saved.sort, 0)
  assert.equal(saved.weight, 1)
  assert.throws(() => db.insert(vModelRelat).values(relation).run(), /UNIQUE/)
  db.insert(vModelRelat).values({ ...relation, role: 'EXECUTOR' }).run()
  db.insert(vModelRelat).values({ ...relation, v_model_id: fusion.id, role: 'WORKER' }).run()
  assert.throws(() => db.insert(vModelRelat).values({ ...relation, v_model_id: 999 }).run(), /FOREIGN KEY/)
  assert.throws(() => db.insert(vModelRelat).values({ ...relation, s_model_id: 999 }).run(), /FOREIGN KEY/)
  assert.throws(() => db.delete(sModel).where(eq(sModel.id, source.id)).run(), /FOREIGN KEY/)
  assert.throws(() => db.delete(sProvider).where(eq(sProvider.id, provider.id)).run(), /FOREIGN KEY/)

  db.delete(vModel).where(eq(vModel.id, decision.id)).run()
  const remaining = db.select().from(vModelRelat).all()
  assert.equal(remaining.length, 1)
  assert.equal(remaining[0].v_model_id, fusion.id)
  db.delete(vModel).where(eq(vModel.id, fusion.id)).run()
  db.delete(sModel).where(eq(sModel.id, source.id)).run()
  assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
})

test('startup initializes a fresh database and can reopen it', t => {
  const dbPath = temporaryDatabase(t, 'fresh')
  initialize(dbPath)
  const before = new Database(dbPath)
  before.exec(`
    INSERT INTO r_route (code, name, create_time, update_time)
    VALUES ('saved', 'Saved route', datetime('now'), datetime('now'))
  `)
  const saved = before.prepare('SELECT * FROM r_route').get()
  before.close()
  initialize(dbPath)
  const sqlite = new Database(dbPath)
  try {
    assert.equal(sqlite.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('r_route', 'r_endpoint', 'r_key', 'r_model')").get().count, 4)
    assert.deepEqual(sqlite.prepare('SELECT * FROM r_route').get(), saved)
  } finally {
    sqlite.close()
  }
})

test('startup leaves an existing database unchanged instead of applying the full schema', t => {
  const dbPath = temporaryDatabase(t, 'existing')
  const before = new Database(dbPath)
  before.exec("CREATE TABLE existing_data (value TEXT); INSERT INTO existing_data VALUES ('keep')")
  const definitions = before.prepare('SELECT type, name, sql FROM sqlite_master ORDER BY name').all()
  before.close()
  initialize(dbPath)
  const after = new Database(dbPath)
  try {
    assert.deepEqual(after.prepare('SELECT type, name, sql FROM sqlite_master ORDER BY name').all(), definitions)
    assert.equal(after.prepare('SELECT value FROM existing_data').get().value, 'keep')
  } finally {
    after.close()
  }
})

test('concurrent startups initialize the same empty database without duplicate DDL', async t => {
  const dbPath = temporaryDatabase(t, 'concurrent')
  // 拉大空库检查到建表之间的间隔，稳定覆盖多个进程同时启动的情况。
  const code = `
    const { default: Database } = await import('better-sqlite3');
    const prepare = Database.prototype.prepare;
    Database.prototype.prepare = function(query, ...args) {
      const statement = prepare.call(this, query, ...args);
      if (query.includes('sqlite_master') && query.includes('LIMIT 1')) {
        const get = statement.get.bind(statement);
        statement.get = (...params) => {
          const value = get(...params);
          if (!value) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 700);
          return value;
        };
      }
      return statement;
    };
    const { sqlite } = await import('./src/db/index.ts'); sqlite.close();
  `
  const start = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], {
      cwd: serverDir,
      env: { ...process.env, AI_GATE_DB_PATH: dbPath },
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: 15000,
    })
    let stderr = ''
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('close', exitCode => resolve({ exitCode, stderr }))
  })
  const results = await Promise.all([start(), start()])
  for (const result of results) assert.equal(result.exitCode, 0, result.stderr)
  const sqlite = new Database(dbPath)
  try {
    assert.equal(sqlite.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT GLOB 'sqlite_*'").get().count, 11)
    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
  } finally {
    sqlite.close()
  }
})
