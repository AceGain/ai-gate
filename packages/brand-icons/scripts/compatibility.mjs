import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const safeId = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/

/** Read the comparison inputs from a resolved Git commit, never from generated working files. */
export function readCompatibilityBaseline(packageRoot, baseRef) {
  const git = (cwd, args) => execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 8 * 1024 * 1024,
  }).trim()
  let repositoryRoot
  let commit
  try {
    repositoryRoot = git(packageRoot, ['rev-parse', '--show-toplevel'])
    commit = git(repositoryRoot, ['rev-parse', '--verify', '--end-of-options', `${baseRef}^{commit}`])
  } catch {
    throw new Error(`Cannot read compatibility base ${JSON.stringify(baseRef)}; fetch its Git history before checking brand icons`)
  }
  const prefix = path.relative(repositoryRoot, packageRoot).split(path.sep).join('/')
  assert.ok(prefix && !prefix.startsWith('../') && !path.isAbsolute(prefix), 'Brand icons package must be inside the Git repository')
  const catalogPath = `${prefix}/src/generated/catalog.json`
  const aliasesPath = `${prefix}/metadata/aliases.json`
  const present = new Set(git(repositoryRoot, [
    'ls-tree', '-r', '--name-only', commit, '--', catalogPath, aliasesPath,
  ]).split('\n').filter(Boolean))
  if (!present.size) {
    // A real commit without the package is the only valid bootstrap case.
    const packageExists = git(repositoryRoot, ['ls-tree', '--name-only', commit, '--', prefix])
    assert.equal(packageExists, '', `Compatibility baseline ${baseRef} contains the package but is missing its catalog and aliases`)
    return { brands: [], aliases: {}, commit }
  }
  assert.ok(present.has(catalogPath) && present.has(aliasesPath), `Compatibility baseline ${baseRef} must contain both catalog and aliases`)
  let brands
  let aliases
  try {
    brands = JSON.parse(git(repositoryRoot, ['show', `${commit}:${catalogPath}`]))
    aliases = JSON.parse(git(repositoryRoot, ['show', `${commit}:${aliasesPath}`]))
  } catch {
    throw new Error(`Compatibility baseline ${baseRef} contains unreadable catalog or aliases JSON`)
  }
  assert.ok(Array.isArray(brands) && brands.length, `Compatibility baseline ${baseRef} has an invalid catalog`)
  const ids = new Set()
  for (const brand of brands) {
    assert.ok(brand && typeof brand.id === 'string' && safeId.test(brand.id) && !ids.has(brand.id), `Compatibility baseline ${baseRef} has an invalid or duplicate brand ID`)
    ids.add(brand.id)
  }
  assert.ok(aliases && typeof aliases === 'object' && !Array.isArray(aliases), `Compatibility baseline ${baseRef} has invalid aliases`)
  for (const [alias, target] of Object.entries(aliases)) {
    assert.ok(safeId.test(alias) && typeof target === 'string' && ids.has(target) && !ids.has(alias), `Compatibility baseline ${baseRef} has an invalid alias: ${alias}`)
  }
  return { brands, aliases, commit }
}

export function parseGenerationOptions(args, environment = process.env) {
  let check = false
  let baseRef = environment.BRAND_ICONS_BASE_REF || 'HEAD'
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]
    if (argument === '--') continue
    if (argument === '--check') check = true
    else if (argument === '--base-ref') {
      baseRef = args[++index]
      assert.ok(baseRef && !baseRef.startsWith('--'), '--base-ref requires a Git commit or ref')
    } else throw new Error(`Unknown argument: ${argument}. Usage: generate.mjs [--check] [--base-ref <commit>]`)
  }
  return { check, baseRef }
}
