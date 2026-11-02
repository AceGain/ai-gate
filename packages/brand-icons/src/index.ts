import { brandIconAssets } from './generated/assets'
import { resolveBrandId } from './catalog'
import { createBrandIconResolver } from './resolve'

/** Static asset imports are resolved to URLs by the consuming app's bundler. */
export const resolveBrandIcon = createBrandIconResolver(brandIconAssets, resolveBrandId)

export { brands, brandIconOptions, legacyBrandIconKeys, resolveBrandId } from './catalog'
export type { BrandIcon, BrandIconOption } from './types'
