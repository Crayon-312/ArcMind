export const TYPEWRITER_FRAME_MS = 16

export function revealNextChunk(visible: string, target: string): string {
  if (visible.length >= target.length) {
    return visible
  }

  const remaining = target.length - visible.length
  const nextLength = Math.min(target.length, visible.length + getRevealChunkSize(remaining))
  return target.slice(0, nextLength)
}

export function getRevealChunkSize(remaining: number): number {
  if (remaining > 1200) {
    return 28
  }
  if (remaining > 640) {
    return 18
  }
  if (remaining > 260) {
    return 10
  }
  if (remaining > 80) {
    return 5
  }
  if (remaining > 24) {
    return 3
  }
  return 1
}
