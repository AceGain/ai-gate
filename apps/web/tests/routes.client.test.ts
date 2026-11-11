import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { readFile } from 'node:fs/promises'
import { Window } from 'happy-dom'
import { clientVueRendering } from './helpers/client-vue'

const window = new Window({url: 'http://localhost/'})
for (const key of ['window', 'document', 'navigator', 'history', 'location', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'SVGElement', 'Node', 'NodeFilter', 'Document', 'DocumentFragment', 'ShadowRoot', 'MutationObserver', 'ResizeObserver', 'CustomEvent', 'Event', 'KeyboardEvent', 'PointerEvent', 'MouseEvent']) {
  Object.defineProperty(globalThis, key, {configurable: true, value: key === 'window' ? window : window[key as keyof Window]})
}
for (const key of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) {
  Object.defineProperty(globalThis, key, {configurable: true, value: window[key].bind(window)})
}
const {createApp, h, nextTick, ref} = await import('vue')
const {createPinia, setActivePinia} = await import('pinia')
const {createServer} = await import('vite')
const {createI18n} = await import('vue-i18n')
const {createRouter, createMemoryHistory} = await import('vue-router')
const messages = JSON.parse(await readFile(new URL('../src/locales/en-US.json', import.meta.url), 'utf8'))
after(() => window.happyDOM.close())

async function waitFor(condition: () => boolean, message: string) {
  const deadline = Date.now() + 5000
  while (!condition()) {
    if (Date.now() > deadline) assert.fail(message)
    await delay(10)
    await nextTick()
  }
}
function input(suffix: string) {
  const element = window.document.querySelector<HTMLInputElement>(`input[id$="-${suffix}"]`)
  assert.ok(element, `Missing ${suffix} input`)
  return element
}
async function fill(suffix: string, value: string) {
  const element = input(suffix)
  element.value = value
  element.dispatchEvent(new window.Event('input', {bubbles: true}))
  await nextTick()
}
function submit() {
  const form = window.document.querySelector('form')
  assert.ok(form)
  form.dispatchEvent(new window.Event('submit', {bubbles: true, cancelable: true}))
}

