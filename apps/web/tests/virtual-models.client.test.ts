import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { readFile } from 'node:fs/promises'
import { Window } from 'happy-dom'
import { clientVueRendering } from './helpers/client-vue'

const window = new Window({ url: 'http://localhost/' })
for (const key of ['window', 'document', 'navigator', 'history', 'location', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLButtonElement', 'SVGElement', 'Node', 'NodeFilter', 'Document', 'DocumentFragment', 'ShadowRoot', 'MutationObserver', 'ResizeObserver', 'CustomEvent', 'Event', 'KeyboardEvent', 'PointerEvent', 'MouseEvent']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? window : window[key as keyof Window] })
}
for (const key of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) {
  Object.defineProperty(globalThis, key, { configurable: true, value: window[key].bind(window) })
}
const { createApp, h, nextTick, ref } = await import('vue')
const { createServer } = await import('vite')
const { createI18n } = await import('vue-i18n')
const messages = JSON.parse(await readFile(new URL('../src/locales/en-US.json', import.meta.url), 'utf8'))
after(() => window.happyDOM.close())
async function waitFor(condition: () => boolean, message: string) {
  const deadline = Date.now() + 5000
  while (!condition()) {
    if (Date.now() > deadline) assert.fail(message)
    await delay(10); await nextTick()
  }
}
function field(suffix: string) {
  const element = window.document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`input[id$="-${suffix}"], textarea[id$="-${suffix}"]`)
  assert.ok(element, `Missing field ${suffix}`)
  return element
}
async function fill(suffix: string, value: string) {
  const element = field(suffix)
  element.value = value
  element.dispatchEvent(new window.Event('input', { bubbles: true }))
  await nextTick()
}
function submit() {
  const form = window.document.querySelector('form')
  assert.ok(form)
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
}
function button(text: string) {
  const element = [...window.document.querySelectorAll('button')].find(button => button.textContent?.trim() === text)
  assert.ok(element, `Missing button ${text}`)
  return element
}

