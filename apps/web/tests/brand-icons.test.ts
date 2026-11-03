import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
after(() => vite.close())
const {
  defaultProviderIcon,
  isCustomIcon,
  providerIconOptions,
  resolveBrandIcon,
  resolveBrandId,
} = await vite.ssrLoadModule('/src/utils/brandIcons.ts') as typeof import('../src/utils/brandIcons')

test('saved brand IDs and historical aliases keep resolving to the same component', () => {
  for (const [alias, id] of [
    ['googlegemini', 'gemini'],
    ['moonshotai', 'moonshot'],
    ['mistralai', 'mistral'],
  ]) {
    assert.equal(resolveBrandId(alias), id)
    assert.equal(resolveBrandIcon(alias), resolveBrandIcon(id))
  }
  assert.equal(resolveBrandId('openai'), 'openai')
  assert.equal(defaultProviderIcon, '')
})

test('custom images and unknown IDs use the image or initial fallback path', () => {
  for (const value of ['data:image/png;base64,abc', 'http://example.com/icon.png', 'https://example.com/icon.svg']) {
    assert.equal(isCustomIcon(value), true)
    assert.equal(resolveBrandIcon(value), undefined)
  }
  for (const value of ['', 'unknown-brand', '__proto__', 'constructor', 'toString']) {
    assert.equal(isCustomIcon(value), false)
    assert.equal(resolveBrandIcon(value), undefined)
  }
})

test('every selectable brand renders SVG without Vue warnings', async () => {
  assert.ok(providerIconOptions.length >= 357)
  assert.equal(new Set(providerIconOptions.map(item => item.value)).size, providerIconOptions.length)
  for (const { value, label } of providerIconOptions) {
    assert.ok(label)
    assert.equal(value, value.toLowerCase())
    const component = resolveBrandIcon(value)
    assert.ok(component, value)
    const warnings: string[] = []
    const app = createSSRApp({ render: () => h(component, { size: 24, 'aria-hidden': 'true' }) })
    app.config.warnHandler = message => warnings.push(message)
    const markup = await renderToString(app)
    assert.match(markup, /<svg\b/, value)
    assert.match(markup, /height="24"/, value)
    assert.deepEqual(warnings, [], value)
  }
})

test('provider avatars show brand SVGs and keep the initial fallback for unknown IDs', async () => {
  const { default: ProviderIcon } = await vite.ssrLoadModule('/src/components/provider/ProviderIcon.vue')
  for (const icon of ['openai', 'googlegemini']) {
    const markup = await renderToString(createSSRApp({ render: () => h(ProviderIcon, { icon, name: 'Example', size: 'xl' }) }))
    assert.match(markup, /<svg\b/, icon)
    assert.match(markup, /text-foreground/, icon)
    assert.match(markup, /size-8/, icon)
  }
  for (const icon of ['', 'unknown-brand']) {
    const markup = await renderToString(createSSRApp({ render: () => h(ProviderIcon, { icon, name: 'Example' }) }))
    assert.doesNotMatch(markup, /<svg\b/, icon)
    assert.match(markup, />E</, icon)
  }
})

test('provider avatars keep their own initials when the icon chunk fails to load', async (t) => {
  const failedVite = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
    plugins: [{
      name: 'simulate-icon-chunk-failure',
      enforce: 'pre',
      load(id) {
        if (id === '\0virtual:lobe-brand-icons') {
          return 'throw new Error("simulated icon chunk load failure")'
        }
      },
    }],
  })
  t.after(() => failedVite.close())
  const { default: ProviderIcon } = await failedVite.ssrLoadModule('/src/components/provider/ProviderIcon.vue')
  const errors: unknown[] = []
  const app = createSSRApp({
    render: () => h('div', [
      h(ProviderIcon, { icon: 'openai', name: 'Alpha' }),
      h(ProviderIcon, { icon: 'openai', name: 'Beta' }),
      h(ProviderIcon, { icon: 'googlegemini', name: ' ' }),
    ]),
  })
  app.config.errorHandler = error => errors.push(error)
  const markup = await renderToString(app)
  assert.equal(errors.length, 3, 'all three avatars attempted to load their brand icons')
  for (const error of errors) assert.match(String(error), /simulated icon chunk load failure/)
  assert.doesNotMatch(markup, /<svg\b/)
  for (const initial of ['A', 'B', '?']) assert.ok(markup.includes(`>${initial}<`), initial)
})
