import { useCallback, useEffect, useRef, useState } from 'react'
import type { AudioSignal } from '../../../shared'

type MicrophoneStatus = 'idle' | 'requesting' | 'listening' | 'denied' | 'error'

const EMPTY_AUDIO_SIGNAL: AudioSignal = {
  level: 0,
  low: 0,
  mid: 0,
  high: 0,
  rhythm: 0
}

interface MicrophoneLevel {
  level: number
  signal: AudioSignal
  status: MicrophoneStatus
  error: string | null
  start: (inputStream?: MediaStream) => Promise<void>
  stop: () => void
}

export function useMicrophoneLevel(): MicrophoneLevel {
  const [level, setLevel] = useState(0)
  const [signal, setSignal] = useState<AudioSignal>(EMPTY_AUDIO_SIGNAL)
  const [status, setStatus] = useState<MicrophoneStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const samplesRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const frequencySamplesRef = useRef<Uint8Array<ArrayBuffer> | null>(null)

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null

    void audioContextRef.current?.close()
    audioContextRef.current = null
    analyserRef.current = null
    samplesRef.current = null
    frequencySamplesRef.current = null

    setLevel(0)
    setSignal(EMPTY_AUDIO_SIGNAL)
    setStatus('idle')
  }, [])

  const sample = useCallback(() => {
    const analyser = analyserRef.current
    const samples = samplesRef.current
    const frequencySamples = frequencySamplesRef.current

    if (!analyser || !samples || !frequencySamples) {
      return
    }

    analyser.getByteTimeDomainData(samples)
    analyser.getByteFrequencyData(frequencySamples)

    let sum = 0
    for (let i = 0; i < samples.length; i += 1) {
      const value = (samples[i] - 128) / 128
      sum += value * value
    }

    const rms = Math.sqrt(sum / samples.length)
    const nextLevel = Math.min(1, rms * 4.2)
    const nextBands = resolveFrequencyBands(frequencySamples)

    setLevel((previous) => previous * 0.72 + nextLevel * 0.28)
    setSignal((previous) => ({
      level: previous.level * 0.72 + nextLevel * 0.28,
      low: previous.low * 0.74 + nextBands.low * 0.26,
      mid: previous.mid * 0.74 + nextBands.mid * 0.26,
      high: previous.high * 0.74 + nextBands.high * 0.26,
      rhythm: previous.rhythm * 0.64 + Math.min(1, Math.abs(nextLevel - previous.level) * 3.4) * 0.36
    }))
    frameRef.current = requestAnimationFrame(sample)
  }, [])

  const start = useCallback(async (inputStream?: MediaStream) => {
    try {
      setStatus('requesting')
      setError(null)

      const stream =
        inputStream ??
        (await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        }))

      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()

      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.82
      source.connect(analyser)

      streamRef.current = stream
      audioContextRef.current = audioContext
      analyserRef.current = analyser
      samplesRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))
      frequencySamplesRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))

      setStatus('listening')
      frameRef.current = requestAnimationFrame(sample)
    } catch (unknownError) {
      const message = unknownError instanceof Error ? unknownError.message : '麦克风不可用'
      setError(message)
      setStatus(message.toLowerCase().includes('permission') ? 'denied' : 'error')
      setLevel(0)
      setSignal(EMPTY_AUDIO_SIGNAL)
    }
  }, [sample])

  useEffect(() => stop, [stop])

  return { level, signal, status, error, start, stop }
}

function resolveFrequencyBands(samples: Uint8Array<ArrayBuffer>): Pick<AudioSignal, 'low' | 'mid' | 'high'> {
  const lowEnd = Math.max(1, Math.floor(samples.length * 0.18))
  const midEnd = Math.max(lowEnd + 1, Math.floor(samples.length * 0.56))

  return {
    low: averageBand(samples, 0, lowEnd),
    mid: averageBand(samples, lowEnd, midEnd),
    high: averageBand(samples, midEnd, samples.length)
  }
}

function averageBand(samples: Uint8Array<ArrayBuffer>, start: number, end: number): number {
  let sum = 0
  const safeEnd = Math.max(start + 1, end)

  for (let index = start; index < safeEnd; index += 1) {
    sum += samples[index] ?? 0
  }

  return Math.min(1, sum / (safeEnd - start) / 255)
}