test('virtual model editor validates, preserves role configuration, and renders the management page', async t => {
  const originalFetch = globalThis.fetch
  const writes: { path: string, body: any, method: string }[] = []
  let sourcesFail = false
  let sourcesDisabled = false
  let conflict = false
  const base = { id: 1, code: 'virtual', name: 'Virtual', category: 'Coding', kind: 'DECISION', type: 'TEXT',
    enabled: false, status: 'ACTIVE', generates: null, config: { inputModal: ['text', 'image'] },
    orchConfig: { PROPOSER: { minSuccess: 1, maxConcurrency: 2 }, DECIDER: { requestConfig: { temperature: 0.3 } }, EXECUTOR: { strategy: 'WEIGHTED' } },
    timeout: 90000, maxCalls: 12, sort: 4, remark: 'Keep remark', createTime: 'c', updateTime: 'u',
    members: [{ id: 7, virtualModelId: 1, modelId: 11, role: 'PROPOSER', enabled: true, sort: 3, weight: 8, remark: 'Keep member', sourceCode: 'first', sourceName: 'First', providerName: 'Provider', sourceEnabled: true, createTime: 'c', updateTime: 'u' }] }
  globalThis.fetch = async (url, init) => {
    const path = String(url)
    if (init?.body) {
      const body = JSON.parse(String(init.body))
      writes.push({ path, body, method: init.method! })
      if (conflict) return Response.json({ error: 'DUPLICATE_VIRTUAL_MODEL' }, { status: 409 })
      return Response.json({ ...base, ...body })
    }
    if (path.endsWith('/model-sources')) return sourcesFail ? Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
      : Response.json([{ id: 11, code: 'first', name: 'First', providerName: 'Provider', generates: ['Responses'], enabled: !sourcesDisabled }])
    return Response.json([base])
  }
  t.after(() => { globalThis.fetch = originalFetch })
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, plugins: [clientVueRendering()] })
  t.after(() => vite.close())
  const { default: Modal } = await vite.ssrLoadModule('/src/components/virtual-model/VirtualModelModal.vue')
  const { default: Page } = await vite.ssrLoadModule('/src/views/VirtualModelsView.vue')
  const { useConfirmDialog } = await vite.ssrLoadModule('/src/composables/useConfirmDialog.ts')
  const open = ref(false)
  const editing = ref<any>(null)
  const showPage = ref(false)
  const root = window.document.createElement('div')
  const header = window.document.createElement('div'); header.id = 'header-actions'
  window.document.body.append(header, root)
  const app = createApp({ render: () => showPage.value ? h(Page) : h(Modal, {
    open: open.value, 'onUpdate:open': (value: boolean) => { open.value = value }, item: editing.value,
  }) })
  app.use(createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': messages } }))
  app.mount(root)
  t.after(() => { app.unmount(); root.remove(); header.remove() })
  async function reopen(item: any) {
    open.value = false; await nextTick(); editing.value = item; await nextTick(); open.value = true
    await waitFor(() => !!window.document.querySelector('input[id$="-code"]'), 'Editor did not open')
    await waitFor(() => !window.document.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, 'Sources did not load')
    await delay(20)
  }
  for (const kind of ['GROUP', 'FUSION', 'DECISION']) {
    await t.test(`creates a ${kind} draft with its selected type`, async () => {
      await reopen(null)
      button(kind).click(); await nextTick()
      await fill('code', `new-${kind.toLowerCase()}`)
      submit(); await waitFor(() => !open.value, 'Draft did not save')
      assert.equal(writes.at(-1)!.body.kind, kind)
      assert.equal(writes.at(-1)!.method, 'POST')
      assert.deepEqual(writes.at(-1)!.body.members, [])
    })
  }
  await t.test('adds a source, changes its role, and removes an association through the form', async () => {
    await reopen(null)
    button('DECISION').click(); await nextTick()
    await fill('code', 'with-member')
    button('Add associated model').click(); await nextTick()
    async function select(suffix: string, label: string) {
      const trigger = window.document.querySelector<HTMLButtonElement>(`button[id$="-${suffix}"]`)!
      assert.ok(trigger, `Missing select ${suffix}`)
      trigger.focus()
      trigger.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await waitFor(() => [...window.document.querySelectorAll('[role="option"]')].some(option => option.textContent!.includes(label)), `Missing option ${label}`)
      const option = [...window.document.querySelectorAll<HTMLElement>('[role="option"]')].find(option => option.textContent!.includes(label))!
      option.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }))
      await waitFor(() => trigger.getAttribute('aria-expanded') === 'false', `Select ${suffix} did not close`)
    }
    await select('member-0-model', 'Provider / First')
    await select('member-0-role', 'DECIDER')
    await fill('member-0-weight', '5')
    button('Add associated model').click(); await nextTick()
    const deletes = [...window.document.querySelectorAll('button')].filter(element => element.textContent?.trim() === 'Delete')
    assert.equal(deletes.length, 2)
    deletes[1].click(); await nextTick()
    submit(); await waitFor(() => !open.value, 'Association changes did not save')
    assert.deepEqual(writes.at(-1)!.body.members, [{ modelId: 11, role: 'DECIDER', enabled: true, sort: 0, weight: 5, remark: '' }])
  })
  await t.test('invalid JSON and invalid weights cannot be submitted', async () => {
    await reopen(base)
    assert.equal(field('code').disabled, true)
    assert.equal(button('DECISION').disabled, true)
    const count = writes.length
    await fill('orchConfig', '{broken')
    submit()
    await waitFor(() => field('orchConfig').getAttribute('aria-invalid') === 'true', 'Invalid JSON not reported')
    assert.equal(writes.length, count)
    await fill('orchConfig', JSON.stringify(base.orchConfig))
    await fill('member-0-weight', '0')
    submit()
    await waitFor(() => field('member-0-weight').getAttribute('aria-invalid') === 'true', 'Invalid weight not reported')
    assert.equal(writes.length, count)
    await fill('member-0-weight', '9')
    await fill('member-0-sort', '2')
    await fill('timeout', '123456')
    submit(); await waitFor(() => !open.value, 'Edited model did not save')
    const payload = writes.at(-1)!.body
    assert.equal(writes.at(-1)!.method, 'PUT')
    assert.equal(payload.timeout, 123456)
    assert.equal(payload.maxCalls, 12)
    assert.equal(payload.sort, 4)
    assert.equal(payload.enabled, false)
    assert.deepEqual(payload.config, base.config)
    assert.deepEqual(payload.orchConfig, base.orchConfig)
    assert.deepEqual(payload.members[0], { id: 7, modelId: 11, role: 'PROPOSER', enabled: true, sort: 2, weight: 9, remark: 'Keep member' })
  })
  await t.test('structured role settings update JSON without dropping advanced parameters', async () => {
    await reopen(base)
    await fill('EXECUTOR-timeout', '1234')
    const json = JSON.parse(field('orchConfig').value)
    assert.equal(json.EXECUTOR.timeout, 1234)
    assert.equal(json.EXECUTOR.strategy, 'WEIGHTED')
    assert.deepEqual(json.DECIDER.requestConfig, { temperature: 0.3 })
    submit(); await waitFor(() => !open.value, 'Structured configuration did not save')
    assert.equal(writes.at(-1)!.body.orchConfig.EXECUTOR.timeout, 1234)
  })
  await t.test('conflict keeps the editor open with a field error', async () => {
    await reopen(base)
    conflict = true; submit()
    await waitFor(() => field('code').getAttribute('aria-invalid') === 'true', 'Duplicate code not shown')
    assert.equal(open.value, true)
    conflict = false
  })
  await t.test('failed source reload blocks saving stale associations', async () => {
    open.value = false; await nextTick(); sourcesFail = true; open.value = true
    await waitFor(() => !!window.document.querySelector('[role="alert"]'), 'Source error missing')
    const count = writes.length
    submit(); await delay(100)
    assert.equal(writes.length, count)
    assert.equal(open.value, true)
    sourcesFail = false
    button('Retry').click()
    await waitFor(() => !window.document.querySelector('[role="alert"]'), 'Source retry failed')
    submit(); await waitFor(() => !open.value, 'Retry did not restore saving')
  })
  await t.test('role arrays, inapplicable settings, and invalid capabilities are reported on their fields', async () => {
    await reopen(base)
    const count = writes.length
    for (const value of ['{"PROPOSER":[]}', '{"PROPOSER":{"strategy":"PRIORITY"}}']) {
      await fill('orchConfig', value); submit()
      await waitFor(() => field('orchConfig').getAttribute('aria-invalid') === 'true', 'Invalid role settings not reported')
      assert.equal(writes.length, count)
    }
    await fill('orchConfig', JSON.stringify(base.orchConfig))
    await fill('config', '{"maxOutput":-1}'); submit()
    await waitFor(() => field('config').getAttribute('aria-invalid') === 'true', 'Invalid capabilities not reported')
    await fill('config', JSON.stringify(base.config))
    await fill('generates', '["Unknown"]'); submit()
    await waitFor(() => field('generates').getAttribute('aria-invalid') === 'true', 'Invalid protocol not reported')
    assert.equal(writes.length, count)
  })
  await t.test('enabling with only locally unavailable sources is blocked before sending', async () => {
    sourcesDisabled = true
    const item = { ...base, kind: 'GROUP', enabled: true, orchConfig: { SELECT: {} },
      members: [{ ...base.members[0], role: 'SELECT' }] }
    await reopen(item)
    const count = writes.length
    submit()
    await waitFor(() => !!window.document.querySelector('[role="alert"]'), 'Unavailable-source readiness error missing')
    assert.equal(open.value, true)
    assert.equal(writes.length, count)
    sourcesDisabled = false
    await reopen(item)
    submit(); await waitFor(() => !open.value, 'Available source did not restore enabling')
    assert.equal(writes.at(-1)!.body.enabled, true)
  })
  await t.test('management page lists real models, supports search, and opens editing', async () => {
    showPage.value = true
    await waitFor(() => root.textContent!.includes('Virtual'), 'List did not load')
    assert.equal(root.querySelectorAll('[role="listitem"]').length, 1)
    const search = root.querySelector<HTMLInputElement>('input')!
    search.value = 'missing'; search.dispatchEvent(new window.Event('input', { bubbles: true }))
    await waitFor(() => root.textContent!.includes('No matching virtual models'), 'Search did not filter')
    search.value = ''; search.dispatchEvent(new window.Event('input', { bubbles: true }))
    await waitFor(() => root.querySelectorAll('[role="listitem"]').length === 1, 'Search did not restore results')
    root.querySelector<HTMLButtonElement>('button[aria-label="Edit"]')!.click()
    await waitFor(() => !!window.document.querySelector('input[id$="-code"]'), 'List edit did not open')
    assert.equal(field('code').value, 'virtual')
  })
  await t.test('a successful toggle remains visible when the following list refresh fails', async () => {
    button('Cancel').click(); await nextTick()
    const previousFetch = globalThis.fetch
    globalThis.fetch = async (_url, init) => init?.method === 'PATCH'
      ? Response.json({ ...base, enabled: true })
      : Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
    try {
      root.querySelector<HTMLButtonElement>('[role="switch"]')!.click()
      await waitFor(() => !!root.querySelector('[role="alert"]'), 'Refresh failure not shown')
      assert.equal(root.querySelector('[role="switch"]')!.getAttribute('aria-checked'), 'true')
    } finally { globalThis.fetch = previousFetch }
  })
  await t.test('a newly saved model remains listed when the following refresh fails', async () => {
    const previousFetch = globalThis.fetch
    globalThis.fetch = async (url, init) => {
      if (String(url).endsWith('/model-sources')) return Response.json([{ id: 11, code: 'first', name: 'First', providerName: 'Provider', generates: ['Responses'], enabled: true }])
      if (init?.method === 'POST') return Response.json({ ...base, ...JSON.parse(String(init.body)), id: 2 })
      return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
    }
    try {
      button('Add').click()
      await waitFor(() => !!window.document.querySelector('input[id$="-code"]'), 'Create editor did not open')
      await waitFor(() => !window.document.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, 'Sources did not load')
      await fill('code', 'created-during-refresh-error'); submit()
      await waitFor(() => root.textContent!.includes('created-during-refresh-error'), 'Saved model disappeared after refresh failure')
      assert.equal(root.querySelectorAll('[role="listitem"]').length, 2)
    } finally { globalThis.fetch = previousFetch }
  })
  await t.test('a successfully deleted model stays removed when the following refresh fails', async () => {
    const previousFetch = globalThis.fetch
    globalThis.fetch = async (_url, init) => init?.method === 'DELETE' ? Response.json({ ok: true })
      : Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
    try {
      const row = [...root.querySelectorAll('[role="listitem"]')].find(element => element.textContent!.includes('created-during-refresh-error'))!
      row.querySelector<HTMLButtonElement>('button[aria-label="Delete"]')!.click()
      const confirm = useConfirmDialog()
      await waitFor(() => !!confirm.state.value, 'Delete confirmation did not open')
      confirm.settle(true)
      await waitFor(() => !root.textContent!.includes('created-during-refresh-error'), 'Deleted model reappeared after refresh failure')
      assert.equal(root.querySelectorAll('[role="listitem"]').length, 1)
    } finally { globalThis.fetch = previousFetch }
  })
})
