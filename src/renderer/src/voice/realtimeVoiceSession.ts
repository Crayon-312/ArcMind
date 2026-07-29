import type { ArcMindApi } from '../../../preload'
import type { AppError, RealtimeVoiceSessionStatus } from '../../../shared'
import {
  normalizeRealtimeVoiceError,
  realtimeVoiceConnectionError,
  type RealtimeVoiceFailureStage
} from './realtimeVoiceDiagnostics'

export interface RealtimeVoiceSession {
  close: () => void
  setMicrophoneMuted: (muted: boolean) => void
}

export interface RealtimeVoiceSessionOptions {
  bridge: ArcMindApi
  onFailure: (error: AppError) => void
  onLocalStream: (stream: MediaStream) => Promise<void> | void
  onStateChange: (status: RealtimeVoiceSessionStatus) => void
  signal?: AbortSignal
}

export async function startRealtimeVoiceSession(
  options: RealtimeVoiceSessionOptions
): Promise<RealtimeVoiceSession> {
  const peer = new RTCPeerConnection()
  const audio = document.createElement('audio')
  let localStream: MediaStream | null = null
  let closed = false
  let failureStage: RealtimeVoiceFailureStage = 'microphone_access'
  let microphoneMuted = false
  let semanticState: RealtimeVoiceSessionStatus = 'connecting'
  let visibleState: RealtimeVoiceSessionStatus = 'connecting'
  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let audioFrame = 0
  let lastRemoteVoiceAt = 0

  const emit = (status: RealtimeVoiceSessionStatus): void => {
    if (closed || visibleState === status) {
      return
    }
    visibleState = status
    options.onStateChange(status)
  }

  const emitSemantic = (status: RealtimeVoiceSessionStatus): void => {
    semanticState = status
    if (!microphoneMuted) {
      emit(status)
    }
  }

  const stopRemoteAnalysis = (): void => {
    if (audioFrame) {
      cancelAnimationFrame(audioFrame)
      audioFrame = 0
    }
    void audioContext?.close()
    audioContext = null
    analyser = null
  }

  const startRemoteAnalysis = (stream: MediaStream): void => {
    stopRemoteAnalysis()
    audioContext = new AudioContext()
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 512
    audioContext.createMediaStreamSource(stream).connect(analyser)
    const samples = new Uint8Array(analyser.fftSize)

    const sample = (): void => {
      if (closed || !analyser) {
        return
      }
      analyser.getByteTimeDomainData(samples)
      let sum = 0
      for (const value of samples) {
        const centered = (value - 128) / 128
        sum += centered * centered
      }
      const level = Math.sqrt(sum / samples.length)
      const now = performance.now()
      if (level > 0.025) {
        lastRemoteVoiceAt = now
        semanticState = 'speaking'
        if (!microphoneMuted) {
          emit('speaking')
        }
      } else if (semanticState === 'speaking' && now - lastRemoteVoiceAt > 520) {
        emitSemantic('listening')
      }
      audioFrame = requestAnimationFrame(sample)
    }
    sample()
  }

  const close = (): void => {
    if (closed) {
      return
    }
    closed = true
    stopRemoteAnalysis()
    audio.pause()
    audio.srcObject = null
    peer.close()
    localStream?.getTracks().forEach((track) => track.stop())
  }

  try {
    if (options.signal?.aborted) {
      throw new DOMException('Realtime voice connection cancelled.', 'AbortError')
    }
    options.signal?.addEventListener('abort', close, { once: true })
    const activeLocalStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })
    localStream = activeLocalStream
    audio.autoplay = true
    audio.setAttribute('aria-hidden', 'true')
    peer.ontrack = (event) => {
      const remoteStream = event.streams[0] ?? new MediaStream([event.track])
      audio.srcObject = remoteStream
      void audio.play().catch((error) => {
        options.onFailure(normalizeRealtimeVoiceError(error, 'remote_audio'))
        emit('connection_error')
      })
      startRemoteAnalysis(remoteStream)
    }
    peer.onconnectionstatechange = () => {
      if (closed) {
        return
      }
      if (peer.connectionState === 'connected') {
        emitSemantic('listening')
      } else if (
        peer.connectionState === 'failed' ||
        peer.connectionState === 'disconnected'
      ) {
        options.onFailure(
          realtimeVoiceConnectionError(
            'peer_connection',
            `WebRTC 连接进入${peer.connectionState === 'failed' ? '失败' : '断开'}状态。`,
            {
              connectionState: peer.connectionState,
              iceConnectionState: peer.iceConnectionState
            }
          )
        )
        emit('connection_error')
      }
    }

    activeLocalStream
      .getAudioTracks()
      .forEach((track) => peer.addTrack(track, activeLocalStream))
    await options.onLocalStream(activeLocalStream)

    const dataChannel = peer.createDataChannel('oai-events')
    dataChannel.addEventListener('message', (event) => {
      const serverError = realtimeVoiceErrorFromServerEvent(event.data)
      if (serverError) {
        options.onFailure(serverError)
        emit('connection_error')
        return
      }
      const next = realtimeVoiceStatusFromServerEvent(event.data)
      if (next) {
        emitSemantic(next)
      }
    })
    dataChannel.addEventListener('error', () => {
      options.onFailure(
        realtimeVoiceConnectionError(
          'data_channel',
          '实时语音控制数据通道发生错误，模型事件无法继续传输。'
        )
      )
      emit('connection_error')
    })

    failureStage = 'offer_creation'
    const offer = await peer.createOffer()
    await peer.setLocalDescription(offer)
    const localSdp = peer.localDescription?.sdp
    if (!localSdp) {
      throw new Error('无法生成实时通话协商内容。')
    }

    failureStage = 'call_creation'
    const answer = await options.bridge.voice.createRealtimeCall({ sdp: localSdp })
    if (!answer.ok) {
      throw answer.error
    }
    if (options.signal?.aborted) {
      throw new DOMException('Realtime voice connection cancelled.', 'AbortError')
    }
    failureStage = 'answer_application'
    await peer.setRemoteDescription({ type: 'answer', sdp: answer.sdp })

    return {
      close,
      setMicrophoneMuted: (muted: boolean) => {
        microphoneMuted = muted
        activeLocalStream.getAudioTracks().forEach((track) => {
          track.enabled = !muted
        })
        emit(muted ? 'muted' : semanticState)
      }
    }
  } catch (error) {
    close()
    throw normalizeRealtimeVoiceError(error, failureStage)
  }
}

