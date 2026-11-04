import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { Window } from 'happy-dom'
import { clientVueRendering } from './helpers/client-vue'

const window = new Window({ url: 'http://localhost/' })
for (const key of ['window', 'document', 'navigator', 'Element', 'HTMLElement', 'SVGElement', 'Node', 'MutationObserver', 'ResizeObserver']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? window : window[key as keyof Window] })
}
Object.defineProperty(globalThis, 'getComputedStyle', { configurable: true, value: window.getComputedStyle.bind(window) })

// 只替换图片的下载结果，头像状态、组件生命周期和 DOM 渲染使用真实实现。
class TestImage extends window.Image {
  get src() { return super.src }
  set src(value: string) {
    super.src = value
    queueMicrotask(() => this.dispatchEvent(new window.Event(value.includes('broken') ? 'error' : 'load')))
  }
  get complete() { return true }
  get naturalWidth() { return this.src.includes('broken') ? 0 : 32 }
}
Object.defineProperty(window, 'Image', { value: TestImage })

const { createApp, h, nextTick, ref } = await import('vue')
const { createServer } = await import('vite')
const { createI18n } = await import('vue-i18n')
const { readFile } = await import('node:fs/promises')
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

test('loaded custom images can switch to SVGs, initials, and failed image fallbacks', async t => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, plugins: [clientVueRendering()] })
  t.after(() => vite.close())
  const { default: ProviderIcon } = await vite.ssrLoadModule('/src/components/provider/ProviderIcon.vue')
  const custom = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>'
  const icon = ref(custom)
  const name = ref('Alpha')
  const root = window.document.createElement('div')
  window.document.body.append(root)
  const warnings: string[] = []
  const app = createApp({ render: () => h(ProviderIcon, { icon: icon.value, name: name.value }) })
  app.config.warnHandler = message => warnings.push(message)
  app.mount(root)
  t.after(() => { app.unmount(); root.remove() })
  await waitFor(() => !!root.querySelector('img') && !root.querySelector('[data-slot="avatar-fallback"]'), 'custom image did not load')
  icon.value = 'openai'
  await waitFor(() => !!root.querySelector('svg'), 'SVG missing after loaded custom image')
  icon.value = custom
  await waitFor(() => !!root.querySelector('img') && !root.querySelector('[data-slot="avatar-fallback"]'), 'custom image did not reload')
  icon.value = ''
  await waitFor(() => root.textContent === 'A', 'initial missing after loaded custom image')
  name.value = 'Beta'
  await waitFor(() => root.textContent === 'B', 'initial did not track the name')
  icon.value = 'https://example.invalid/broken.png'
  await waitFor(() => root.querySelector('img')?.src === icon.value && root.querySelector('[data-slot="avatar-fallback"]')?.textContent === 'B', 'failed custom image did not fall back')
  assert.deepEqual(warnings, [])
})

test('picker handles a shared failure once and retries without losing search or selection', async t => {
  let requests = 0
  let rejectFirst!: (error: Error) => void
  const firstRequest = new Promise<never>((_, reject) => { rejectFirst = reject })
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    plugins: [clientVueRendering(), {
      name: 'controlled-icon-network', enforce: 'pre',
      load(id) {
        if (id === '\0virtual:lobe-brand-icon-loader') return 'export default attempt => globalThis.__loadTestIconChunk(attempt)'
      },
    }],
  })
  t.after(() => vite.close())
  globalThis.__loadTestIconChunk = async () => {
    requests++
    if (requests === 1) return firstRequest
    return vite.ssrLoadModule('virtual:lobe-brand-icons')
  }
  t.after(() => { delete globalThis.__loadTestIconChunk })
  const { default: Picker } = await vite.ssrLoadModule('/src/components/provider/ProviderIconPicker.vue')
  const root = window.document.createElement('div')
  window.document.body.append(root)
  const selected: string[] = []
  const errors: unknown[] = []
  const app = createApp({ render: () => h(Picker, { selectedIcon: 'googlegemini', onSelect: (id: string) => selected.push(id) }) })
  app.use(createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': messages } }))
  app.config.errorHandler = error => errors.push(error)
  app.mount(root)
  t.after(() => { app.unmount(); root.remove() })
  await waitFor(() => !!root.querySelector('[role="status"]'), 'loading status missing')
  const utils = await vite.ssrLoadModule('/src/utils/brandIcons.ts')
  assert.equal(utils.loadBrandIcons(), utils.loadBrandIcons(), 'concurrent users must share the same request')
  const search = root.querySelector('input')!
  search.value = 'gemini'
  search.dispatchEvent(new window.Event('input', { bubbles: true }))
  rejectFirst(new Error('temporary network failure'))
  await waitFor(() => !!root.querySelector('[role="alert"]'), 'load error missing')
  assert.equal(requests, 1)
  assert.equal(root.querySelectorAll('[aria-pressed]').length, 0, 'failed load must not leave blank brand buttons')
  assert.match(root.textContent!, /Unable to load brand icons/)
  const retry = [...root.querySelectorAll('button')].find(button => button.textContent === 'Retry')!
  retry.click()
  await waitFor(() => !!root.querySelector('[aria-pressed="true"] svg'), 'retry did not restore selected brand')
  assert.equal(requests, 2)
  assert.equal(search.value, 'gemini')
  const gemini = root.querySelector<HTMLButtonElement>('[aria-label="Gemini (Google)"]')!
  assert.equal(gemini.getAttribute('aria-pressed'), 'true')
  gemini.click()
  assert.deepEqual(selected, ['gemini'])
  assert.deepEqual(errors, [])
})

test('development retry URLs keep resolving the virtual icon module', async t => {
  const vite = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, ws: false } })
  t.after(() => vite.close())
  await vite.listen()
  const address = vite.httpServer!.address()
  assert.ok(address && typeof address !== 'string')
  const response = await fetch(`http://127.0.0.1:${address.port}/@id/__x00__virtual:lobe-brand-icons?retry=1`)
  assert.equal(response.status, 200)
  assert.ok((await response.text()).includes('OpenAI'), 'retry URL lost the icon registry')
})
