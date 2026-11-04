import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

export interface BrandIconBaseline {
  ids: string[]
  aliases: Record<string, string>
}

const baselinePath = 'apps/web/tests/fixtures/brand-icon-ids.json'

/** 比较已提交的快照，防止修改工作区快照绕过兼容性检查。 */
export function readCommittedBaseline(baseRef = process.env.BRAND_ICONS_BASE_REF || 'HEAD', cwd = process.cwd()): BrandIconBaseline | undefined {
  const root = execFileSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
  const commit = git('rev-parse', '--verify', '--end-of-options', `${baseRef}^{commit}`)
  const file = git('ls-tree', '--name-only', commit, '--', baselinePath)
  // 首次引入快照时，兼容性由本次完整历史 ID 清单约束。
  if (!file) return undefined
  return JSON.parse(git('show', `${commit}:${baselinePath}`)) as BrandIconBaseline
}

export function assertBrandIconCompatibility(
  baseline: BrandIconBaseline,
  resolveId: (id: string) => string | undefined,
) {
  for (const id of baseline.ids) assert.ok(resolveId(id), `Saved brand ID no longer resolves: ${id}`)
  for (const [alias, target] of Object.entries(baseline.aliases)) {
    assert.ok(resolveId(target), `Historical alias target no longer resolves: ${target}`)
    assert.equal(resolveId(alias), resolveId(target), `Historical alias changed brand: ${alias}`)
  }
}

export function assertBaselineRetained(previous: BrandIconBaseline, current: BrandIconBaseline) {
  const ids = new Set(current.ids)
  for (const id of previous.ids) assert.ok(ids.has(id), `Historical ID removed from baseline: ${id}`)
  for (const [alias, target] of Object.entries(previous.aliases)) {
    assert.equal(current.aliases[alias], target, `Historical alias removed or redirected in baseline: ${alias}`)
  }
}
