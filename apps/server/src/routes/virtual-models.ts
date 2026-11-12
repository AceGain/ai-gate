import { Hono } from 'hono'
import * as v from 'valibot'
import { VModelInputSchema, REnabledSchema } from '@ai-gate/shared'
import { isUniqueViolation, parseId } from './providers.js'
import { VirtualModelError, getVirtualModel, listVirtualModels, removeVirtualModel,
  saveVirtualModel, toggleVirtualModel, virtualModelSources } from '../virtual-model-store.js'

export const virtualModels = new Hono()
virtualModels.onError((error, c) => {
  if (error instanceof VirtualModelError) return c.json({ error: error.code }, error.status)
  if (isUniqueViolation(error)) return c.json({ error: 'DUPLICATE_VIRTUAL_MODEL' }, 409)
  throw error
})
virtualModels.get('/virtual-models', c => c.json(listVirtualModels()))
virtualModels.get('/virtual-models/model-sources', c => c.json(virtualModelSources()))
virtualModels.get('/virtual-models/:id', c => {
  const model = getVirtualModel(parseId(c.req.param('id')) ?? 0)
  return model ? c.json(model) : c.json({ error: 'VIRTUAL_MODEL_NOT_FOUND' }, 404)
})
for (const method of ['post', 'put'] as const) {
  virtualModels[method](method === 'post' ? '/virtual-models' : '/virtual-models/:id', async c => {
    const id = method === 'put' ? parseId(c.req.param('id')!) : undefined
    if (id === null) return c.json({ error: 'VIRTUAL_MODEL_NOT_FOUND' }, 404)
    const parsed = v.safeParse(VModelInputSchema, await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'INVALID_REQUEST', detail: parsed.issues[0]?.message }, 400)
    return c.json(saveVirtualModel(parsed.output, id), method === 'post' ? 201 : 200)
  })
}
virtualModels.patch('/virtual-models/:id/enabled', async c => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'VIRTUAL_MODEL_NOT_FOUND' }, 404)
  const parsed = v.safeParse(REnabledSchema, await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'INVALID_REQUEST' }, 400)
  return c.json(toggleVirtualModel(id, parsed.output.enabled))
})
virtualModels.delete('/virtual-models/:id', c => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'VIRTUAL_MODEL_NOT_FOUND' }, 404)
  removeVirtualModel(id)
  return c.json({ ok: true })
})
