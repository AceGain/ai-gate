import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// 本文件是 sql/schema.sql 的 Drizzle 镜像，两者必须同步修改；
// 列的业务含义见 schema.sql 内的注释

// 与 SQLite CURRENT_TIMESTAMP 对齐的时间格式（UTC，秒级），
// 避免与 ISO 格式混存破坏 TEXT 列的字典序
const sqliteNow = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

// 时间戳由应用层生成：新增时 $defaultFn 填当前时间，
// 修改时 $onUpdate 刷新 update_time
const timestamps = () => ({
  create_time: text('create_time').notNull().$defaultFn(sqliteNow),
  update_time: text('update_time').notNull().$defaultFn(sqliteNow).$onUpdate(sqliteNow),
})

export const tProvider = sqliteTable('t_provider', {
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

export const tEndpoint = sqliteTable('t_endpoint', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  provider_id: integer('provider_id')
    .notNull()
    .references(() => tProvider.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  type: text('type'),
  path: text('path').notNull(),
  is_default: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  sort: integer('sort').notNull().default(0),
  ...timestamps(),
})

export const tModel = sqliteTable('t_model', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  provider_id: integer('provider_id')
    .notNull()
    .references(() => tProvider.id, { onDelete: 'cascade' }),
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

export type Provider = typeof tProvider.$inferSelect
export type NewProvider = typeof tProvider.$inferInsert
export type Endpoint = typeof tEndpoint.$inferSelect
export type NewEndpoint = typeof tEndpoint.$inferInsert
export type Model = typeof tModel.$inferSelect
export type NewModel = typeof tModel.$inferInsert
