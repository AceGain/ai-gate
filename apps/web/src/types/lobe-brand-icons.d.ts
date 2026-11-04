declare module 'virtual:lobe-brand-icons' {
  import type { Component } from 'vue'
  const icons: Readonly<Record<string, Component>>
  export default icons
}

declare module 'virtual:lobe-brand-icon-loader' {
  import type { Component } from 'vue'
  export default function load(attempt: number): Promise<{ default: Readonly<Record<string, Component>> }>
}
