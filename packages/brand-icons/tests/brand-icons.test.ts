import assert from 'node:assert/strict'
import test from 'node:test'
import { brands, brandIconOptions, legacyBrandIconKeys, resolveBrandId } from '../src/catalog'
import { createBrandIconResolver } from '../src/resolve'
import { assertCompatible, collectBrands, renderAssets } from '../scripts/catalog.mjs'

const metadata = [
  { id: 'alpha', label: 'Alpha', group: 'model', color: '#123' },
  { id: 'beta', label: 'Beta', group: 'provider', color: '#456' },
  { id: '302', label: '302 AI', group: 'application', color: '#789' },
]

test('the real catalog has valid metadata and preserves every historical alias', () => {
  assert.ok(brands.length > 0)
  assert.equal(new Set(brands.map(brand => brand.id)).size, brands.length)
  assert.equal(brandIconOptions.length, brands.length)
  for (const [index, brand] of brands.entries()) {
    assert.equal(resolveBrandId(brand.id), brand.id)
    assert.ok(brand.label.trim())
    assert.ok(['model', 'provider', 'application'].includes(brand.group))
    assert.equal(typeof brand.hasColor, 'boolean')
    assert.equal(typeof brand.hasDark, 'boolean')
    assert.equal(typeof brand.hasDarkColor, 'boolean')
    assert.deepEqual(brandIconOptions[index], { value: brand.id, label: brand.label })
  }
  for (const [alias, target] of Object.entries(legacyBrandIconKeys)) {
    assert.equal(resolveBrandId(alias), target)
    assert.equal(resolveBrandId(target), target)
  }
  assert.equal(resolveBrandId('googlegemini'), 'gemini')
  assert.equal(resolveBrandId('moonshotai'), 'moonshot')
  assert.equal(resolveBrandId('mistralai'), 'mistral')
})

test('unrecognized IDs and Object prototype properties never become brand IDs', () => {
  for (const id of ['', 'not-a-brand', 'toString', '__proto__', 'constructor', 'hasOwnProperty']) {
    assert.equal(resolveBrandId(id), undefined, id)
  }
})

test('URL resolution prefers color, switches monochrome themes and falls back to the available theme', () => {
  const assets = {
    colored: { color: 'color.png', light: 'unused-light.png', dark: 'unused-dark.png' },
    themedcolor: { color: 'color-light.png', colorDark: 'color-dark.png' },
    mono: { light: 'light.png', dark: 'dark.png' },
    lightonly: { light: 'light-only.png' },
    darkonly: { dark: 'dark-only.png' },
    empty: {},
  }
  const resolve = createBrandIconResolver(assets, id => id === 'legacy' ? 'mono' : id)
  assert.equal(resolve('colored'), 'color.png')
  assert.equal(resolve('colored', true), 'color.png')
  assert.equal(resolve('themedcolor'), 'color-light.png')
  assert.equal(resolve('themedcolor', true), 'color-dark.png')
  assert.equal(resolve('mono'), 'light.png')
  assert.equal(resolve('mono', true), 'dark.png')
  assert.equal(resolve('legacy', true), 'dark.png')
  assert.equal(resolve('lightonly', true), 'light-only.png')
  assert.equal(resolve('darkonly'), 'dark-only.png')
  for (const id of ['', 'empty', 'missing', 'toString', '__proto__', 'constructor', 'data:image/png;base64,AA==', 'https://example.com/icon.png']) {
    assert.equal(resolve(id), '', id)
  }
})

