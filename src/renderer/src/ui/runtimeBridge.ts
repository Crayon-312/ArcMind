import type { ArcMindApi } from '../../../preload'

export const desktopBridgeUnavailableMessage = '当前是浏览器预览环境，模型配置需要通过 ArcMind 桌面应用启动后才能保存或测试。'

export function hasModelSettingsBridge(bridge: ArcMindApi | undefined): bridge is ArcMindApi {
  return (
    typeof bridge?.settings?.getModelConfig === 'function' &&
    typeof bridge.settings.setModelConfig === 'function' &&
    typeof bridge.settings.testModelConfig === 'function' &&
    typeof bridge.settings.getRealtimeVoiceConfig === 'function' &&
    typeof bridge.settings.setRealtimeVoiceConfig === 'function' &&
    typeof bridge.settings.testRealtimeVoiceConfig === 'function'
  )
}
