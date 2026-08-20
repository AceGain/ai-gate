import {invoke as tauriInvoke, isTauri} from '@tauri-apps/api/core'

export const isDesktop = isTauri()

export function invokeTauri<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isDesktop) {
    return Promise.reject(
      new Error(`Tauri command "${cmd}" is only available in desktop mode`),
    )
  }
  return tauriInvoke<T>(cmd, args)
}
