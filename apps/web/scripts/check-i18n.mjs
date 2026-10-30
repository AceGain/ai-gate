import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createI18n } from 'vue-i18n'
import { detectLocale, isAppLocale, SUPPORTED_LOCALES } from '../src/i18n/locales.ts'

const root = fileURLToPath(new URL('../src/', import.meta.url))
const messages = Object.fromEntries(await Promise.all(SUPPORTED_LOCALES.map(async locale => [
  locale, JSON.parse(await readFile(path.join(root, 'locales', `${locale}.json`), 'utf8')),
])))

function flatten(object, prefix = '') {
  return Object.fromEntries(Object.entries(object).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? [[fullKey, value]] : Object.entries(flatten(value, fullKey))
  }))
}

const resources = Object.fromEntries(Object.entries(messages).map(([locale, value]) => [locale, flatten(value)]))
const base = resources['zh-CN']
const params = message => [...new Set([...message.matchAll(/\{(\w+)\}/g)].map(match => match[1]))].sort()
const warnings = []
const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages, warnHtmlMessage: true })
const originalWarn = console.warn
console.warn = message => warnings.push(String(message))
try {
  for (const [locale, strings] of Object.entries(resources)) {
    assert.deepEqual(Object.keys(strings).sort(), Object.keys(base).sort(), `${locale}: translation keys differ`)
    i18n.global.locale.value = locale
    for (const [key, message] of Object.entries(strings)) {
      assert.ok(message.trim(), `${locale}:${key}: empty translation`)
      assert.deepEqual(params(message), params(base[key]), `${locale}:${key}: interpolation parameters differ`)
      const named = Object.fromEntries(params(message).map(name => [name, name === 'count' ? 2 : 'Example']))
      const rendered = i18n.global.t(key, named)
      assert.notEqual(rendered, key, `${locale}:${key}: failed to render`)
      assert.ok(!/\{\w+\}/.test(rendered), `${locale}:${key}: unresolved interpolation`)
    }
  }
} finally {
  console.warn = originalWarn
}
assert.deepEqual(warnings, [], 'Unexpected translation warnings')
i18n.global.locale.value = 'en-US'
assert.equal(i18n.global.t('importModels.selectedKeys', { count: 1 }), '1 key selected')
assert.equal(i18n.global.t('importModels.selectedKeys', { count: 2 }), '2 keys selected')
assert.equal(i18n.global.t('importModels.imported', { count: 1 }), 'Imported 1 model')
assert.equal(i18n.global.t('importModels.imported', { count: 2 }), 'Imported 2 models')

// Catch misspelled literal keys even when an API overload accepts arbitrary strings.
async function checkSource(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) await checkSource(file)
    else if (/\.(vue|ts)$/.test(file)) {
      const source = await readFile(file, 'utf8')
      for (const match of source.matchAll(/\bt\(\s*'([^']+)'/g)) {
        assert.ok(Object.hasOwn(base, match[1]), `${path.relative(root, file)}: unknown translation key ${match[1]}`)
      }
    }
  }
}
await checkSource(root)

for (const [languages, expected] of [
  [['zh-CN'], 'zh-CN'], [['zh-SG'], 'zh-CN'], [['zh-Hans-TW'], 'zh-CN'],
  [['zh-TW'], 'zh-TW'], [['zh-HK'], 'zh-TW'], [['zh-MO'], 'zh-TW'], [['zh-Hant-CN'], 'zh-TW'],
  [['en-GB'], 'en-US'], [['fr-FR', 'en-US'], 'en-US'], [['ja-JP', 'zh-Hant'], 'zh-TW'],
  [['fr-FR'], 'zh-CN'], [[], 'zh-CN'],
]) assert.equal(detectLocale(languages), expected, `Locale detection: ${languages}`)
for (const locale of SUPPORTED_LOCALES) assert.ok(isAppLocale(locale))
for (const invalid of [undefined, null, '', 'fr-FR', '__proto__']) assert.equal(isAppLocale(invalid), false)

console.log(`i18n checks passed: ${SUPPORTED_LOCALES.length} locales, ${Object.keys(base).length} keys, matching interpolation parameters, locale detection, and source references.`)
