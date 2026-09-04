/**
 * 供应商配置持久化：JSON 文件存储（server/data/providers.json）
 * 读写均为全量列表；写入使用临时文件 + rename 保证原子性
 */
import {mkdir, readFile, rename, writeFile} from 'node:fs/promises'
import path from 'node:path'
import type {KeySelectionStrategy, ProviderConfig, ProviderKeyConfig, ProviderProtocolConfig, ProviderProtocolId} from '../../shared/providers'

const DATA_DIR = process.env.AI_GATE_DATA_DIR ?? path.resolve(process.cwd(), 'server', 'data')
const DATA_FILE = path.join(DATA_DIR, 'providers.json')

let cache: ProviderConfig[] | null = null

/** 旧协议 id 迁移：openai → openai-chat、anthropic → anthropic-messages、gemini 移除 */
function migrateProtocol(id: string): ProviderProtocolId | null {
  if (id === 'openai') return 'openai-chat'
  if (id === 'anthropic') return 'anthropic-messages'
  if (id === 'gemini') return null
  return id as ProviderProtocolId
}

/** 协议列表迁移（去重、丢弃无效项） */
function migrateProtocolList(list: string[] | undefined): ProviderProtocolId[] {
  const mapped = (list ?? [])
    .map(id => migrateProtocol(String(id)))
    .filter((id): id is ProviderProtocolId => id !== null)
  return [...new Set(mapped)]
}

const KEY_STRATEGIES: KeySelectionStrategy[] = ['failover', 'round-robin', 'random']

/** 读取兜底：字段缺失时补默认值，避免旧数据结构导致运行时崩溃 */
function normalizeProvider(p: Partial<ProviderConfig>): ProviderConfig {
  const endpoints: Partial<Record<ProviderProtocolId, ProviderProtocolConfig>> = {}
  for (const [key, cfg] of Object.entries(p.endpoints ?? {})) {
    const proto = migrateProtocol(key)
    if (proto && cfg) endpoints[proto] = {chatEndpoint: cfg.chatEndpoint}
  }
  const models = Object.fromEntries(
    Object.entries(p.models ?? {}).map(([id, m]) => [
      id,
      {...m, protocols: migrateProtocolList(m?.protocols), allowedKeyIds: m?.allowedKeyIds ?? []}
    ])
  )
  const protocols = migrateProtocolList(p.protocols)
  // 默认协议归一化：缺失或不在协议列表时回退到首个协议
  const defaultProtocol = protocols.includes(p.defaultProtocol as ProviderProtocolId)
    ? p.defaultProtocol as ProviderProtocolId
    : protocols[0] ?? null
  return {
    ...p,
    enabled: p.enabled !== false,
    remark: p.remark ?? '',
    icon: p.icon ?? '',
    protocols,
    defaultProtocol,
    endpoints,
    modelsEndpoint: p.modelsEndpoint ?? '',
    keyStrategy: KEY_STRATEGIES.includes(p.keyStrategy as KeySelectionStrategy)
      ? p.keyStrategy as KeySelectionStrategy
      : 'failover',
    // 密钥仅保留凭证字段（剥离历史遗留的模型字段）
    keys: (p.keys ?? []).map(k => ({
      id: k.id,
      name: k.name ?? '',
      value: k.value ?? '',
      expiresAt: k.expiresAt ?? '',
      enabled: k.enabled !== false
    })) satisfies ProviderKeyConfig[],
    models
  } as ProviderConfig
}

/** 加载全部供应商配置（进程内缓存） */
export async function loadProviders(): Promise<ProviderConfig[]> {
  if (cache) return cache
  try {
    const raw = await readFile(DATA_FILE, 'utf-8')
    const json = JSON.parse(raw) as { providers?: Partial<ProviderConfig>[] }
    cache = (json.providers ?? []).map(normalizeProvider)
  } catch {
    // 文件不存在或损坏时视为空配置
    cache = []
  }
  return cache
}

/** 全量保存供应商配置（原子写入；归一化兜底，保证缓存与落盘数据一致） */
export async function saveProviders(list: ProviderConfig[]): Promise<void> {
  cache = list.map(p => normalizeProvider(p))
  await mkdir(DATA_DIR, {recursive: true})
  const tmp = `${DATA_FILE}.tmp`
  await writeFile(tmp, `${JSON.stringify({version: 2, providers: cache}, null, 2)}\n`, 'utf-8')
  await rename(tmp, DATA_FILE)
}