test('route forms validate and preserve configuration; resources and direct detail URLs use real client rendering', async t => {
  const originalFetch = globalThis.fetch
  const writes: {path: string, method: string, body: any}[] = []
  const requests: string[] = []
  let conflict = false
  let sourcesFail = false
  let route = {id: 1, code: 'main', name: 'Main', mode: 'SHARED', host: null, port: null,
    prefixPath: '/gateway', modelsPath: '/catalog', timeout: 45000, maxRetries: 3,
    strategy: 'PRIORITY', enabled: true, status: 'ACTIVE', icon: '', remark: 'Original', sort: 5,
    createTime: 'c', updateTime: 'u'}
  const endpoint = {id: 1, routeId: 1, type: 'Messages', path: '/chat/completions', enabled: false, sort: 4}
  globalThis.fetch = async (url, init) => {
    const path = String(url)
    requests.push(path)
    if (init?.body) {
      const body = JSON.parse(String(init.body))
      writes.push({path, method: init.method!, body})
      if (conflict) return Response.json({error: 'DUPLICATE_ROUTE_PREFIX'}, {status: 409})
      if (path.endsWith('/enabled')) { route = {...route, ...body}; return Response.json(route) }
      if (path.includes('/endpoints/')) return Response.json({...endpoint, ...body})
      if (path.endsWith('/keys')) return Response.json({...body, id: 2, routeId: 1})
      route = {...route, ...body}
      return Response.json(route)
    }
    if (path.endsWith('/model-sources')) return sourcesFail ? Response.json({error: 'INTERNAL_ERROR'}, {status: 500})
      : Response.json([{id: 7, code: 'source', name: 'Source', providerName: 'Provider', enabled: true}])
    if (path.endsWith('/endpoints')) return Response.json([endpoint])
    if (path.endsWith('/keys') || path.endsWith('/models')) return Response.json([])
    if (path.endsWith('/999')) return Response.json({error: 'ROUTE_NOT_FOUND'}, {status: 404})
    return Response.json(path.endsWith('/routes') ? [route] : route)
  }
  t.after(() => { globalThis.fetch = originalFetch })
  const vite = await createServer({server: {middlewareMode: true, hmr: false, ws: false}, plugins: [clientVueRendering()]})
  t.after(() => vite.close())
  const pinia = createPinia()
  setActivePinia(pinia)
  const {useRoutesStore} = await vite.ssrLoadModule('/src/stores/routes.ts')
  const store = useRoutesStore(pinia)
  await store.load()
  const {default: RouteModal} = await vite.ssrLoadModule('/src/components/route/RouteModal.vue')
  const {default: ResourceModal} = await vite.ssrLoadModule('/src/components/route/RouteResourceModal.vue')
  const {default: Detail} = await vite.ssrLoadModule('/src/views/RouteDetailView.vue')
  const open = ref(false)
  const mode = ref('route')
  const kind = ref('endpoints')
  const editing = ref<any>(endpoint)
  const router = createRouter({history: createMemoryHistory(), routes: [{path: '/routes/:id', component: {render: () => h('div')}}]})
  await router.push('/routes/1?tab=keys')
  const root = window.document.createElement('div')
  const header = window.document.createElement('div')
  header.id = 'header-actions'
  window.document.body.append(header, root)
  const app = createApp({render: () => {
    if (mode.value === 'detail') return h(Detail)
    const common = {open: open.value, 'onUpdate:open': (value: boolean) => { open.value = value }}
    if (mode.value === 'resource') return h(ResourceModal, {...common, routeId: 1, kind: kind.value, item: editing.value})
    return h(RouteModal, {...common, routeItem: store.routes[0]})
  }})
  app.use(pinia).use(router).use(createI18n({legacy: false, locale: 'en-US', messages: {'en-US': messages}}))
  app.mount(root)
  t.after(() => { app.unmount(); root.remove(); header.remove() })

  await t.test('invalid input stays open; conflict points to prefix; valid save keeps code and numeric settings', async () => {
    open.value = true
    await waitFor(() => !!window.document.querySelector('input[id$="-timeout"]'), 'route edit did not open')
    assert.equal(input('code').disabled, true)
    assert.equal(input('timeout').value, '45000')
    await fill('timeout', '0')
    submit()
    await waitFor(() => input('timeout').getAttribute('aria-invalid') === 'true', 'invalid timeout not reported')
    assert.equal(writes.length, 0)
    await fill('timeout', '12345')
    conflict = true
    submit()
    await waitFor(() => input('prefixPath').getAttribute('aria-invalid') === 'true', 'prefix conflict not displayed')
    assert.equal(open.value, true)
    conflict = false
    await fill('prefixPath', '/changed')
    submit()
    await waitFor(() => !open.value, 'valid route did not save')
    assert.equal(writes.at(-1)!.body.timeout, 12345)
    assert.equal(writes.at(-1)!.body.maxRetries, 3)
    assert.equal(writes.at(-1)!.body.code, 'main')
    assert.equal(writes.at(-1)!.body.enabled, true)
  })
  await t.test('toggle sends only enabled and preserves full settings', async () => {
    await store.toggle(store.routes[0], false)
    assert.equal(writes.at(-1)!.method, 'PATCH')
    assert.deepEqual(writes.at(-1)!.body, {enabled: false})
    assert.equal(store.routes[0].timeout, 12345)
    assert.equal(store.routes[0].maxRetries, 3)
  })
  await t.test('editing an endpoint keeps its custom path and disabled state', async () => {
    mode.value = 'resource'
    await nextTick()
    open.value = true
    await waitFor(() => !!window.document.querySelector('input[id$="-path"]'), 'endpoint modal did not open')
    await delay(20)
    assert.equal(input('path').value, '/chat/completions')
    await fill('path', '/custom')
    submit()
    await waitFor(() => !open.value, 'endpoint did not save')
    assert.equal(writes.at(-1)!.body.enabled, false)
    assert.equal(writes.at(-1)!.body.sort, 4)
    assert.equal(writes.at(-1)!.body.type, 'Messages')
  })
  await t.test('new key validates its secret and submits nullable expiry', async () => {
    kind.value = 'keys'; editing.value = null
    await nextTick()
    open.value = true
    await waitFor(() => !!window.document.querySelector('input[id$="-secret"]'), 'key modal did not open')
    await fill('name', 'Client')
    const count = writes.length
    submit()
    await waitFor(() => input('secret').getAttribute('aria-invalid') === 'true', 'empty key not rejected')
    assert.equal(writes.length, count)
    await fill('secret', 'test-only-key')
    submit()
    await waitFor(() => !open.value, 'key did not save')
    assert.equal(writes.at(-1)!.body.expireTime, null)
    assert.equal(writes.at(-1)!.body.enabled, true)
  })
  await t.test('failed source reload cannot submit a model using cached sources', async () => {
    kind.value = 'models'; editing.value = {id: 8, routeId: 1, modelId: 7, sourceType: 'S_MODEL', mode: 'DIRECT', code: 'published', name: 'Published', enabled: true, sort: 0}
    await nextTick()
    open.value = true
    await waitFor(() => !!window.document.querySelector('button[id$="-modelId"]:not([disabled])'), 'source list did not load')
    open.value = false
    await nextTick()
    sourcesFail = true
    open.value = true
    await waitFor(() => !!window.document.querySelector('[role="alert"]'), 'source reload error missing')
    const count = writes.length
    submit()
    await delay(60)
    assert.equal(writes.length, count, 'stale model source was submitted after a failed reload')
    assert.equal(open.value, true)
    open.value = false
    sourcesFail = false
    await nextTick()
  })
  await t.test('a late list response cannot hide a route created while loading', async () => {
    const previousFetch = globalThis.fetch
    let resolveList!: (value: Response) => void
    let getCount = 0
    const created = {...route, id: 20, code: 'created', name: 'Created'}
    globalThis.fetch = async (_url, init) => {
      if (init?.method === 'POST') return Response.json(created)
      if (++getCount === 1) return new Promise<Response>(resolve => { resolveList = resolve })
      return Response.json([created])
    }
    try {
      const isolated = useRoutesStore(createPinia())
      const loading = isolated.load()
      await isolated.create(created)
      resolveList(Response.json([]))
      await loading
      assert.ok(isolated.routes.some((item: {id: number}) => item.id === 20), 'late list response hid the new route')
    } finally { globalThis.fetch = previousFetch }
  })
  await t.test('an overlapping list load cannot undo a successfully saved order', async () => {
    const previousFetch = globalThis.fetch
    const first = {...route, id: 21, code: 'first', sort: 0}
    const second = {...route, id: 22, code: 'second', sort: 1}
    let resolveOrder!: (value: Response) => void
    globalThis.fetch = async (_url, init) => init?.method === 'PUT'
      ? new Promise<Response>(resolve => { resolveOrder = resolve }) : Response.json([first, second])
    try {
      const isolated = useRoutesStore(createPinia())
      isolated.routes = [second, first]
      const saving = isolated.saveOrder()
      await isolated.load()
      resolveOrder(Response.json({ok: true}))
      await saving
      assert.deepEqual(isolated.routes.map((item: {id: number}) => item.id), [22, 21])
    } finally { globalThis.fetch = previousFetch }
  })
  await t.test('a late toggle response cannot resurrect a deleted route', async () => {
    const previousFetch = globalThis.fetch
    const item = {...route, id: 23, code: 'removed'}
    let resolveToggle!: (value: Response) => void
    globalThis.fetch = async (_url, init) => init?.method === 'PATCH'
      ? new Promise<Response>(resolve => { resolveToggle = resolve }) : Response.json({ok: true})
    try {
      const isolated = useRoutesStore(createPinia())
      isolated.routes = [item]
      const toggling = isolated.toggle(item, true)
      await isolated.remove(item.id)
      resolveToggle(Response.json({...item, enabled: true}))
      await toggling
      assert.equal(isolated.routes.length, 0)
    } finally { globalThis.fetch = previousFetch }
  })
  await t.test('direct detail URL restores its tab and missing routes show a not-found state', async () => {
    mode.value = 'detail'
    await waitFor(() => !!window.document.querySelector('[role="tab"][data-state="active"]'), 'detail tabs missing')
    assert.equal(window.document.querySelector('[role="tab"][data-state="active"]')!.textContent?.trim(), 'Keys')
    for (const resource of ['endpoints', 'keys', 'models']) assert.ok(requests.includes(`/api/set/routes/1/${resource}`))
    await router.push('/routes/999')
    await waitFor(() => !!root.textContent?.includes('Route not found'), 'missing route state not displayed')
  })
})
