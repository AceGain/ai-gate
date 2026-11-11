import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer, index, uniqueIndex, check } from 'drizzle-orm/sqlite-core'

// 出站域（S 域）：s_ 前缀 = 出站（对接的上游供应商），与模板域（hub 的 t_）、
// 入站域（r_，对外路由代理）职责与领域不同，即使结构暂时相同也不得互相简化合并
// 本文件是 sql/schema.sql 的 Drizzle 镜像，两者必须同步修改；
// 列的业务含义见 schema.sql 内的注释

// 与 SQLite CURRENT_TIMESTAMP 对齐的时间格式（UTC，秒级），
// 避免与 ISO 格式混存破坏 TEXT 列的字典序
const sqliteNow = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

// server 的 DDL 没有 DEFAULT CURRENT_TIMESTAMP，时间戳由应用层生成：
// 新增时 $defaultFn 填当前时间，修改时 $onUpdate 刷新 update_time
const timestamps = () => ({
  create_time: text('create_time').notNull().$defaultFn(sqliteNow),
  update_time: text('update_time').notNull().$defaultFn(sqliteNow).$onUpdate(sqliteNow),
})

export const sProvider = sqliteTable('s_provider', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  icon: text('icon'),
  base_url: text('base_url').notNull(),
  models_path: text('models_path').notNull().default('/v1/models'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('ACTIVE'),
  remark: text('remark'),
  sort: integer('sort').notNull().default(0),
  ...timestamps(),
})

export const sEndpoint = sqliteTable('s_endpoint', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  provider_id: integer('provider_id')
    .notNull()
    .references(() => sProvider.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  path: text('path').notNull(),
  is_default: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  sort: integer('sort').notNull().default(0),
  ...timestamps(),
}, table => [
  index('s_endpoint_idx_type').on(table.type),
  uniqueIndex('s_endpoint_uq_provider_type').on(table.provider_id, table.type),
])

export const sKey = sqliteTable('s_key', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  provider_id: integer('provider_id')
    .notNull()
    .references(() => sProvider.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  secret: text('secret').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('ACTIVE'),
  expire_time: text('expire_time'),
  remark: text('remark'),
  sort: integer('sort').notNull().default(0),
  ...timestamps(),
})

export const sModel = sqliteTable('s_model', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  provider_id: integer('provider_id')
    .notNull()
    .references(() => sProvider.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name'),
  category: text('category').default('Default'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('ACTIVE'),
  type: text('type').notNull(),
  gen_type: text('gen_type', { mode: 'json' }).$type<string[]>().notNull(),
  config: text('config', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  remark: text('remark'),
  sort: integer('sort').notNull().default(0),
  ...timestamps(),
})

// 关系速查表：列按设计为 TEXT 且无外键，不随主表级联删除，
// 清理时机由应用层决定
export const sRelat = sqliteTable('s_relat', {
  provider_id: text('provider_id').notNull(),
  key_id: text('key_id').notNull(),
  model_id: text('model_id').notNull(),
})

export const rRoute = sqliteTable('r_route', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  icon: text('icon'),
  mode: text('mode').notNull().default('SHARED'),
  host: text('host'),
  port: integer('port'),
  prefix_path: text('prefix_path').notNull().default('/v1'),
  models_path: text('models_path').notNull().default('/models'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('ACTIVE'),
  strategy: text('strategy').notNull().default('PRIORITY'),
  timeout: integer('timeout').notNull().default(60000),
  max_retries: integer('max_retries').notNull().default(0),
  sort: integer('sort').notNull().default(0),
  remark: text('remark'),
  ...timestamps(),
}, table => [
  index('r_route_idx_code').on(table.code),
  index('r_route_idx_enabled').on(table.enabled),
  index('r_route_idx_status').on(table.status),
  uniqueIndex('r_route_uq_dedicated_host_port')
    .on(table.host, table.port)
    .where(sql`${table.mode} = 'DEDICATED'`),
  uniqueIndex('r_route_uq_shared_prefix_path')
    .on(table.prefix_path)
    .where(sql`${table.mode} = 'SHARED'`),
])

export const rEndpoint = sqliteTable('r_endpoint', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  route_id: integer('route_id')
    .notNull()
    .references(() => rRoute.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  path: text('path').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  sort: integer('sort').notNull().default(0),
  ...timestamps(),
}, table => [
  uniqueIndex('r_endpoint_uq_route_type').on(table.route_id, table.type),
  uniqueIndex('r_endpoint_uq_route_path').on(table.route_id, table.path),
])

export const rKey = sqliteTable('r_key', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  route_id: integer('route_id')
    .notNull()
    .references(() => rRoute.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  secret: text('secret').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('ACTIVE'),
  expire_time: text('expire_time'),
  remark: text('remark'),
  sort: integer('sort').notNull().default(0),
  ...timestamps(),
}, table => [
  index('r_key_idx_enabled').on(table.enabled),
  index('r_key_idx_status').on(table.status),
])

export const rModel = sqliteTable('r_model', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  route_id: integer('route_id')
    .notNull()
    .references(() => rRoute.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name'),
  category: text('category').default('Default'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('ACTIVE'),
  type: text('type').notNull(),
  gen_type: text('gen_type', { mode: 'json' }).$type<string[]>().notNull(),
  config: text('config', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  remark: text('remark'),
  sort: integer('sort').notNull().default(0),
  ...timestamps(),
}, table => [
  uniqueIndex('r_model_uq_route_code').on(table.route_id, table.code),
  index('r_model_idx_enabled').on(table.enabled),
  index('r_model_idx_status').on(table.status),
  index('r_model_idx_type').on(table.type),
  check('r_model_gen_type_json', sql`json_valid(${table.gen_type})`),
  check('r_model_config_json', sql`json_valid(${table.config})`),
])

export type SProvider = typeof sProvider.$inferSelect
export type NewSProvider = typeof sProvider.$inferInsert
export type SEndpoint = typeof sEndpoint.$inferSelect
export type NewSEndpoint = typeof sEndpoint.$inferInsert
export type SKey = typeof sKey.$inferSelect
export type NewSKey = typeof sKey.$inferInsert
export type SModel = typeof sModel.$inferSelect
export type NewSModel = typeof sModel.$inferInsert
export type SRelat = typeof sRelat.$inferSelect
export type NewSRelat = typeof sRelat.$inferInsert
export type RRoute = typeof rRoute.$inferSelect
export type NewRRoute = typeof rRoute.$inferInsert
export type REndpoint = typeof rEndpoint.$inferSelect
export type NewREndpoint = typeof rEndpoint.$inferInsert
export type RKey = typeof rKey.$inferSelect
export type NewRKey = typeof rKey.$inferInsert
export type RModel = typeof rModel.$inferSelect
export type NewRModel = typeof rModel.$inferInsert
