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

// Happy DOM 不计算布局，只替换可见性通知；保留真实组件和观察器生命周期。
class TestIntersectionObserver {
  static instances = new Set<TestIntersectionObserver>()
  targets = new Set<Element>()
  constructor(private callback: IntersectionObserverCallback) { TestIntersectionObserver.instances.add(this) }
  observe(target: Element) { this.targets.add(target) }
  unobserve(target: Element) { this.targets.delete(target) }
  disconnect() { this.targets.clear(); TestIntersectionObserver.instances.delete(this) }
  static show(target: Element, isIntersecting = true) {
    for (const observer of this.instances) {
      if (observer.targets.has(target)) observer.callback([{ target, isIntersecting } as IntersectionObserverEntry], observer as unknown as IntersectionObserver)
    }
  }
  static observes(target: Element) {
    return [...this.instances].some(observer => observer.targets.has(target))
  }
}
Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: TestIntersectionObserver })
Object.defineProperty(globalThis, 'IntersectionObserver', { configurable: true, value: TestIntersectionObserver })

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

test('picker retry restores existing failed avatars without losing search or selection', async t => {
  const requests: string[] = []
  let rejectFirst!: (error: Error) => void
  const firstRequest = new Promise<never>((_, reject) => { rejectFirst = reject })
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    plugins: [clientVueRendering(), {
      name: 'controlled-icon-network', enforce: 'pre',
      load(id) {
        if (id === '\0virtual:lobe-brand-icon-loader') return 'export default new Proxy({}, { get: (_, id) => attempt => globalThis.__loadTestIconChunk(id, attempt) })'
      },
    }],
  })
  t.after(() => vite.close())
  globalThis.__loadTestIconChunk = async (id: string, attempt: number) => {
    requests.push(`${id}:${attempt}`)
    if (id === 'gemini' && attempt === 0) return firstRequest
    return vite.ssrLoadModule(`virtual:lobe-brand-icon/${id}`)
  }
  t.after(() => { delete globalThis.__loadTestIconChunk })
  const { default: ProviderIcon } = await vite.ssrLoadModule('/src/components/provider/ProviderIcon.vue')
  const { default: Picker } = await vite.ssrLoadModule('/src/components/provider/ProviderIconPicker.vue')
  const root = window.document.createElement('div')
  window.document.body.append(root)
  const selected: string[] = []
  const errors: unknown[] = []
  const app = createApp({ render: () => h('main', [
    h('section', { id: 'existing-avatars' }, [
      h(ProviderIcon, { icon: 'gemini', name: 'Alpha' }),
      h(ProviderIcon, { icon: 'googlegemini', name: 'Beta' }),
      h(ProviderIcon, { icon: 'openai', name: 'Healthy' }),
    ]),
    h(Picker, { selectedIcon: 'googlegemini', onSelect: (id: string) => selected.push(id) }),
  ]) })
  app.use(createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': messages } }))
  app.config.errorHandler = error => errors.push(error)
  app.mount(root)
  t.after(() => { app.unmount(); root.remove() })
  const utils = await vite.ssrLoadModule('/src/utils/brandIcons.ts')
  assert.equal(utils.loadBrandIcon('gemini'), utils.loadBrandIcon('googlegemini'), 'aliases and concurrent users must share the same brand request')
  const search = root.querySelector('input')!
  search.value = 'gemini'
  search.dispatchEvent(new window.Event('input', { bubbles: true }))
  const gemini = root.querySelector<HTMLButtonElement>('[data-brand-id="gemini"]')!
  await waitFor(() => TestIntersectionObserver.observes(gemini), 'filtered brand was not observed')
  TestIntersectionObserver.show(gemini)
  await waitFor(() => !!gemini.querySelector('[role="status"]'), 'per-brand loading status missing')
  rejectFirst(new Error('temporary network failure'))
  await waitFor(() => !!root.querySelector('[role="alert"]'), 'load error missing')
  await waitFor(() => root.querySelector('#existing-avatars')?.textContent?.startsWith('AB') === true, 'failed avatars did not show their own initials')
  await waitFor(() => root.querySelectorAll('#existing-avatars svg').length === 1, 'one failed brand must not block a healthy brand')
  const existingAvatars = [...root.querySelectorAll('#existing-avatars [data-slot="avatar"]')]
  assert.deepEqual(requests, ['gemini:0', 'openai:0'])
  assert.equal(gemini.textContent, 'G', 'failed brand must keep a visible placeholder')
  assert.match(root.textContent!, /Unable to load brand icons/)
  // 错误提示插入后可能把失败按钮挤出可视区域，提示及重试必须保持稳定。
  TestIntersectionObserver.show(gemini, false)
  await nextTick()
  assert.ok(root.querySelector('[role="alert"]'), 'scrolling a failed brand out of view must not remove the error or its retry action')
  const retry = [...root.querySelectorAll('button')].find(button => button.textContent === 'Retry')!
  retry.click()
  await waitFor(() => !!root.querySelector('[aria-pressed="true"] svg'), 'retry did not restore selected brand')
  await waitFor(() => root.querySelectorAll('#existing-avatars svg').length === 3, 'retry did not restore existing failed avatars')
  const recoveredAvatars = [...root.querySelectorAll('#existing-avatars [data-slot="avatar"]')]
  for (const [index, avatar] of existingAvatars.entries()) {
    assert.equal(recoveredAvatars[index], avatar, 'recovery must update the existing avatar without remounting it')
  }
  assert.deepEqual(requests, ['gemini:0', 'openai:0', 'gemini:1'], 'retry must request only previously attempted failed brands in the current search')
  assert.equal(search.value, 'gemini')
  assert.equal(gemini.getAttribute('aria-pressed'), 'true')
  gemini.click()
  assert.deepEqual(selected, ['gemini'])
  assert.equal(errors.length, 2, 'only the two original avatar failures should be reported')
  for (const error of errors) assert.match(String(error), /temporary network failure/)
})

