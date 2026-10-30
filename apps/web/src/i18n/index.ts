import { useStorage } from '@vueuse/core'
import { computed, watch } from 'vue'
import { createI18n } from 'vue-i18n'
import zhCN from '@/locales/zh-CN.json'
import zhTW from '@/locales/zh-TW.json'
import enUS from '@/locales/en-US.json'
import { DEFAULT_LOCALE, detectLocale, isAppLocale } from './locales'
import type { AppLocale } from './locales'

export type MessageSchema = typeof zhCN
type MessagePaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${MessagePaths<T[K]>}`
}[keyof T & string]
export type MessageKey = MessagePaths<MessageSchema>

declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends MessageSchema {}
}

const detectedLocale = detectLocale(navigator.languages?.length ? navigator.languages : [navigator.language])
const preference = useStorage<string>('ai-gate.locale', detectedLocale)

export const i18n = createI18n<[MessageSchema], AppLocale, false>({
  legacy: false,
  locale: isAppLocale(preference.value) ? preference.value : detectedLocale,
  fallbackLocale: DEFAULT_LOCALE,
  messages: { 'zh-CN': zhCN, 'zh-TW': zhTW, 'en-US': enUS },
})

// One source of truth for Vue I18n, settings, storage events, and component locale.
watch(preference, (value) => {
  const locale = isAppLocale(value) ? value : detectedLocale
  i18n.global.locale.value = locale
  document.documentElement.lang = locale
  document.documentElement.dir = 'ltr'
}, { immediate: true, flush: 'sync' })

export const currentLocale = computed<AppLocale>({
  get: () => i18n.global.locale.value,
  set: value => { if (isAppLocale(value)) preference.value = value },
})

/** For stores and other code outside component setup. Translate at use time. */
export const t = i18n.global.t
