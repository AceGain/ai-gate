import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectBrands, assertCompatible, renderAssets } from './catalog.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)
const read = file => readFile(path.join(root, file), 'utf8')
const json = async file => JSON.parse(await read(file))
const normalize = text => text.replace(/\r\n/g, '\n')
const sha256 = text => createHash('sha256').update(normalize(text)).digest('hex')
const check = process.argv.includes('--check')
assert.ok(process.argv.slice(2).every(arg => arg === '--check'), 'Usage: generate.mjs [--check]')

const [manifest, upstream, snapshot, aliases] = await Promise.all([
  json('package.json'), json('upstream.json'), read('metadata/brands.json'), json('metadata/aliases.json'),
])
assert.equal(sha256(snapshot), upstream.metadata.snapshotSha256, 'Metadata snapshot checksum mismatch; run update:brand-icons')
assert.match(upstream.metadata.commit, /^[a-f0-9]{40}$/, 'Metadata must be pinned to a Git commit')
assert.equal(upstream.metadata.url, `https://raw.githubusercontent.com/lobehub/lobe-icons/${upstream.metadata.commit}/src/toc.json`)
assert.equal(upstream.assets.package, '@lobehub/icons-static-png')
assert.equal(manifest.dependencies[upstream.assets.package], upstream.assets.version, 'Asset dependency must match upstream.json exactly')

const assetManifestPath = require.resolve('@lobehub/icons-static-png/package.json')
const assetManifest = JSON.parse(await readFile(assetManifestPath, 'utf8'))
assert.equal(assetManifest.version, upstream.assets.version, 'Installed assets do not match pinned version; run pnpm install')
const assetsRoot = path.dirname(assetManifestPath)
const [light, dark] = await Promise.all(['light', 'dark'].map(dir => readdir(path.join(assetsRoot, dir))))
const darkFiles = new Set(dark)
// Some color logos contain theme-specific lettering or details. Reuse one asset
// only when its bytes match; otherwise retain the upstream dark variant.
const darkColorIds = new Set((await Promise.all(light
  .filter(file => file.endsWith('-color.png') && darkFiles.has(file))
  .map(async file => {
    const [lightImage, darkImage] = await Promise.all(['light', 'dark'].map(theme => readFile(path.join(assetsRoot, theme, file))))
    return lightImage.equals(darkImage) ? undefined : file.slice(0, -'-color.png'.length)
  })))
  .filter(id => id !== undefined))
const brands = collectBrands(JSON.parse(snapshot), light, dark, aliases, darkColorIds)
const output = 'src/generated/catalog.json'
let previous
try { previous = await json(output) } catch (error) { if (error.code !== 'ENOENT') throw error }
if (previous) assertCompatible(previous, brands, aliases)

const outputs = new Map([
  [output, `${JSON.stringify(brands, null, 2)}\n`],
  ['src/generated/assets.ts', renderAssets(brands)],
])
if (check) {
  for (const [file, content] of outputs) {
    let existing = ''
    try { existing = await read(file) } catch (error) { if (error.code !== 'ENOENT') throw error }
    if (normalize(existing) !== content) throw new Error(`${file} is stale; run pnpm generate:brand-icons and commit the output`)
  }
} else {
  await mkdir(path.join(root, 'src/generated'), { recursive: true })
  for (const [file, content] of outputs) await writeFile(path.join(root, file), content, 'utf8')
}
console.log(`${check ? 'Checked' : 'Generated'} ${brands.length} brands from @lobehub/icons-static-png@${assetManifest.version}`)
