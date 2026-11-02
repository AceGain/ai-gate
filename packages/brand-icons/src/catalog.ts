import catalog from './generated/catalog.json'
import aliases from '../metadata/aliases.json'
import type { BrandIcon, BrandIconOption } from './types'

/** Framework-independent catalog. This entry does not load image assets. */
export const brands: readonly BrandIcon[] = Object.freeze(catalog as BrandIcon[])
export const legacyBrandIconKeys: Readonly<Record<string, string>> = Object.freeze(aliases)
export const brandIconOptions: readonly BrandIconOption[] = Object.freeze(
  brands.map(({ id, label }) => Object.freeze({ value: id, label })),
)

const ids = new Set(brands.map(brand => brand.id))

/** Resolve a persisted brand ID or a supported historical alias. */
export function resolveBrandId(icon: string): string | undefined {
  if (ids.has(icon)) return icon
  const id = Object.hasOwn(legacyBrandIconKeys, icon) ? legacyBrandIconKeys[icon] : undefined
  return id && ids.has(id) ? id : undefined
}

export type { BrandIcon, BrandIconOption } from './types'
