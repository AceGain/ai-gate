import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { type TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'
import { collectBrands, renderAssets } from '../scripts/catalog.mjs'

const sourceScripts = fileURLToPath(new URL('../scripts/', import.meta.url))
const packagePath = 'packages/brand-icons'
const initialAliases = { legacyalpha: 'alpha', legacybeta: 'beta' }
const serialize = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

async function fixture(t: TestContext) {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'brand-icons-compat-'))
  t.after(async () => {
    // Only remove the directory returned by mkdtemp, never a caller-supplied path.
    assert.equal(path.dirname(temporaryRoot), path.resolve(tmpdir()))
    assert.ok(path.basename(temporaryRoot).startsWith('brand-icons-compat-'))
    await rm(temporaryRoot, { recursive: true, force: true })
  })
  const root = path.join(temporaryRoot, ...packagePath.split('/'))
  const assets = path.join(root, 'node_modules', '@lobehub', 'icons-static-png')
  const catalogPath = path.join(root, 'src', 'generated', 'catalog.json')
  const generatedAssetsPath = path.join(root, 'src', 'generated', 'assets.ts')
  const aliasesPath = path.join(root, 'metadata', 'aliases.json')

  const git = (...args: string[]) => {
    const result = spawnSync('git', ['-c', 'core.autocrlf=false', ...args], {
      cwd: temporaryRoot,
      encoding: 'utf8',
    })
    assert.equal(result.status, 0, `${args.join(' ')}\n${result.stderr}`)
    return result.stdout.trim()
  }
  const commit = (message: string) => {
    git('add', '--', '.gitignore')
    if (existsSync(root)) {
      git('add', '--', ...['package.json', 'metadata', 'src', 'scripts', 'upstream.json'].map(file => `${packagePath}/${file}`))
    }
    git('-c', 'user.name=Brand Icons Test', '-c', 'user.email=brand-icons-test@example.invalid',
      '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=.git/no-hooks', 'commit', '--quiet', '-m', message)
    return git('rev-parse', 'HEAD')
  }
  const runWithBaseEnvironment = (baseRef: string, ...args: string[]) => spawnSync(process.execPath, [path.join(root, 'scripts', 'generate.mjs'), ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, BRAND_ICONS_BASE_REF: baseRef },
  })
  const run = (...args: string[]) => runWithBaseEnvironment('', ...args)
  const successful = (...args: string[]) => {
    const result = run(...args)
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    return result
  }

  git('init', '--quiet')
  await writeFile(path.join(temporaryRoot, '.gitignore'), 'node_modules/\n')
  const seed = commit('create repository before brand icons are introduced')
  await Promise.all(['scripts', 'metadata', 'src/generated'].map(dir => mkdir(path.join(root, dir), { recursive: true })))
  for (const file of await readdir(sourceScripts)) {
    if (file.endsWith('.mjs')) await copyFile(path.join(sourceScripts, file), path.join(root, 'scripts', file))
  }
  await writeFile(path.join(root, 'package.json'), serialize({
    name: '@ai-gate/brand-icons', type: 'module', dependencies: { '@lobehub/icons-static-png': '2.6.0' },
  }))
  await mkdir(assets, { recursive: true })
  await writeFile(path.join(assets, 'package.json'), serialize({ name: '@lobehub/icons-static-png', version: '2.6.0' }))
  for (const theme of ['light', 'dark']) await mkdir(path.join(assets, theme))

  let currentIds = ['alpha', 'beta']
  let currentAliases: Record<string, string> = { ...initialAliases }
  const writeState = async (ids: string[], aliases: Record<string, string>) => {
    currentIds = ids
    currentAliases = aliases
    for (const theme of ['light', 'dark']) {
      for (const file of await readdir(path.join(assets, theme))) await unlink(path.join(assets, theme, file))
      for (const id of ids) await writeFile(path.join(assets, theme, `${id}.png`), `fixture ${theme} ${id}`)
    }
    const snapshot = serialize(ids.map(id => ({ id, label: id, group: 'model', color: '#000' })))
    const commit = '0'.repeat(40)
    await writeFile(path.join(root, 'metadata', 'brands.json'), snapshot)
    await writeFile(aliasesPath, serialize(aliases))
    await writeFile(path.join(root, 'upstream.json'), serialize({
      assets: { package: '@lobehub/icons-static-png', version: '2.6.0' },
      metadata: {
        package: '@lobehub/icons', version: '6.14.0', commit,
        url: `https://raw.githubusercontent.com/lobehub/lobe-icons/${commit}/src/toc.json`,
        sourceSha256: '0'.repeat(64),
        snapshotSha256: createHash('sha256').update(snapshot).digest('hex'),
      },
      license: 'MIT',
    }))
  }
  const writeRegeneratedOutput = async () => {
    // Emulate a PR that already contains perfectly synchronized new output.
    // Its compatibility must depend on the Git baseline, not on this output.
    const metadata = JSON.parse(await readFile(path.join(root, 'metadata', 'brands.json'), 'utf8'))
    const files = currentIds.map(id => `${id}.png`)
    const entries = collectBrands(metadata, files, files, currentAliases)
    await writeFile(catalogPath, serialize(entries))
    await writeFile(generatedAssetsPath, renderAssets(entries))
  }
  const output = async () => Promise.all([readFile(catalogPath), readFile(generatedAssetsPath)])

  await writeState(currentIds, currentAliases)
  successful('--base-ref', seed)
  const baseline = commit('record brand catalog and historical aliases')
  return { root, seed, baseline, git, commit, run, runWithBaseEnvironment, successful, writeState, writeRegeneratedOutput, output, catalogPath, generatedAssetsPath, aliasesPath }
}

