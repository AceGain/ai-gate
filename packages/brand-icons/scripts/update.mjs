/**
 * 显式更新品牌元数据快照。生成、检查和应用构建均不调用本脚本。
 * 只读取固定版本对应的 Git 提交中的 JSON 和许可证，不执行上游代码。
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const metadataPath = path.join(root, 'metadata', 'brands.json')
const upstreamPath = path.join(root, 'upstream.json')
const metadataPackage = '@lobehub/icons'
const assetsPackage = '@lobehub/icons-static-png'
const exactVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/
const validId = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/
const groups = new Set(['model', 'provider', 'application'])
const sha256 = value => createHash('sha256').update(value).digest('hex')
const json = value => `${JSON.stringify(value, null, 2)}\n`

async function readJsonIfPresent(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return undefined
    throw error
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'ai-gate-brand-icons-updater' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`读取 ${url} 失败：HTTP ${response.status}`)
  return response.text()
}

function options(args) {
  const result = { allowRemovals: false }
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]
    if (argument === '--') continue
    if (argument === '--allow-removals') result.allowRemovals = true
    else if (argument === '--metadata-version') {
      result.version = args[++index]
      if (!result.version || !exactVersion.test(result.version)) {
        throw new Error('--metadata-version 必须指定精确版本，例如 6.14.0')
      }
    } else throw new Error(`未知参数：${argument}`)
  }
  return result
}

function normalizeBrands(toc) {
  if (!Array.isArray(toc) || toc.length === 0) throw new Error('上游目录必须为非空数组')
  const seen = new Set()
  return toc.map(item => {
    if (!item || typeof item.id !== 'string') throw new Error('品牌缺少字符串 id')
    const id = item.id.toLowerCase()
    const label = item.fullTitle || item.title
    if (!validId.test(id)) throw new Error(`无效品牌 id：${item.id}`)
    if (seen.has(id)) throw new Error(`重复品牌 id：${id}`)
    if (typeof label !== 'string' || !label.trim()) throw new Error(`${id} 缺少品牌名称`)
    if (!groups.has(item.group)) throw new Error(`${id} 的品牌分类无效：${item.group}`)
    if (typeof item.color !== 'string') throw new Error(`${id} 缺少品牌颜色字符串`)
    seen.add(id)
    return { id, label, group: item.group, color: item.color }
  }).sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
}

async function main() {
  const args = options(process.argv.slice(2))
  const [manifest, previousUpstream, previousBrands] = await Promise.all([
    readJsonIfPresent(path.join(root, 'package.json')),
    readJsonIfPresent(upstreamPath),
    readJsonIfPresent(metadataPath),
  ])
  const version = args.version ?? previousUpstream?.metadata?.version
  if (!version || !exactVersion.test(version)) {
    throw new Error('请使用 --metadata-version 指定精确的上游元数据版本')
  }
  const assetsVersion = manifest?.dependencies?.[assetsPackage]
  if (!assetsVersion || !exactVersion.test(assetsVersion)) {
    throw new Error(`package.json 必须将 ${assetsPackage} 声明为精确版本`)
  }
  if (previousBrands !== undefined && !Array.isArray(previousBrands)) {
    throw new Error('现有 metadata/brands.json 必须为数组')
  }

  const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(metadataPackage)}/${encodeURIComponent(version)}`
  const release = JSON.parse(await fetchText(registryUrl))
  if (release.name !== metadataPackage || release.version !== version) {
    throw new Error('npm 返回的包名或版本与请求不一致')
  }
  if (release.license !== 'MIT' || !/^[0-9a-f]{40}$/i.test(release.gitHead ?? '')) {
    throw new Error('上游发行信息缺少预期的 MIT 许可或固定 Git 提交')
  }

  const commit = release.gitHead.toLowerCase()
  const baseUrl = `https://raw.githubusercontent.com/lobehub/lobe-icons/${commit}/`
  const url = `${baseUrl}src/toc.json`
  const [source, license] = await Promise.all([
    fetchText(url),
    fetchText(`${baseUrl}LICENSE`),
  ])
  if (!license.includes('MIT License') || !license.includes('LobeHub')) {
    throw new Error('上游许可证内容与预期不一致')
  }
  const brands = normalizeBrands(JSON.parse(source))
  const newIds = new Set(brands.map(brand => brand.id))
  const previousIds = new Set((previousBrands ?? []).map(brand => {
    if (!brand || typeof brand.id !== 'string' || !validId.test(brand.id)) {
      throw new Error('现有品牌元数据含无效 id')
    }
    return brand.id
  }))
  const removed = [...previousIds].filter(id => !newIds.has(id)).sort()
  if (removed.length && !args.allowRemovals) {
    throw new Error(`上游移除了品牌：${removed.join(', ')}。确认兼容处理后使用 --allow-removals 更新。`)
  }

  const snapshot = json(brands)
  const upstream = {
    assets: { package: assetsPackage, version: assetsVersion },
    metadata: {
      package: metadataPackage,
      version,
      commit,
      url,
      sourceSha256: sha256(source),
      snapshotSha256: sha256(snapshot),
    },
    license: 'MIT',
  }

  // 网络读取、内容校验和移除检查全部通过后才改写仓库文件。
  await mkdir(path.dirname(metadataPath), { recursive: true })
  await writeFile(metadataPath, snapshot, 'utf8')
  await writeFile(upstreamPath, json(upstream), 'utf8')
  await writeFile(path.join(root, 'LICENSE.lobehub'), license, 'utf8')
  const added = [...newIds].filter(id => !previousIds.has(id))
  console.log(`Updated ${metadataPackage}@${version} (${commit}): ${brands.length} brands, +${added.length}/-${removed.length}`)
  console.log('运行 pnpm generate:brand-icons，再执行 pnpm check:brand-icons 和 pnpm build:web。')
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
