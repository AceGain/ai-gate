import assert from 'node:assert/strict'
import { test } from 'node:test'
import { gzipSync } from 'node:zlib'
import { build } from 'vite'
import { toc } from '@lobehub/icons-vue/es/toc'

test('production emits independent brand chunks without eagerly importing the SVG catalogue', async t => {
  const result = await build({ logLevel: 'silent', build: { write: false } })
  assert.ok(!Array.isArray(result) && 'output' in result)
  const chunks = result.output.filter(item => item.type === 'chunk')
  const brands = chunks.filter(chunk => chunk.facadeModuleId?.startsWith('\0virtual:lobe-brand-icon/'))
  assert.equal(brands.length, toc.length)
  const brandFiles = new Set(brands.map(chunk => chunk.fileName))
  for (const brand of toc) {
    const id = brand.id.toLowerCase()
    const chunk = brands.find(chunk => chunk.facadeModuleId === `\0virtual:lobe-brand-icon/${id}`)!
    assert.ok(chunk, `missing production chunk: ${id}`)
    const includedBrands = new Set(chunk.moduleIds.flatMap(moduleId => {
      const match = moduleId.replaceAll('\\', '/').match(/@lobehub\/icons-vue\/dist\/([^/]+)\/components\//)
      return match ? [match[1].toLowerCase()] : []
    }))
    assert.deepEqual([...includedBrands], [id], `${id} includes another brand's SVG`)
    assert.ok(!chunk.imports.some(file => brandFiles.has(file)), `${id} statically imports another brand`)
  }
  for (const chunk of chunks.filter(chunk => !brandFiles.has(chunk.fileName))) {
    assert.ok(!chunk.imports.some(file => brandFiles.has(file)), `${chunk.fileName} eagerly loads brand SVGs`)
    assert.ok(!chunk.moduleIds.some(id => /icons-vue[/\\]dist[/\\][^/\\]+[/\\]components[/\\]/.test(id)), `${chunk.fileName} contains an eager brand SVG`)
  }
  const registry = chunks.find(chunk => chunk.moduleIds.includes('\0virtual:lobe-brand-icon-loader'))!
  assert.ok(registry)
  assert.match(registry.code, /retry=/, 'production loaders must preserve cache-busting retries')
  // Replaced file references must use deployed relative URLs, never development virtual URLs.
  assert.doesNotMatch(registry.code, /__x00__virtual:lobe-brand-icon\//)
  const selected = ['openai', 'gemini', 'anthropic', 'deepseek'].map(id => {
    const chunk = brands.find(chunk => chunk.facadeModuleId === `\0virtual:lobe-brand-icon/${id}`)!
    return `${id}: ${gzipSync(chunk.code).byteLength} B gzip`
  })
  t.diagnostic(`${brands.length} independent brand chunks; ${selected.join('; ')}`)
})
