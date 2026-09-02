/**
 * 供应商配置持久化：JSON 文件存储（server/data/providers.json）
 * 读写均为全量列表；写入使用临时文件 + rename 保证原子性
 */
import {mkdir, readFile, rename, writeFile} from 'node:fs/promises'
import path from 'node:path'
import type {ProviderConfig} from '../../shared/providers'

const DATA_DIR = process.env.AI_GATE_DATA_DIR ?? path.resolve(process.cwd(), 'server', 'data')
const DATA_FILE = path.join(DATA_DIR, 'providers.json')

let cache: ProviderConfig[] | null = null

/** 读取兜底：字段缺失时补默认值，避免旧数据结构导致运行时崩溃 */
function normalizeProvider(p: Partial<ProviderConfig>): ProviderConfig {
  return {
    ...p,
    enabled: p.enabled !== false,
    remark: p.remark ?? '',
    icon: p.icon ?? '',
    protocols: p.protocols ?? [],
    endpoints: p.endpoints ?? {},
    modelsEndpoint: p.modelsEndpoint ?? '',
    keys: p.keys ?? [],
    models: p.models ?? {}
  } as ProviderConfig
}

/** 加载全部供应商配置（进程内缓存） */
export async function loadProviders(): Promise<ProviderConfig[]> {
  if (cache) return cache
  try {
    const raw = await readFile(DATA_FILE, 'utf-8')
    const json = JSON.parse(raw) as {providers?: Partial<ProviderConfig>[]}
    cache = (json.providers ?? []).map(normalizeProvider)
  } catch {
    // 文件不存在或损坏时视为空配置
    cache = []
  }
  return cache
}

/** 全量保存供应商配置（原子写入） */
export async function saveProviders(list: ProviderConfig[]): Promise<void> {
  cache = list
  await mkdir(DATA_DIR, {recursive: true})
  const tmp = `${DATA_FILE}.tmp`
  await writeFile(tmp, `${JSON.stringify({version: 2, providers: list}, null, 2)}\n`, 'utf-8')
  await rename(tmp, DATA_FILE)
}
