export const SUPPORTED_LOCALES = ['zh-CN', 'zh-TW', 'en-US'] as const
export type AppLocale = typeof SUPPORTED_LOCALES[number]
export const DEFAULT_LOCALE: AppLocale = 'zh-CN'

export const LANGUAGE_OPTIONS: readonly { value: AppLocale, label: string }[] = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en-US', label: 'English' },
]

export function isAppLocale(value: unknown): value is AppLocale {
  return SUPPORTED_LOCALES.includes(value as AppLocale)
}

/** Respect script subtags before region subtags (e.g. zh-Hant-CN). */
export function detectLocale(languages: readonly string[]): AppLocale {
  for (const language of languages) {
    const parts = language.toLowerCase().replaceAll('_', '-').split('-')
    if (parts[0] === 'en') return 'en-US'
    if (parts[0] !== 'zh') continue
    if (parts.includes('hant')) return 'zh-TW'
    if (parts.includes('hans')) return 'zh-CN'
    return parts.some(part => ['tw', 'hk', 'mo'].includes(part)) ? 'zh-TW' : 'zh-CN'
  }
  return DEFAULT_LOCALE
}
