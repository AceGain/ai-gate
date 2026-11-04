import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { assertBaselineRetained, assertBrandIconCompatibility, readCommittedBaseline } from './helpers/brand-icon-compatibility'

test('catalog growth cannot hide the removal or redirection of saved IDs', () => {
  const baseline = { ids: ['alpha', 'beta'], aliases: { legacybeta: 'beta' } }
  const removed = new Map([['alpha', 'alpha'], ['newbrand', 'newbrand']])
  assert.throws(() => assertBrandIconCompatibility(baseline, id => removed.get(id)), /beta/)
  const renamed = new Map([['alpha', 'alpha'], ['beta', 'newbeta'], ['newbeta', 'newbeta'], ['legacybeta', 'newbeta']])
  assert.doesNotThrow(() => assertBrandIconCompatibility(baseline, id => renamed.get(id)))
  renamed.set('legacybeta', 'alpha')
  assert.throws(() => assertBrandIconCompatibility(baseline, id => renamed.get(id)), /legacybeta/)
})

test('the working baseline must retain historical IDs and original alias relationships', () => {
  const previous = { ids: ['alpha', 'beta'], aliases: { legacybeta: 'beta' } }
  assert.throws(() => assertBaselineRetained(previous, { ...previous, ids: ['alpha'] }), /beta/)
  assert.throws(() => assertBaselineRetained(previous, { ...previous, aliases: {} }), /legacybeta/)
  assert.throws(() => assertBaselineRetained(previous, { ...previous, aliases: { legacybeta: 'alpha' } }), /legacybeta/)
  assert.doesNotThrow(() => assertBaselineRetained(previous, { ...previous, ids: [...previous.ids, 'gamma'] }))
})

test('comparison reads Git rather than a modified working fixture and rejects invalid refs', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'ai-gate-icon-baseline-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim()
  git('init', '--quiet')
  git('-c', 'user.name=Icon Test', '-c', 'user.email=icons@example.invalid', 'commit', '--allow-empty', '-m', 'initial')
  const initial = git('rev-parse', 'HEAD')
  const directory = path.join(root, 'apps/web/tests/fixtures')
  await mkdir(directory, { recursive: true })
  const fixture = path.join(directory, 'brand-icon-ids.json')
  const committed = { ids: ['alpha', 'beta'], aliases: { legacybeta: 'beta' } }
  await writeFile(fixture, JSON.stringify(committed))
  git('add', '.')
  git('-c', 'user.name=Icon Test', '-c', 'user.email=icons@example.invalid', 'commit', '-m', 'baseline')
  await writeFile(fixture, JSON.stringify({ ids: ['alpha'], aliases: {} }))
  assert.deepEqual(readCommittedBaseline('HEAD', root), committed)
  assert.deepEqual(readCommittedBaseline('HEAD', directory), committed)
  assert.equal(readCommittedBaseline(initial, root), undefined)
  assert.throws(() => readCommittedBaseline('missing-icon-baseline', root))
})
