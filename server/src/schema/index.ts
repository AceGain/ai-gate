import {sql} from 'drizzle-orm'
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
  uniqueIndex
} from 'drizzle-orm/sqlite-core'
import type {SysModelReasoning, SysModelStatus, SysModelType} from '../../../shared/sys-model'
import type {SysKeyStatus} from '../../../shared/sys-key'
import type {SysEndpointType} from '../../../shared/sys-endpoint'

/** 供应商表 */
export const sysProvider = sqliteTable('sys_provider', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  icon: text('icon').notNull().default(''),
  enabled: integer('enabled', {mode: 'boolean'}).notNull().default(false),
  description: text('description').notNull().default(''),
  sort: integer('sort').notNull().default(0),
  createTime: text('create_time').notNull().default(sql`CURRENT_TIMESTAMP`),
  updateTime: text('update_time').notNull().default(sql`CURRENT_TIMESTAMP`)
})

/** 供应商端点表 */
export const sysEndpoint = sqliteTable('sys_endpoint', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull().references(() => sysProvider.id, {onDelete: 'cascade'}),
  type: text('type').$type<SysEndpointType>().notNull(),
  protocol: text('protocol').notNull().default(''),
  path: text('path').notNull(),
  isDefault: integer('is_default', {mode: 'boolean'}).notNull().default(false),
  createTime: text('create_time').notNull().default(sql`CURRENT_TIMESTAMP`),
  updateTime: text('update_time').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (t) => [
  index('idx_endpoint_provider').on(t.providerId),
  uniqueIndex('idx_endpoint_provider_type_protocol').on(t.providerId, t.type, t.protocol)
])

/** 供应商密钥表 */
export const sysKey = sqliteTable('sys_key', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull().references(() => sysProvider.id, {onDelete: 'cascade'}),
  name: text('name').notNull(),
  secret: text('secret').notNull(),
  enabled: integer('enabled', {mode: 'boolean'}).notNull().default(false),
  status: text('status').$type<SysKeyStatus>().notNull().default('ACTIVE'),
  expiresTime: text('expires_time'),
  sort: integer('sort').notNull().default(0),
  description: text('description').notNull().default(''),
  createTime: text('create_time').notNull().default(sql`CURRENT_TIMESTAMP`),
  updateTime: text('update_time').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (t) => [
  index('idx_key_provider').on(t.providerId, t.sort)
])

/** 供应商模型表 */
export const sysModel = sqliteTable('sys_model', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull().references(() => sysProvider.id, {onDelete: 'cascade'}),
  code: text('code').notNull(),
  name: text('name').notNull().default(''),
  category: text('category').notNull().default(''),
  enabled: integer('enabled', {mode: 'boolean'}).notNull().default(false),
  status: text('status').$type<SysModelStatus>().notNull().default('ACTIVE'),
  type: text('type').$type<SysModelType>().notNull(),
  inputModal: text('input_modal', {mode: 'json'}).$type<string[]>().notNull().default(sql`('["text"]')`),
  outputModal: text('output_modal', {mode: 'json'}).$type<string[]>().notNull().default(sql`('["text"]')`),
  protocols: text('protocols', {mode: 'json'}).$type<string[]>().notNull().default(sql`('[]')`),
  maxContext: integer('max_context').notNull().default(0),
  maxInput: integer('max_input').notNull().default(0),
  maxOutput: integer('max_output').notNull().default(0),
  reasoning: text('reasoning').$type<SysModelReasoning>().notNull().default('TOGGLE'),
  effortLevel: text('effort_level', {mode: 'json'}).$type<string[]>().notNull().default(sql`('[]')`),
  sort: integer('sort').notNull().default(0),
  description: text('description').notNull().default(''),
  createTime: text('create_time').notNull().default(sql`CURRENT_TIMESTAMP`),
  updateTime: text('update_time').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (t) => [
  unique().on(t.providerId, t.code),
  index('idx_model_provider').on(t.providerId, t.sort)
])

/** 供应商-密钥-模型速查关联表 */
export const sysKeyModel = sqliteTable('sys_key_model', {
  providerId: text('provider_id').notNull().references(() => sysProvider.id, {onDelete: 'cascade'}),
  keyId: text('key_id').notNull().references(() => sysKey.id, {onDelete: 'cascade'}),
  modelId: text('model_id').notNull().references(() => sysModel.id, {onDelete: 'cascade'})
}, (t) => [
  primaryKey({columns: [t.providerId, t.keyId, t.modelId]}),
  index('idx_key_model_key').on(t.keyId),
  index('idx_key_model_model').on(t.modelId)
])
