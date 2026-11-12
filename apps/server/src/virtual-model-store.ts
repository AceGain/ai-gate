import { and, asc, eq } from 'drizzle-orm'
import { isVModelReady, type VModel, type VModelInput, type VModelMember, type VModelSource } from '@ai-gate/shared'
import { db } from './db/index.js'
import { vModel, vModelRelat, sModel, sProvider, rModel } from './db/schema.js'

export class VirtualModelError extends Error {
  constructor(public code: string, public status: 400 | 404 | 409) { super(code) }
}
export class VirtualSourceInUseError extends Error {
  constructor() { super('VIRTUAL_SOURCE_IN_USE') }
}
export function modelHasVirtualReferences(id: number) {
  return !!db.select({ id: vModelRelat.id }).from(vModelRelat).where(eq(vModelRelat.s_model_id, id)).get()
}
export function providerHasVirtualReferences(id: number) {
  return !!db.select({ id: vModelRelat.id }).from(vModelRelat)
    .innerJoin(sModel, eq(vModelRelat.s_model_id, sModel.id)).where(eq(sModel.provider_id, id)).get()
}
export function virtualModelSources(): VModelSource[] {
  return db.select({ model: sModel, provider: sProvider }).from(sModel)
    .innerJoin(sProvider, eq(sModel.provider_id, sProvider.id))
    .orderBy(asc(sProvider.sort), asc(sModel.sort), asc(sModel.id)).all()
    .map(({ model, provider }) => ({ id: model.id, code: model.code, name: model.name ?? '',
      providerName: provider.name, type: model.type, generates: model.gen_type, config: model.config,
      enabled: model.enabled && model.status === 'ACTIVE' && provider.enabled && provider.status === 'ACTIVE' }))
}
function members(): VModelMember[] {
  return db.select({ row: vModelRelat, source: sModel, provider: sProvider }).from(vModelRelat)
    .innerJoin(sModel, eq(vModelRelat.s_model_id, sModel.id)).innerJoin(sProvider, eq(sModel.provider_id, sProvider.id))
    .orderBy(asc(vModelRelat.sort), asc(vModelRelat.id)).all()
    .map(({ row, source, provider }) => ({ id: row.id, virtualModelId: row.v_model_id, modelId: row.s_model_id,
      role: row.role, enabled: row.enabled, sort: row.sort, weight: row.weight, remark: row.remark ?? '',
      sourceCode: source.code, sourceName: source.name ?? '', providerName: provider.name,
      sourceEnabled: source.enabled && source.status === 'ACTIVE' && provider.enabled && provider.status === 'ACTIVE',
      createTime: row.create_time, updateTime: row.update_time }))
}
function toModel(row: typeof vModel.$inferSelect, relations: VModelMember[]): VModel {
  return { id: row.id, code: row.code, name: row.name ?? '', category: row.category, kind: row.kind,
    type: row.type as VModel['type'], enabled: row.enabled, status: row.status, generates: row.gen_type as VModel['generates'],
    config: row.config, orchConfig: row.orch_config as VModel['orchConfig'], timeout: row.timeout,
    maxCalls: row.max_calls, sort: row.sort, remark: row.remark ?? '',
    members: relations.filter(member => member.virtualModelId === row.id),
    createTime: row.create_time, updateTime: row.update_time }
}
export function listVirtualModels() {
  const relations = members()
  return db.select().from(vModel).orderBy(asc(vModel.sort), asc(vModel.id)).all().map(row => toModel(row, relations))
}
export function getVirtualModel(id: number) {
  const row = db.select().from(vModel).where(eq(vModel.id, id)).get()
  return row ? toModel(row, members()) : null
}
export function saveVirtualModel(input: VModelInput, id?: number): VModel {
  return db.transaction(() => {
    const current = id === undefined ? null : getVirtualModel(id)
    if (id !== undefined && !current) throw new VirtualModelError('VIRTUAL_MODEL_NOT_FOUND', 404)
    if (current && (current.code !== input.code || current.kind !== input.kind)) {
      throw new VirtualModelError('VIRTUAL_MODEL_IMMUTABLE', 409)
    }
    const sourceList = virtualModelSources()
    const sources = new Set(sourceList.map(source => source.id))
    if (input.members.some(member => !sources.has(member.modelId))) throw new VirtualModelError('VIRTUAL_SOURCE_NOT_FOUND', 400)
    if (input.members.some(member => member.id !== undefined && !current?.members.some(existing => existing.id === member.id))) {
      throw new VirtualModelError('VIRTUAL_MEMBER_NOT_FOUND', 404)
    }
    const available = new Set(sourceList.filter(source => source.enabled).map(source => source.id))
    if (input.enabled && !isVModelReady(input, available)) throw new VirtualModelError('VIRTUAL_MODEL_NOT_READY', 400)
    const values = { name: input.name, category: input.category, type: input.type, enabled: input.enabled,
      gen_type: input.generates, config: input.config, orch_config: input.orchConfig, timeout: input.timeout,
      max_calls: input.maxCalls, remark: input.remark, sort: input.sort ?? current?.sort ??
        (db.select({ sort: vModel.sort }).from(vModel).all().reduce((max, row) => Math.max(max, row.sort), -1) + 1) }
    const saved = current
      ? db.update(vModel).set(values).where(eq(vModel.id, current.id)).returning().get()!
      : db.insert(vModel).values({ ...values, code: input.code, kind: input.kind }).returning().get()!
    const kept = new Set(input.members.flatMap(member => member.id === undefined ? [] : [member.id]))
    for (const member of current?.members ?? []) {
      if (!kept.has(member.id)) db.delete(vModelRelat).where(and(eq(vModelRelat.v_model_id, saved.id), eq(vModelRelat.id, member.id))).run()
    }
    // 先移除角色/来源发生变化的关系，允许在一次原子保存中交换成员角色。
    const changed = new Map<number, VModelMember>()
    for (const member of input.members) {
      const previous = current?.members.find(existing => existing.id === member.id)
      if (previous && (previous.modelId !== member.modelId || previous.role !== member.role)) {
        changed.set(previous.id, previous)
        db.delete(vModelRelat).where(and(eq(vModelRelat.v_model_id, saved.id), eq(vModelRelat.id, previous.id))).run()
      }
    }
    for (const member of input.members) {
      const data = { s_model_id: member.modelId, role: member.role, enabled: member.enabled,
        sort: member.sort, weight: member.weight, remark: member.remark }
      if (member.id !== undefined && !changed.has(member.id)) {
        db.update(vModelRelat).set(data).where(and(eq(vModelRelat.v_model_id, saved.id), eq(vModelRelat.id, member.id))).run()
      } else {
        db.insert(vModelRelat).values({ ...data, v_model_id: saved.id,
          ...(member.id === undefined ? {} : { id: member.id, create_time: changed.get(member.id)!.createTime }) }).run()
      }
    }
    return getVirtualModel(saved.id)!
  })
}
export function toggleVirtualModel(id: number, enabled: boolean) {
  return db.transaction(() => {
    const current = getVirtualModel(id)
    if (!current) throw new VirtualModelError('VIRTUAL_MODEL_NOT_FOUND', 404)
    const available = new Set(virtualModelSources().filter(source => source.enabled).map(source => source.id))
    if (enabled && !isVModelReady(current, available)) throw new VirtualModelError('VIRTUAL_MODEL_NOT_READY', 400)
    db.update(vModel).set({ enabled }).where(eq(vModel.id, id)).run()
    return getVirtualModel(id)!
  })
}
export function removeVirtualModel(id: number) {
  return db.transaction(() => {
    if (!getVirtualModel(id)) throw new VirtualModelError('VIRTUAL_MODEL_NOT_FOUND', 404)
    if (db.select({ id: rModel.id }).from(rModel)
      .where(and(eq(rModel.source_type, 'V_MODEL'), eq(rModel.model_id, id))).get()) {
      throw new VirtualModelError('VIRTUAL_MODEL_IN_USE', 409)
    }
    db.delete(vModel).where(eq(vModel.id, id)).run()
  })
}
