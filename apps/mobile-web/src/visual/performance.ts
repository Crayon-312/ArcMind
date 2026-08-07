export type VisualQuality = 'low' | 'medium' | 'high';

export interface VisualPerformanceProfile {
  quality: VisualQuality;
  particleCount: number;
  maxPixelRatio: number;
  ringCount: number;
  advancedGlow: boolean;
  idleFrameMs: number;
}

export function resolveVisualPerformanceProfile(
  devicePixelRatio: number,
  hardwareConcurrency: number
): VisualPerformanceProfile {
  const constrainedCpu = hardwareConcurrency > 0 && hardwareConcurrency <= 4;
  const denseDisplay = devicePixelRatio >= 2.5;

  if (constrainedCpu) {
    return {
      quality: 'low',
      particleCount: 3200,
      maxPixelRatio: 1.25,
      ringCount: 1,
      advancedGlow: false,
      idleFrameMs: 160,
    };
  }

  if (denseDisplay || hardwareConcurrency <= 8) {
    return {
      quality: 'medium',
      particleCount: 5200, // Reduced slightly for mobile web performance
      maxPixelRatio: 1.5,
      ringCount: 2,
      advancedGlow: true,
      idleFrameMs: 96,
    };
  }

  return {
    quality: 'high',
    particleCount: 7200,
    maxPixelRatio: 2,
    ringCount: 3,
    advancedGlow: true,
    idleFrameMs: 48,
  };
}