test('deleting generated output cannot bypass removal of a committed brand ID', async t => {
  const f = await fixture(t)
  await f.writeState(['alpha'], { legacyalpha: 'alpha' })
  const existingAssets = await readFile(f.generatedAssetsPath)
  await unlink(f.catalogPath)
  const result = f.run()
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /beta/)
  await assert.rejects(readFile(f.catalogPath), { code: 'ENOENT' })
  assert.deepEqual(await readFile(f.generatedAssetsPath), existingAssets)
})

test('CI rejects removed brands even when generated output is already synchronized', async t => {
  const f = await fixture(t)
  await f.writeState(['alpha'], { legacyalpha: 'alpha' })
  await f.writeRegeneratedOutput()
  const before = await f.output()
  const result = f.run('--check', '--base-ref', f.baseline)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /beta/)
  assert.deepEqual(await f.output(), before, 'check must not rewrite generated files')
})

test('CI rejects deletion of any committed alias', async t => {
  const f = await fixture(t)
  await f.writeState(['alpha', 'beta'], { legacybeta: 'beta' })
  const before = await f.output()
  const result = f.run('--check')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /legacyalpha/)
  assert.deepEqual(await f.output(), before)
})

test('historical aliases cannot be reassigned to an unrelated current brand', async t => {
  const f = await fixture(t)
  await f.writeState(['alpha', 'beta'], { legacyalpha: 'beta', legacybeta: 'beta' })
  const result = f.run('--check')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /legacyalpha/)
})

test('canonical renames pass when both the old ID and historical aliases resolve to the new brand', async t => {
  const f = await fixture(t)
  await f.writeState(['gamma', 'beta'], { alpha: 'gamma', legacyalpha: 'gamma', legacybeta: 'beta' })
  f.successful()
  f.successful('--check', '--base-ref', f.baseline)
  const catalog = JSON.parse(await readFile(f.catalogPath, 'utf8'))
  assert.deepEqual(catalog.map((brand: { id: string }) => brand.id), ['beta', 'gamma'])
})

test('an explicit target baseline cannot be replaced by a PR commit containing incompatible regenerated output', async t => {
  const f = await fixture(t)
  await f.writeState(['alpha'], { legacyalpha: 'alpha' })
  await f.writeRegeneratedOutput()
  f.commit('commit incompatible but synchronized generated output')
  f.successful('--check') // HEAD alone has lost the historical record.
  const result = f.run('--check', '--base-ref', f.baseline)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /beta/)
})

test('unknown or unavailable baseline refs fail without writing output', async t => {
  const f = await fixture(t)
  const before = await f.output()
  const result = f.run('--check', '--base-ref', 'missing-brand-icons-baseline')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /missing-brand-icons-baseline|baseline|base.ref|revision/i)
  assert.deepEqual(await f.output(), before)
})

test('CI baseline environment is honored and an explicit CLI baseline takes precedence', async t => {
  const f = await fixture(t)
  await f.writeState(['alpha'], { legacyalpha: 'alpha' })
  await f.writeRegeneratedOutput()
  f.commit('commit output that no longer contains beta')
  const result = f.runWithBaseEnvironment(f.baseline, '--check')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /beta/)
  const overridden = f.runWithBaseEnvironment(f.baseline, '--check', '--base-ref', 'HEAD')
  assert.equal(overridden.status, 0, overridden.stderr)
})

test('a baseline from before package introduction is valid', async t => {
  const f = await fixture(t)
  f.successful('--check', '--base-ref', f.seed)
})

test('a package baseline with a missing aliases file fails closed', async t => {
  const f = await fixture(t)
  const originalAliases = await readFile(f.aliasesPath)
  await unlink(f.aliasesPath)
  const incompleteBaseline = f.commit('remove baseline aliases file')
  await writeFile(f.aliasesPath, originalAliases)
  const result = f.run('--check', '--base-ref', incompleteBaseline)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /alias|baseline|missing|incomplete/i)
})

test('a corrupt committed catalog fails even if the worktree contains valid regenerated output', async t => {
  const f = await fixture(t)
  const originalCatalog = await readFile(f.catalogPath)
  await writeFile(f.catalogPath, '{"not":"a brand catalog"}\n')
  const corruptBaseline = f.commit('record malformed baseline catalog')
  await writeFile(f.catalogPath, originalCatalog)
  const result = f.run('--check', '--base-ref', corruptBaseline)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /catalog|baseline|array|invalid/i)
})

test('a commit containing the package but neither baseline file is not treated as first introduction', async t => {
  const f = await fixture(t)
  const originalCatalog = await readFile(f.catalogPath)
  const originalAliases = await readFile(f.aliasesPath)
  await unlink(f.catalogPath)
  await unlink(f.aliasesPath)
  const missingBaseline = f.commit('remove both baseline files but retain package')
  await writeFile(f.catalogPath, originalCatalog)
  await writeFile(f.aliasesPath, originalAliases)
  const result = f.run('--check', '--base-ref', missingBaseline)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /baseline|missing|catalog|alias/i)
})

test('CRLF baseline and worktree files remain compatible without check rewriting them', async t => {
  const f = await fixture(t)
  const paths = [f.catalogPath, f.generatedAssetsPath, f.aliasesPath, path.join(f.root, 'metadata', 'brands.json')]
  for (const file of paths) {
    const contents = await readFile(file, 'utf8')
    await writeFile(file, contents.replace(/\r?\n/g, '\r\n'))
  }
  const baseline = f.commit('record CRLF files')
  const before = await Promise.all(paths.map(file => readFile(file)))
  f.successful('--check', '--base-ref', baseline)
  assert.deepEqual(await Promise.all(paths.map(file => readFile(file))), before)
})
