import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

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
  kind: text('kind').notNull(),
  type: text('type'),
  path: text('path').notNull(),
  is_default: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  sort: integer('sort').notNull().default(0),
  ...timestamps(),
})

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

export type Provider = typeof sProvider.$inferSelect
export type NewProvider = typeof sProvider.$inferInsert
export type Endpoint = typeof sEndpoint.$inferSelect
export type NewEndpoint = typeof sEndpoint.$inferInsert
export type ApiKey = typeof sKey.$inferSelect
export type NewApiKey = typeof sKey.$inferInsert
export type Model = typeof sModel.$inferSelect
export type NewModel = typeof sModel.$inferInsert
export type Relat = typeof sRelat.$inferSelect
export type NewRelat = typeof sRelat.$inferInsert
