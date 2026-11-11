declare module 'virtual:lobe-brand-icon-loader' {
  import type { Component } from 'vue'
  const loaders: Readonly<Record<string, (attempt: number) => Promise<{ default: Component }>>>
  export default loaders
}