test('picker loads only visible or focused brands and reuses loaded brands after search', async t => {
  const requests: string[] = []
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    plugins: [clientVueRendering(), {
      name: 'record-brand-requests', enforce: 'pre',
      load(id) {
        if (id === '\0virtual:lobe-brand-icon-loader') return 'export default new Proxy({}, { get: (_, id) => () => globalThis.__loadTestIconChunk(id) })'
      },
    }],
  })
  t.after(() => vite.close())
  globalThis.__loadTestIconChunk = (id: string) => {
    requests.push(id)
    return vite.ssrLoadModule(`virtual:lobe-brand-icon/${id}`)
  }
  t.after(() => { delete globalThis.__loadTestIconChunk })
  const { default: Picker } = await vite.ssrLoadModule('/src/components/provider/ProviderIconPicker.vue')
  const root = window.document.createElement('div')
  window.document.body.append(root)
  const app = createApp({ render: () => h(Picker, { selectedIcon: 'openai' }) })
  app.use(createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': messages } }))
  app.mount(root)
  t.after(() => { app.unmount(); root.remove() })
  const openai = root.querySelector<HTMLButtonElement>('[data-brand-id="openai"]')!
  await waitFor(() => TestIntersectionObserver.observes(openai), 'brand buttons were not observed')
  assert.ok(root.querySelectorAll('[data-brand-id]').length > 300)
  assert.deepEqual(requests, [], 'mounting the catalogue must not request offscreen icons')
  TestIntersectionObserver.show(openai)
  await waitFor(() => !!openai.querySelector('svg'), 'visible brand did not load')
  assert.deepEqual(requests, ['openai'])
  const deepseek = root.querySelector<HTMLButtonElement>('[data-brand-id="deepseek"]')!
  deepseek.dispatchEvent(new window.FocusEvent('focus'))
  await waitFor(() => !!deepseek.querySelector('svg'), 'keyboard focus did not load the brand')
  assert.deepEqual(requests, ['openai', 'deepseek'])
  const search = root.querySelector('input')!
  search.value = 'gemini'
  search.dispatchEvent(new window.Event('input', { bubbles: true }))
  await nextTick()
  const gemini = root.querySelector('[data-brand-id="gemini"]')!
  await waitFor(() => TestIntersectionObserver.observes(gemini), 'search results were not observed')
  assert.deepEqual(requests, ['openai', 'deepseek'], 'filtering must wait for visibility')
  TestIntersectionObserver.show(gemini)
  await waitFor(() => !!gemini.querySelector('svg'), 'search result did not load')
  search.value = ''
  search.dispatchEvent(new window.Event('input', { bubbles: true }))
  await nextTick()
  const restored = root.querySelector('[data-brand-id="openai"]')!
  await waitFor(() => TestIntersectionObserver.observes(restored), 'restored results were not observed')
  TestIntersectionObserver.show(restored)
  assert.deepEqual(requests, ['openai', 'deepseek', 'gemini'], 'loaded brands must be cached across searches')
  app.unmount()
  assert.equal(TestIntersectionObserver.observes(restored), false, 'unmount must disconnect visibility observation')
})

test('development retry URLs keep resolving the virtual icon module', async t => {
  const vite = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, ws: false } })
  t.after(() => vite.close())
  await vite.listen()
  const address = vite.httpServer!.address()
  assert.ok(address && typeof address !== 'string')
  const response = await fetch(`http://127.0.0.1:${address.port}/@id/__x00__virtual:lobe-brand-icon/openai?retry=1`)
  assert.equal(response.status, 200)
  const source = await response.text()
  assert.ok(source.includes('OpenAI'), 'retry URL lost the requested brand')
  assert.ok(!source.includes('Gemini'), 'retry must not include unrelated brands')
})
