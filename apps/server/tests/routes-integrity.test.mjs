import assert from 'node:assert/strict'
import { test } from 'node:test'

process.env.AI_GATE_DB_PATH = ':memory:'
const {default: app} = await import('../src/app.ts')
const {db} = await import('../src/db/index.ts')
const {rRoute, rModel, sModel, sProvider} = await import('../src/db/schema.ts')
const {eq} = await import('drizzle-orm')

async function request(path, method = 'GET', body) {
  const res = await app.request(`/api/set${path}`, {method,
    ...(body === undefined ? {} : {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}),
  })
  return {status: res.status, body: await res.json()}
}
let next = 0
async function route() {
  const code = `audit-${++next}`
  const res = await request('/routes', 'POST', {code, name: code, prefixPath: `/${code}`})
  assert.equal(res.status, 201)
  return res.body
}
function source() {
  const provider = db.insert(sProvider).values({code: `source-${++next}`, name: 'Provider', base_url: 'https://example.invalid'}).returning().get()
  const model = db.insert(sModel).values({provider_id: provider.id, code: 'source', type: 'TEXT', gen_type: [], config: {}}).returning().get()
  return {provider, model}
}

test('listen addresses reject invalid hosts and canonicalize equivalent IPv6 spellings', async () => {
  for (const host of [':', '...', '127.0.0.1:9000', '[::1', '[::1]:80', '999.999.999.999', 'bad..host']) {
    const res = await request('/routes', 'POST', {code: `host-${++next}`, name: 'Bad host', mode: 'DEDICATED', host, port: 62000})
    assert.equal(res.status, 400, host)
  }
  const first = await request('/routes', 'POST', {code: `ipv6-${++next}`, name: 'IPv6', mode: 'DEDICATED', host: '0:0:0:0:0:0:0:1', port: 62001})
  assert.equal(first.status, 201)
  assert.equal(first.body.host, '::1')
  const duplicate = await request('/routes', 'POST', {code: `ipv6-${++next}`, name: 'IPv6', mode: 'DEDICATED', host: '[::1]', port: 62001})
  assert.equal(duplicate.status, 409)
})

test('a direct-model editor cannot silently downgrade CUSTOM or virtual models', async () => {
  const parent = await route()
  const {model} = source()
  for (const options of [{source_type: 'S_MODEL', mode: 'CUSTOM'}, {source_type: 'V_MODEL', mode: 'DIRECT'}]) {
    const saved = db.insert(rModel).values({route_id: parent.id, model_id: model.id, code: `model-${++next}`,
      ...options, type: 'OMNI', gen_type: ['Responses'], config: {maxContext: 8192}}).returning().get()
    const res = await request(`/routes/${parent.id}/models/${saved.id}`, 'PUT', {modelId: model.id, code: saved.code, name: 'Changed'})
    assert.equal(res.status, 409)
    const current = db.select().from(rModel).where(eq(rModel.id, saved.id)).get()
    assert.deepEqual(current, saved)
  }
})

test('source deletion cannot leave route models dangling, and missing sources cannot be enabled', async () => {
  const parent = await route()
  const {provider, model} = source()
  const published = await request(`/routes/${parent.id}/models`, 'POST', {modelId: model.id, code: 'published'})
  assert.equal(published.status, 201)
  assert.equal((await request(`/providers/${provider.id}/models/${model.id}`, 'DELETE')).status, 409)
  assert.equal((await request(`/providers/${provider.id}`, 'DELETE')).status, 409)
  db.delete(sModel).where(eq(sModel.id, model.id)).run() // Simulate data from outside the configuration API.
  assert.equal((await request(`/routes/${parent.id}/models/${published.body.id}/enabled`, 'PATCH', {enabled: true})).status, 400)
  assert.equal((await request(`/routes/${parent.id}/models/${published.body.id}/enabled`, 'PATCH', {enabled: false})).status, 200)
})

test('key expiration must be a real calendar date', async () => {
  const parent = await route()
  for (const expireTime of ['2027-02-29', '2028-02-30', '2030-04-31']) {
    assert.equal((await request(`/routes/${parent.id}/keys`, 'POST', {name: 'Bad date', secret: 'test-only', expireTime})).status, 400, expireTime)
  }
  assert.equal((await request(`/routes/${parent.id}/keys`, 'POST', {name: 'Leap day', secret: 'test-only', expireTime: '2028-02-29'})).status, 201)
})

test('removing a route model releases its source for deletion', async () => {
  const parent = await route()
  const {provider, model} = source()
  const published = await request(`/routes/${parent.id}/models`, 'POST', {modelId: model.id, code: 'removable'})
  assert.equal(published.status, 201)
  assert.equal((await request(`/routes/${parent.id}/models/${published.body.id}`, 'DELETE')).status, 200)
  assert.equal((await request(`/providers/${provider.id}/models/${model.id}`, 'DELETE')).status, 200)
  assert.equal((await request(`/providers/${provider.id}`, 'DELETE')).status, 200)
})

test('deleting a parent while a request body is arriving returns 404 rather than 500', async () => {
  for (const operation of ['route-update', 'endpoint-create', 'key-create', 'model-create']) {
    const parent = await route()
    const {model} = source()
    let release
    let started
    const waiting = new Promise(resolve => { release = resolve })
    const reading = new Promise(resolve => { started = resolve })
    const payload = operation === 'route-update' ? {name: 'Late update'}
      : operation === 'endpoint-create' ? {type: 'Messages', path: '/messages'}
        : operation === 'key-create' ? {name: 'Client', secret: 'test-only'}
          : {modelId: model.id, code: 'late-model'}
    const body = new ReadableStream({async pull(controller) {
      started()
      await waiting
      controller.enqueue(new TextEncoder().encode(JSON.stringify(payload)))
      controller.close()
    }})
    const suffix = operation === 'route-update' ? '' : operation === 'endpoint-create' ? '/endpoints' : operation === 'key-create' ? '/keys' : '/models'
    const pending = app.request(`/api/set/routes/${parent.id}${suffix}`, {method: operation === 'route-update' ? 'PUT' : 'POST',
      headers: {'Content-Type': 'application/json'}, body, duplex: 'half'})
    await reading
    await request(`/routes/${parent.id}`, 'DELETE')
    release()
    assert.equal((await pending).status, 404, operation)
  }
})