export function realtimeVoiceStatusFromServerEvent(
  raw: unknown
): RealtimeVoiceSessionStatus | null {
  if (typeof raw !== 'string') {
    return null
  }

  try {
    const event = JSON.parse(raw) as { type?: unknown }
    const type = typeof event.type === 'string' ? event.type : ''

    if (
      type === 'input_audio_buffer.speech_started' ||
      type === 'input_audio_buffer.committed'
    ) {
      return 'listening'
    }
    if (
      type === 'input_audio_buffer.speech_stopped' ||
      type === 'response.created' ||
      type === 'response.output_item.added' ||
      type === 'response.content_part.added'
    ) {
      return 'thinking'
    }
    if (
      type === 'response.audio.delta' ||
      type === 'response.output_audio.delta' ||
      type === 'response.audio_transcript.delta' ||
      type === 'output_audio_buffer.started'
    ) {
      return 'speaking'
    }
    if (
      type === 'response.audio.done' ||
      type === 'response.output_audio.done' ||
      type === 'response.done' ||
      type === 'output_audio_buffer.stopped'
    ) {
      return 'listening'
    }
    if (type === 'error') {
      return 'connection_error'
    }
  } catch {
    return null
  }

  return null
}

export function realtimeVoiceErrorFromServerEvent(raw: unknown): AppError | null {
  if (typeof raw !== 'string') {
    return null
  }

  try {
    const event = JSON.parse(raw) as {
      type?: unknown
      error?: {
        code?: unknown
        type?: unknown
      }
    }
    if (event.type !== 'error') {
      return null
    }

    const upstreamCode = boundedServerToken(event.error?.code)
    const upstreamType = boundedServerToken(event.error?.type)
    return realtimeVoiceConnectionError(
      'data_channel',
      '实时语音服务通过控制数据通道返回错误。',
      {
        ...(upstreamCode ? { upstreamCode } : {}),
        ...(upstreamType ? { upstreamType } : {})
      }
    )
  } catch {
    return null
  }
}

function boundedServerToken(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const token = value.trim()
  return token.length > 0 && token.length <= 96 && /^[a-zA-Z0-9_./+-]+$/.test(token)
    ? token
    : undefined
}
