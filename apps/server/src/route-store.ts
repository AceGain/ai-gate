import { and, asc, eq, sql } from 'drizzle-orm'
import type { RRoute, RRouteUpdateInput, RModelSource } from '@ai-gate/shared'
import { db } from './db/index.js'
import { rRoute, rModel, sModel, sProvider } from './db/schema.js'

export function toRoute(row: typeof rRoute.$inferSelect): RRoute {
  return {
    id: row.id, code: row.code, name: row.name, icon: row.icon ?? '',
    mode: row.mode as RRoute['mode'], host: row.host, port: row.port,
    prefixPath: row.prefix_path, modelsPath: row.models_path,
    enabled: row.enabled, status: row.status, strategy: row.strategy as 'PRIORITY',
    timeout: row.timeout, maxRetries: row.max_retries, remark: row.remark ?? '', sort: row.sort,
    createTime: row.create_time, updateTime: row.update_time,
  }
}

export function routeValues(input: RRouteUpdateInput) {
  return {
    name: input.name, icon: input.icon, mode: input.mode,
    host: input.mode === 'SHARED' ? null : input.host?.toLowerCase(),
    port: input.mode === 'SHARED' ? null : input.port,
    prefix_path: input.prefixPath, models_path: input.modelsPath,
    enabled: input.enabled, strategy: input.strategy, timeout: input.timeout,
    max_retries: input.maxRetries, remark: input.remark,
    ...(input.sort === undefined ? {} : {sort: input.sort}),
  }
}

export function listRoutes() {
  return db.select().from(rRoute).orderBy(asc(rRoute.sort), asc(rRoute.id)).all().map(toRoute)
}

export function getRoute(id: number) {
  const row = db.select().from(rRoute).where(eq(rRoute.id, id)).get()
  return row ? toRoute(row) : null
}

export function routeSources(): RModelSource[] {
  return db.select({id: sModel.id, code: sModel.code, name: sModel.name,
    providerName: sProvider.name, enabled: sql<boolean>`${sModel.enabled} AND ${sProvider.enabled}`.mapWith(Boolean),
  }).from(sModel).innerJoin(sProvider, eq(sModel.provider_id, sProvider.id))
    .orderBy(asc(sProvider.sort), asc(sModel.sort), asc(sModel.id)).all()
    .map(row => ({...row, name: row.name ?? ''}))
}

export function sourceExists(id: number) {
  return !!db.select({id: sModel.id}).from(sModel).where(eq(sModel.id, id)).get()
}

export class RouteSourceInUseError extends Error {
  constructor() { super('ROUTE_SOURCE_IN_USE') }
}
export function modelHasRouteReferences(id: number) {
  return !!db.select({id: rModel.id}).from(rModel)
    .where(and(eq(rModel.source_type, 'S_MODEL'), eq(rModel.model_id, id))).get()
}
export function providerHasRouteReferences(id: number) {
  return !!db.select({id: rModel.id}).from(rModel)
    .innerJoin(sModel, and(eq(rModel.source_type, 'S_MODEL'), eq(rModel.model_id, sModel.id)))
    .where(eq(sModel.provider_id, id)).get()
}
