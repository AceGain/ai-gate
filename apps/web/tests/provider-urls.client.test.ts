import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { readFile } from 'node:fs/promises'
import { Window } from 'happy-dom'
import { clientVueRendering } from './helpers/client-vue'

const window = new Window({ url: 'http://localhost/' })
for (const key of ['window', 'document', 'navigator', 'history', 'location', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'SVGElement', 'Node', 'NodeFilter', 'Document', 'DocumentFragment', 'MutationObserver', 'ResizeObserver', 'CustomEvent', 'Event', 'KeyboardEvent', 'PointerEvent', 'MouseEvent']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? window : window[key as keyof Window] })
}
Object.defineProperty(globalThis, 'getComputedStyle', { configurable: true, value: window.getComputedStyle.bind(window) })
Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: window.requestAnimationFrame.bind(window) })
Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: window.cancelAnimationFrame.bind(window) })
const { createApp, h, nextTick, ref } = await import('vue')
const { createPinia, setActivePinia } = await import('pinia')
const { createServer } = await import('vite')
const { createI18n } = await import('vue-i18n')
const { createRouter, createMemoryHistory } = await import('vue-router')
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
  element.dispatchEvent(new window.Event('input', { bubbles: true }))
  await nextTick()
}

function saveButton() {
  const element = [...window.document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Save')
  assert.ok(element, 'Save button missing')
  return element
}

test('provider forms persist connection fields; toggling keeps them; endpoint/model dialogs use provider base URL', async t => {
  const originalFetch = globalThis.fetch
  const writes: {path: string, method: string, body: Record<string, any>}[] = []
  let provider = {
    id: 1, code: 'first', name: 'First', icon: '', baseUrl: 'https://first.example/root', modelsPath: '/catalog/models',
    enabled: true, status: 'ACTIVE', remark: '', sort: 0, createTime: 'c', updateTime: 'u',
  }
  const endpoints = [{id: 1, providerId: 1, type: 'Chat Completions', path: '/v1/chat/completions', isDefault: true, sort: 0, createTime: 'c', updateTime: 'u'}]
  globalThis.fetch = async (url, init) => {
    const path = String(url)
    if (init?.body) {
      const body = JSON.parse(String(init.body))
      writes.push({path, method: init.method!, body})
      if (path.includes('/endpoints/')) {
        Object.assign(endpoints[0]!, body)
        return Response.json(endpoints[0])
      }
      if (init.method === 'POST' && path.endsWith('/providers')) return Response.json({...provider, ...body, id: 2})
      provider = {...provider, ...body}
      return Response.json(provider)
    }
    return Response.json(path.endsWith('/endpoints') ? endpoints : path.endsWith('/keys') || path.endsWith('/models') ? [] : [provider])
  }
  t.after(() => { globalThis.fetch = originalFetch })
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, plugins: [clientVueRendering()] })
  t.after(() => vite.close())
  const pinia = createPinia()
  setActivePinia(pinia)
  const { useProvidersStore } = await vite.ssrLoadModule('/src/stores/providers.ts')
  const store = useProvidersStore(pinia)
  await waitFor(() => store.providers.length === 1, 'provider list did not load')
  const { default: ProviderModal } = await vite.ssrLoadModule('/src/components/provider/ProviderModal.vue')
  const open = ref(false)
  const editing = ref(true)
  const mode = ref('provider')
  const { default: EndpointModal } = await vite.ssrLoadModule('/src/components/provider/EndpointModal.vue')
  const { default: ModelModal } = await vite.ssrLoadModule('/src/components/provider/ModelModal.vue')
  const { default: ProviderDetailView } = await vite.ssrLoadModule('/src/views/ProviderDetailView.vue')
  const router = createRouter({history: createMemoryHistory(), routes: [{path: '/providers/:id', component: {render: () => h('div')}}]})
  await router.push('/providers/1')
  await router.isReady()
  const root = window.document.createElement('div')
  const header = window.document.createElement('div')
  header.id = 'header-actions'
  window.document.body.append(header, root)
  const app = createApp({ render: () => {
    if (mode.value === 'detail') return h(ProviderDetailView)
    const common = {open: open.value, 'onUpdate:open': (value: boolean) => { open.value = value }}
    if (mode.value === 'endpoint') return h(EndpointModal, {...common, providerId: 1, endpoint: store.endpoints[0], existingEndpoints: store.endpoints})
    if (mode.value === 'model') return h(ModelModal, {...common, providerId: 1, modelItem: null, existingEndpoints: store.endpoints})
    return h(ProviderModal, {...common, provider: editing.value ? store.providers[0] : null})
  } })
  app.use(pinia).use(router).use(createI18n({legacy: false, locale: 'en-US', messages: {'en-US': messages}}))
  app.mount(root)
  t.after(() => { app.unmount(); root.remove(); header.remove() })

  open.value = true
  await waitFor(() => !!window.document.querySelector('input[id$="-modelsPath"]'), 'edit form did not open')
  assert.equal(input('baseUrl').value, 'https://first.example/root')
  assert.equal(input('modelsPath').value, '/catalog/models')
  assert.equal(input('code').disabled, true)
  await fill('modelsPath', ' ')
  saveButton().click()
  await waitFor(() => window.document.querySelector('input[id$="-modelsPath"]')?.getAttribute('aria-invalid') === 'true', 'blank models path was not rejected')
  assert.equal(writes.length, 0)
  await fill('baseUrl', 'https://changed.example/prefix/')
  await fill('modelsPath', '/new-models')
  saveButton().click()
  await waitFor(() => !open.value, 'edit form did not save')
  assert.equal(writes[0]?.method, 'PUT')
  assert.equal(writes[0]?.body.baseUrl, 'https://changed.example/prefix/')
  assert.equal(writes[0]?.body.modelsPath, '/new-models')

  await store.toggleProvider(store.providers[0], false)
  assert.equal(writes[1]?.body.baseUrl, 'https://changed.example/prefix/')
  assert.equal(writes[1]?.body.modelsPath, '/new-models')

  // 新增表单填充默认模型列表路径，提交连接配置和新的初始生成端点载荷。
  editing.value = false
  await nextTick()
  open.value = true
  await waitFor(() => !!window.document.querySelector('input[id$="-secret"]'), 'create form did not open')
  assert.equal(input('modelsPath').value, '/v1/models')
  await fill('code', 'second')
  await fill('name', 'Second')
  await fill('baseUrl', 'https://created.example')
  await fill('modelsPath', '/created-models')
  await fill('secret', 'dummy-key')
  saveButton().click()
  await waitFor(() => !open.value, 'create form did not save')
  assert.equal(writes[2]?.method, 'POST')
  assert.equal(writes[2]?.body.modelsPath, '/created-models')
  assert.equal(writes[2]?.body.generateEndpoint.type, 'Chat Completions')
  assert.equal(writes[2]?.body.generateEndpoint.generate, undefined)

  store.endpoints = endpoints
  mode.value = 'endpoint'
  await nextTick()
  open.value = true
  await waitFor(() => !!window.document.querySelector('input[id$="-path"]'), 'endpoint form did not open')
  const expectedUrl = `${store.providers[0].baseUrl.replace(/\/+$/, '')}/v1/chat/completions`
  assert.ok(window.document.body.textContent?.includes(expectedUrl), 'endpoint preview ignored provider base URL')
  assert.equal(input('generate').value, 'Chat Completions')
  await fill('path', '/v2/chat/completions')
  saveButton().click()
  await waitFor(() => !open.value, 'endpoint form did not save')
  assert.equal(writes[3]?.body.type, 'Chat Completions')
  assert.equal(writes[3]?.body.generate, undefined)
  assert.equal(writes[3]?.body.isDefault, true)

  mode.value = 'model'
  await nextTick()
  open.value = true
  await waitFor(() => !!window.document.querySelector('input[id$="-code"]'), 'model form did not open')
  const advanced = [...window.document.querySelectorAll('button')].find(button => button.textContent?.includes('Advanced settings'))
  assert.ok(advanced, 'Advanced settings button missing')
  advanced.click()
  await waitFor(() => !!window.document.body.textContent?.includes('Chat Completions'), 'model dialog omitted generation type')
  assert.ok(window.document.body.innerHTML.includes(`${store.providers[0].baseUrl.replace(/\/+$/, '')}/v2/chat/completions`), 'model dialog used stale base URL')

  open.value = false
  mode.value = 'detail'
  await waitFor(() => !!window.document.body.textContent?.includes('Base URL'), 'provider detail did not render')
  await waitFor(() => !store.configLoading, 'provider detail configuration did not load')
  assert.ok(window.document.body.textContent?.includes('https://changed.example/prefix/'), 'detail omitted provider base URL')
  assert.ok(window.document.body.innerHTML.includes('https://changed.example/prefix/new-models'), 'detail models URL ignored provider fields')
  const baseLabel = [...window.document.querySelectorAll('span')].find(span => span.textContent === 'Base URL')
  const edit = baseLabel?.closest('[data-slot="item"]')?.querySelector('button[aria-label="Edit"]')
  assert.ok(edit, 'connection edit button missing')
  edit.click()
  await waitFor(() => !!window.document.querySelector('input[id$="-modelsPath"]'), 'connection edit did not open provider form')
  assert.equal(input('baseUrl').value, 'https://changed.example/prefix/')
  assert.equal(input('modelsPath').value, '/new-models')
})
