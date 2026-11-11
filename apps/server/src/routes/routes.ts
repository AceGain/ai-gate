/** 入站路由配置 API；保存配置不启动监听器或执行代理。 */
import { Hono } from 'hono'
import { and, asc, eq, sql } from 'drizzle-orm'
import * as v from 'valibot'
import {
  RRouteCreateSchema, RRouteUpdateSchema, RReorderSchema, REnabledSchema,
  REndpointInputSchema, RKeyInputSchema, RModelInputSchema, isEditableRouteModel,
} from '@ai-gate/shared'
import { db } from '../db/index.js'
import { rRoute, rEndpoint, rKey, rModel, sModel, sProvider } from '../db/schema.js'
import { getRoute, listRoutes, routeSources, routeValues, sourceExists, toRoute } from '../route-store.js'
import { isUniqueViolation, parseBody, parseId } from './providers.js'

export const routes = new Hono()

class RouteConfigError extends Error {
  constructor(public code: string, public status: 400 | 404 | 409) { super(code) }
}

function conflict(error: unknown): string | null {
  if (!isUniqueViolation(error)) return null
  const message = error instanceof Error ? error.message : ''
  if (message.includes('r_route.code')) return 'DUPLICATE_ROUTE_CODE'
  if (message.includes('r_route.prefix_path')) return 'DUPLICATE_ROUTE_PREFIX'
  if (message.includes('r_route.host')) return 'DUPLICATE_ROUTE_LISTENER'
  if (message.includes('r_model.code')) return 'DUPLICATE_ROUTE_MODEL_CODE'
  return 'DUPLICATE_ROUTE_ENDPOINT'
}

