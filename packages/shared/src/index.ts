import * as v from 'valibot'

export const HealthSchema = v.object({
  status: v.literal('ok'),
})

export type Health = v.InferOutput<typeof HealthSchema>

export * from './provider.js'
export * from './endpoint.js'
export * from './key.js'
export * from './model.js'
