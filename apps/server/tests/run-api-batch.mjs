import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const [source, app] = process.argv.slice(2)
if (!source || !app) throw new Error('Usage: node tests/run-api-batch.mjs <cases.jsonl> <app.mjs>')

// Hono CLI 的退出码不表示断言是否通过，测试命令必须读取 summary.failed。
const result = spawnSync(process.execPath, [
  '--import', 'tsx',
  fileURLToPath(new URL('../node_modules/@hono/cli/dist/cli.js', import.meta.url)),
  'batch', source, app, '--compact',
], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
})
if (result.error) throw result.error
process.stdout.write(result.stdout)
if (result.status !== 0) {
  process.exitCode = result.status ?? 1
} else {
  const report = JSON.parse(result.stdout)
  if (!report.ok || report.data?.summary?.failed !== 0) process.exitCode = 1
}