routes.get('/routes', c => c.json(listRoutes()))
routes.get('/routes/model-sources', c => c.json(routeSources()))
routes.put('/routes/reorder', async c => {
  const {data, error} = parseBody(RReorderSchema, await c.req.json().catch(() => null))
  if (!data) return c.json({error: 'INVALID_REQUEST', detail: error}, 400)
  const valid = db.transaction(() => {
    if (data.some(item => !getRoute(item.id))) return false
    for (const item of data) db.update(rRoute).set({sort: item.sort}).where(eq(rRoute.id, item.id)).run()
    return true
  })
  return valid ? c.json({ok: true}) : c.json({error: 'ROUTE_NOT_FOUND'}, 404)
})
routes.post('/routes', async c => {
  const parsed = v.safeParse(RRouteCreateSchema, await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({error: 'INVALID_REQUEST'}, 400)
  const data = parsed.output
  try {
    const row = db.transaction(() => {
      const next = db.select({value: sql<number>`coalesce(max(${rRoute.sort}), -1) + 1`}).from(rRoute).get()!.value
      return db.insert(rRoute).values({...routeValues(data), code: data.code, sort: data.sort ?? next}).returning().get()!
    })
    return c.json(toRoute(row), 201)
  } catch (err) {
    const code = conflict(err)
    if (code) return c.json({error: code}, 409)
    throw err
  }
})
routes.get('/routes/:id', c => {
  const route = getRoute(parseId(c.req.param('id')) ?? 0)
  return route ? c.json(route) : c.json({error: 'ROUTE_NOT_FOUND'}, 404)
})
routes.put('/routes/:id', async c => {
  const id = parseId(c.req.param('id'))
  if (!id || !getRoute(id)) return c.json({error: 'ROUTE_NOT_FOUND'}, 404)
  const parsed = v.safeParse(RRouteUpdateSchema, await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({error: 'INVALID_REQUEST'}, 400)
  const data = parsed.output
  try {
    const route = db.transaction(() => {
      if (!getRoute(id)) throw new RouteConfigError('ROUTE_NOT_FOUND', 404)
      if (db.select({id: rEndpoint.id}).from(rEndpoint)
        .where(and(eq(rEndpoint.route_id, id), eq(rEndpoint.path, data.modelsPath))).get()) {
        throw new RouteConfigError('DUPLICATE_ROUTE_ENDPOINT', 409)
      }
      return toRoute(db.update(rRoute).set(routeValues(data)).where(eq(rRoute.id, id)).returning().get()!)
    })
    return c.json(route)
  } catch (err) {
    if (err instanceof RouteConfigError) return c.json({error: err.code}, err.status)
    const code = conflict(err)
    if (code) return c.json({error: code}, 409)
    throw err
  }
})
routes.patch('/routes/:id/enabled', async c => {
  const id = parseId(c.req.param('id'))
  const {data} = parseBody(REnabledSchema, await c.req.json().catch(() => null))
  if (!data) return c.json({error: 'INVALID_REQUEST'}, 400)
  const row = id ? db.update(rRoute).set(data).where(eq(rRoute.id, id)).returning().get() : null
  return row ? c.json(toRoute(row)) : c.json({error: 'ROUTE_NOT_FOUND'}, 404)
})
routes.delete('/routes/:id', c => {
  const id = parseId(c.req.param('id'))
  if (!id || !db.delete(rRoute).where(eq(rRoute.id, id)).run().changes) return c.json({error: 'ROUTE_NOT_FOUND'}, 404)
  return c.json({ok: true})
})

// 子资源始终按 route_id + id 定位，避免跨路由修改。
const resources = {
  endpoints: {table: rEndpoint, schema: REndpointInputSchema},
  keys: {table: rKey, schema: RKeyInputSchema},
  models: {table: rModel, schema: RModelInputSchema},
} as const
type Kind = keyof typeof resources

function listRecords(kind: Kind, routeId: number) {
  if (kind === 'endpoints') return db.select().from(rEndpoint).where(eq(rEndpoint.route_id, routeId))
    .orderBy(asc(rEndpoint.sort), asc(rEndpoint.id)).all().map(row => ({
      id: row.id, routeId, type: row.type, path: row.path, enabled: row.enabled, sort: row.sort,
      createTime: row.create_time, updateTime: row.update_time,
    }))
  if (kind === 'keys') return db.select().from(rKey).where(eq(rKey.route_id, routeId))
    .orderBy(asc(rKey.sort), asc(rKey.id)).all().map(row => ({
      id: row.id, routeId, name: row.name, secret: row.secret, enabled: row.enabled, status: row.status,
      expireTime: row.expire_time, remark: row.remark ?? '', sort: row.sort,
      createTime: row.create_time, updateTime: row.update_time,
    }))
  return db.select({row: rModel, sourceCode: sModel.code, sourceName: sModel.name, providerName: sProvider.name})
    .from(rModel).leftJoin(sModel, and(eq(rModel.source_type, 'S_MODEL'), eq(rModel.model_id, sModel.id)))
    .leftJoin(sProvider, eq(sModel.provider_id, sProvider.id)).where(eq(rModel.route_id, routeId))
    .orderBy(asc(rModel.sort), asc(rModel.id)).all().map(({row, ...source}) => ({
      id: row.id, routeId, sourceType: row.source_type, modelId: row.model_id, mode: row.mode,
      code: row.code, name: row.name ?? '', category: row.category ?? 'Default',
      type: row.type, generates: row.gen_type, config: row.config,
      enabled: row.enabled, status: row.status, sort: row.sort, remark: row.remark ?? '',
      createTime: row.create_time, updateTime: row.update_time, ...source,
    }))
}

for (const kind of Object.keys(resources) as Kind[]) {
  const {table, schema} = resources[kind]
  const base = `/routes/:routeId/${kind}`
  // 父记录不存在与空列表区分，所有子资源操作共用此检查。
  routes.use(base, async (c, next) => {
    if (!getRoute(parseId(c.req.param('routeId')!) ?? 0)) return c.json({error: 'ROUTE_NOT_FOUND'}, 404)
    await next()
  })
  routes.use(`${base}/*`, async (c, next) => {
    if (!getRoute(parseId(c.req.param('routeId')!) ?? 0)) return c.json({error: 'ROUTE_NOT_FOUND'}, 404)
    await next()
  })
  routes.get(base, c => c.json(listRecords(kind, Number(c.req.param('routeId')))))
  routes.put(`${base}/reorder`, async c => {
    const routeId = Number(c.req.param('routeId'))
    const {data} = parseBody(RReorderSchema, await c.req.json().catch(() => null))
    if (!data) return c.json({error: 'INVALID_REQUEST'}, 400)
    if (!getRoute(routeId)) return c.json({error: 'ROUTE_NOT_FOUND'}, 404)
    const valid = db.transaction(() => {
      const ids = new Set(listRecords(kind, routeId).map(row => row.id))
      if (data.some(item => !ids.has(item.id))) return false
      for (const item of data) db.update(table).set({sort: item.sort})
        .where(and(eq(table.route_id, routeId), eq(table.id, item.id))).run()
      return true
    })
    return valid ? c.json({ok: true}) : c.json({error: 'ROUTE_RECORD_NOT_FOUND'}, 404)
  })
  for (const method of ['post', 'put'] as const) {
    routes[method](method === 'post' ? base : `${base}/:id`, async c => {
      const routeId = Number(c.req.param('routeId'))
      const id = method === 'put' ? parseId(c.req.param('id')!) : null
      const raw = await c.req.json().catch(() => null)
      const parsed = v.safeParse(schema, raw)
      if (!parsed.success) return c.json({error: 'INVALID_REQUEST'}, 400)
      const input = parsed.output
      try {
        const saved = db.transaction(() => {
          const parent = getRoute(routeId)
          if (!parent) throw new RouteConfigError('ROUTE_NOT_FOUND', 404)
          const current = id ? listRecords(kind, routeId).find(row => row.id === id) : null
          if (method === 'put' && !current) throw new RouteConfigError('ROUTE_RECORD_NOT_FOUND', 404)
          if (current && 'modelId' in current && !isEditableRouteModel(current)) throw new RouteConfigError('ROUTE_MODEL_UNSUPPORTED', 409)
          if ('modelId' in input && !sourceExists(input.modelId)) throw new RouteConfigError('ROUTE_SOURCE_NOT_FOUND', 400)
          if ('path' in input && input.path === parent.modelsPath) throw new RouteConfigError('DUPLICATE_ROUTE_ENDPOINT', 409)
          const sort = input.sort ?? current?.sort ?? listRecords(kind, routeId).reduce((max, row) => Math.max(max, row.sort), -1) + 1
          let savedId: number
          if (id) {
            if ('path' in input) db.update(rEndpoint).set({...input, sort})
              .where(and(eq(rEndpoint.route_id, routeId), eq(rEndpoint.id, id))).run()
            else if ('secret' in input) db.update(rKey).set({name: input.name, secret: input.secret,
              expire_time: input.expireTime, enabled: input.enabled, remark: input.remark, sort})
              .where(and(eq(rKey.route_id, routeId), eq(rKey.id, id))).run()
            else db.update(rModel).set({source_type: input.sourceType, model_id: input.modelId, mode: input.mode,
              code: input.code, name: input.name, category: input.category, remark: input.remark, enabled: input.enabled, sort})
              .where(and(eq(rModel.route_id, routeId), eq(rModel.id, id))).run()
            savedId = id
          } else if ('path' in input) savedId = db.insert(rEndpoint).values({route_id: routeId, ...input, sort}).returning({id: rEndpoint.id}).get()!.id
          else if ('secret' in input) savedId = db.insert(rKey).values({route_id: routeId, name: input.name, secret: input.secret,
            expire_time: input.expireTime, enabled: input.enabled, remark: input.remark, sort}).returning({id: rKey.id}).get()!.id
          else savedId = db.insert(rModel).values({route_id: routeId, source_type: input.sourceType, model_id: input.modelId,
            mode: input.mode, code: input.code, name: input.name, category: input.category,
            enabled: input.enabled, remark: input.remark, sort}).returning({id: rModel.id}).get()!.id
          return listRecords(kind, routeId).find(row => row.id === savedId)!
        })
        return c.json(saved, method === 'post' ? 201 : 200)
      } catch (err) {
        if (err instanceof RouteConfigError) return c.json({error: err.code}, err.status)
        const code = conflict(err)
        if (code) return c.json({error: code}, 409)
        throw err
      }
    })
  }
  routes.patch(`${base}/:id/enabled`, async c => {
    const routeId = Number(c.req.param('routeId'))
    const id = parseId(c.req.param('id')!)
    const {data} = parseBody(REnabledSchema, await c.req.json().catch(() => null))
    if (!data) return c.json({error: 'INVALID_REQUEST'}, 400)
    if (!getRoute(routeId)) return c.json({error: 'ROUTE_NOT_FOUND'}, 404)
    if (kind === 'models' && data.enabled && id) {
      const model = db.select().from(rModel).where(and(eq(rModel.route_id, routeId), eq(rModel.id, id))).get()
      if (model?.source_type === 'V_MODEL') return c.json({error: 'ROUTE_MODEL_UNSUPPORTED'}, 409)
      if (model && !sourceExists(model.model_id)) return c.json({error: 'ROUTE_SOURCE_NOT_FOUND'}, 400)
    }
    const result = id ? db.update(table).set(data).where(and(eq(table.route_id, routeId), eq(table.id, id))).run() : null
    return result?.changes ? c.json(listRecords(kind, routeId).find(row => row.id === id)!) : c.json({error: 'ROUTE_RECORD_NOT_FOUND'}, 404)
  })
  routes.delete(`${base}/:id`, c => {
    const id = parseId(c.req.param('id')!)
    const routeId = Number(c.req.param('routeId'))
    const result = id ? db.delete(table).where(and(eq(table.route_id, routeId), eq(table.id, id))).run() : null
    return result?.changes ? c.json({ok: true}) : c.json({error: 'ROUTE_RECORD_NOT_FOUND'}, 404)
  })
}