test('catalog generation recognizes logo variants without treating text or brand combinations as icons', () => {
  const light = [
    'alpha.png', 'alpha-color.png', 'beta.png', '302-color.png',
    'alpha-text.png', 'alpha-text-cn.png', 'alpha-text-color.png',
    'alpha-brand.png', 'alpha-brand-color.png', 'README.md',
  ]
  const dark = ['alpha.png', 'beta.png']
  const entries = collectBrands(metadata, light, dark, { legacybeta: 'beta' })
  assert.deepEqual(entries.map(brand => brand.id), ['302', 'alpha', 'beta'])
  assert.equal(entries[0].hasColor, true, 'a color-only logo is included')
  assert.equal(entries[1].hasColor, true)
  assert.equal(entries[2].hasColor, false)
  assert.equal(entries[2].hasDark, true)

  const reversed = collectBrands([...metadata].reverse(), [...light].reverse(), [...dark].reverse(), { legacybeta: 'beta' })
  assert.deepEqual(reversed, entries)
  assert.equal(renderAssets(reversed), renderAssets(entries))

  const output = renderAssets(entries)
  const imported = [...output.matchAll(/from '@lobehub\/icons-static-png\/(light|dark)\/([^']+)'/g)]
  assert.equal(imported.length, 4)
  for (const [, theme, file] of imported) {
    assert.ok((theme === 'light' ? light : dark).includes(file), `Missing asset import: ${theme}/${file}`)
  }
  assert.ok(!output.includes('/light/302.png'), 'numeric color-only IDs have no invented mono import')
  assert.ok(!output.includes('/dark/alpha.png'), 'colored brands need only their color asset')
})

test('invalid or incomplete metadata fails before generating imports', () => {
  assert.throws(() => collectBrands(metadata, ['unknown.png'], [], {}), /no brand metadata/)
  assert.throws(() => collectBrands([...metadata, metadata[0]], ['alpha.png'], [], {}), /Duplicate brand ID/)
  assert.throws(() => collectBrands([{ ...metadata[0], id: '../alpha' }], ['alpha.png'], [], {}), /Invalid brand ID/)
  assert.throws(() => collectBrands([{ ...metadata[0], label: ' ' }], ['alpha.png'], [], {}), /Missing label/)
  assert.throws(() => collectBrands([{ ...metadata[0], group: 'other' }], ['alpha.png'], [], {}), /Invalid group/)
  assert.throws(() => collectBrands(metadata, ['alpha-text.png'], [], {}), /No logo assets/)
})

test('distinct dark color assets are generated, while identical color variants share an import', () => {
  const light = ['alpha.png', 'alpha-color.png']
  const dark = ['alpha.png', 'alpha-color.png']
  const distinct = collectBrands(metadata, light, dark, {})
  assert.equal(distinct[0].hasDarkColor, true)
  assert.match(renderAssets(distinct), /dark\/alpha-color\.png/)
  assert.match(renderAssets(distinct), /colorDark:/)

  const identical = collectBrands(metadata, light, dark, {}, new Set())
  assert.equal(identical[0].hasDarkColor, false)
  assert.doesNotMatch(renderAssets(identical), /dark\/alpha-color\.png/)
  assert.doesNotMatch(renderAssets(identical), /colorDark:/)
})

test('aliases must point to a current brand and cannot replace a current ID', () => {
  assert.throws(() => collectBrands(metadata, ['alpha.png'], [], { legacy: 'missing' }), /Alias target is not a current brand/)
  assert.throws(() => collectBrands(metadata, ['alpha.png'], [], { alpha: 'alpha' }), /Alias shadows a current brand/)
  assert.throws(() => collectBrands(metadata, ['alpha.png'], [], { '../legacy': 'alpha' }), /Invalid alias/)
})

test('updates cannot silently remove persisted IDs, but explicit compatibility aliases allow a rename', () => {
  const previous = [{ id: 'oldbrand' }, { id: 'alpha' }]
  const current = [{ id: 'newbrand' }, { id: 'alpha' }]
  assert.throws(() => assertCompatible(previous, current, {}), /oldbrand/)
  assert.throws(() => assertCompatible(previous, current, { oldbrand: 'missing' }), /oldbrand/)
  assert.doesNotThrow(() => assertCompatible(previous, current, { oldbrand: 'newbrand' }))
  assert.doesNotThrow(() => assertCompatible(current, [...current, { id: 'anotherbrand' }], {}))
})
