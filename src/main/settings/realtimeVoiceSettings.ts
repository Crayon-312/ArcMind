import type {
  PublicRealtimeVoiceConfig,
  RealtimeVoiceCapabilityResult,
  RealtimeVoiceConfig
} from '../../shared'
import {
  assertRealtimeVoiceCanEnable,
  probeRealtimeVoiceCapability
} from '../voice/realtimeVoiceCapability'
import type { RealtimeVoiceConfigStore } from './realtimeVoiceConfigStore'

type CapabilityProbe = (config: RealtimeVoiceConfig) => Promise<RealtimeVoiceCapabilityResult>

export async function saveRealtimeVoiceConfig(
  store: RealtimeVoiceConfigStore,
  input: Partial<RealtimeVoiceConfig>,
  probe: CapabilityProbe = probeRealtimeVoiceCapability
): Promise<PublicRealtimeVoiceConfig> {
  const config = await store.preview(input)
  await assertRealtimeVoiceCanEnable(config, probe)
  return store.set(input)
}
