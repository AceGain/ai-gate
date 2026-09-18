/**
 * 生成 app/utils/brandIcons.ts：收录 @lobehub/icons-static-png 包内全部图标
 * - 数据源：node_modules/@lobehub/icons/es/toc.json（品牌名/分组）+ static-png 的 light/dark 目录扫描
 * - 有彩色变体（{id}-color.png）的品牌只引 light 份（light/dark 文件内容一致，已验证）
 * - 仅有单色的品牌同时引 light/dark 两份，由 brandIconUrl(icon, isDark) 按颜色模式取用
 * - 升级 @lobehub/icons-static-png 或 @lobehub/icons 后重跑：pnpm generate:brand-icons
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pngDir = path.join(root, 'node_modules', '@lobehub', 'icons-static-png')
const tocPath = path.join(root, 'node_modules', '@lobehub', 'icons', 'es', 'toc.json')
const outPath = path.join(root, 'app', 'utils', 'brandIcons.ts')

const toc = JSON.parse(fs.readFileSync(tocPath, 'utf8'))
const lightFiles = fs.readdirSync(path.join(pngDir, 'light')).filter(f => f.endsWith('.png'))
const darkFiles = new Set(fs.readdirSync(path.join(pngDir, 'dark')).filter(f => f.endsWith('.png')))

const VARIANT_RE = /-(text|text-cn|brand|brand-color)$/
const baseIds = new Set()
const colorIds = new Set()
for (const f of lightFiles) {
  const id = f.replace(/\.png$/, '')
  if (VARIANT_RE.test(id)) continue // 排除文字/品牌组合变体，只保留 logo 本体
  if (id.endsWith('-color')) colorIds.add(id.slice(0, -6))
  else baseIds.add(id)
}

/** toc 品牌 id（PascalCase）转小写后与文件名对齐 */
const labelById = new Map()
for (const item of toc) {
  const id = String(item.id).toLowerCase()
  if (baseIds.has(id) && !labelById.has(id)) labelById.set(id, item.fullTitle || item.title || id)
}

const prettify = id => id.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

const ids = [...baseIds].sort()
const entries = []
const imports = []
for (const id of ids) {
  const label = labelById.get(id) ?? prettify(id)
  if (colorIds.has(id)) {
    const varName = id.replace(/[-_](\w)/g, (_, c) => c.toUpperCase())
    imports.push(`import ${varName} from '@lobehub/icons-static-png/light/${id}-color.png'`)
    entries.push(`  ${JSON.stringify(id)}: {label: ${JSON.stringify(label)}, color: ${varName}}`)
  } else {
    const varName = id.replace(/[-_](\w)/g, (_, c) => c.toUpperCase())
    const hasDark = darkFiles.has(`${id}.png`)
    imports.push(`import ${varName}Light from '@lobehub/icons-static-png/light/${id}.png'`)
    if (hasDark) imports.push(`import ${varName}Dark from '@lobehub/icons-static-png/dark/${id}.png'`)
    entries.push(
      `  ${JSON.stringify(id)}: {label: ${JSON.stringify(label)}, light: ${varName}Light${hasDark ? `, dark: ${varName}Dark` : ''}}`
    )
  }
}

const content = `/**\n * 品牌图标：@lobehub/icons 静态 PNG 资源（本文件由 scripts/generate-brand-icons.mjs 生成，勿手改）\n * 收录包内全部图标（${ids.length} 个）；有彩色变体的用 -color.png（light/dark 内容一致只引一份），\n * 仅单色的引 light/dark 两份由 brandIconUrl(icon, isDark) 按颜色模式取用\n */\n${imports.join('\n')}\n\n/** 品牌 id → 图标资源与显示名 */\ninterface BrandIconEntry {\n  label: string\n  color?: string\n  light?: string\n  dark?: string\n}\n\nconst brandIcons: Record<string, BrandIconEntry> = {\n${entries.join(',\n')}\n}\n\n/** 旧版本地品牌 key（public/brands/*.svg 文件名）→ @lobehub/icons 品牌 id 兼容映射 */\nexport const legacyBrandIconKeys: Record<string, string> = {\n  googlegemini: 'gemini',\n  moonshotai: 'moonshot',\n  mistralai: 'mistral'\n}\n\n/** 可选的供应商显示图标选项 */\nexport interface ProviderIconOption {\n  /** 品牌 id；空串表示自动（首字母 fallback） */\n  value: string\n  /** 品牌名（tooltip/无障碍）；自动项为空由组件用 i18n */\n  label: string\n}\n\n/** 全部品牌图标选项（不含“自动”项），按品牌名排序 */\nexport const providerIconOptions: ProviderIconOption[] = [\n${ids
  .map(id => `  {value: ${JSON.stringify(id)}, label: ${JSON.stringify(labelById.get(id) ?? prettify(id))}}`)
  .sort((a, b) => a.localeCompare(b))
  .join(',\n')}\n]\n\n/** 默认图标：空串 = 自动（首字母 fallback） */\nexport const defaultProviderIcon = ''\n\n/** 是否为自定义上传图标（data URL 或 http 链接，直接作为图片地址） */\nexport function isCustomIcon(icon: string): boolean {\n  return icon.startsWith('data:') || icon.startsWith('http://') || icon.startsWith('https://')\n}\n\n/** 解析图标 URL：自定义图片原样返回；品牌 id（含旧 key 兼容）映射到 lobehub PNG；未知返回空串。无彩色的品牌按 isDark 取亮/暗单色变体 */\nexport function brandIconUrl(icon: string, isDark = false): string {\n  if (!icon) return ''\n  if (isCustomIcon(icon)) return icon\n  const id = legacyBrandIconKeys[icon] ?? icon\n  const entry = brandIcons[id]\n  if (!entry) return ''\n  return entry.color ?? (isDark ? entry.dark : entry.light) ?? ''\n}\n`

fs.writeFileSync(outPath, content, 'utf8')
console.log(`Generated ${outPath}: ${ids.length} icons (${colorIds.size} color + ${ids.length - colorIds.size} mono), ${imports.length} imports`)
