export interface BrandIcon {
  readonly id: string
  readonly label: string
  readonly group: 'model' | 'provider' | 'application'
  readonly color: string
  readonly hasColor: boolean
  readonly hasDarkColor: boolean
  readonly hasDark: boolean
}

export interface BrandIconOption {
  readonly value: string
  readonly label: string
}

export interface BrandIconAssets {
  readonly color?: string
  readonly colorDark?: string
  readonly light?: string
  readonly dark?: string
}
