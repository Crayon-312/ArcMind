import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { resolveVisualPerformanceProfile } from './performance';
import type { CoreMode, VisualSignal } from './state';

interface ParticleCoreProps {
  mode: CoreMode;
  signal: VisualSignal;
  sidebarOpen?: boolean;
  workbenchOpen?: boolean;
  composerOpen?: boolean;
}

const FALLBACK_SIGNAL: VisualSignal = {
  audio: {
    level: 0,
    low: 0,
    mid: 0,
    high: 0,
    rhythm: 0,
  },
  tokenPulse: 0,
  errorPulse: 0,
  thinkingLevel: 0,
  speakingLevel: 0,
};

const MODE_COLORS: Record<CoreMode, THREE.Color> = {
  idle: new THREE.Color('#7fd8ff'),
  ready: new THREE.Color('#7fd8ff'),
  connecting: new THREE.Color('#88e6ff'),
  listening: new THREE.Color('#00f5d4'),
  transcribing: new THREE.Color('#8bd3ff'),
  thinking: new THREE.Color('#f4d28a'),
  speaking: new THREE.Color('#a6ffcb'),
  muted: new THREE.Color('#d9a85f'),
  connection_error: new THREE.Color('#ff5367'),
  error: new THREE.Color('#ff5367'),
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rotatePoint(
  x: number,
  y: number,
  z: number,
  rx: number,
  ry: number,
  rz: number
): [number, number, number] {
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const nextY = y * cosX - z * sinX;
  let nextZ = y * sinX + z * cosX;
  let nextX = x;

  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const rotatedX = nextX * cosY + nextZ * sinY;
  nextZ = -nextX * sinY + nextZ * cosY;
  nextX = rotatedX;

  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);
  return [nextX * cosZ - nextY * sinZ, nextX * sinZ + nextY * cosZ, nextZ];
}

const COMPOSER_CONTACT_DELAY_SECONDS = 0.24;
const COMPOSER_IMPULSE_SECONDS = 1.18;
const COMPOSER_ACTIVE_CLASS_MS = 1660;
const COMPOSER_CORE_PUSH = 0.16;
const COMPOSER_CAMERA_PUSH = 0.28;
const COMPOSER_GROUP_SCALE = 0.06;
const COMPOSER_CORE_SCALE = 0.18;
const COMPOSER_HALO_SCALE = 0.34;

export function ParticleCore({
  mode,
  signal,
  sidebarOpen = false,
  workbenchOpen = false,
  composerOpen = false,
}: ParticleCoreProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const modeRef = useRef(mode);
  const signalRef = useRef(signal);
  const sidebarOpenRef = useRef(sidebarOpen);
  const workbenchOpenRef = useRef(workbenchOpen);
  const composerOpenRef = useRef(composerOpen);
  const lastTokenPulseRef = useRef(signal.tokenPulse);
  const lastErrorPulseRef = useRef(signal.errorPulse);
  const tokenBurstRef = useRef(0);
  const errorBurstRef = useRef(0);
  const composerImpulseRef = useRef(0);
  const composerImpulseAgeRef = useRef(0);
  const composerClassTimerRef = useRef<number | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    sidebarOpenRef.current = sidebarOpen;
  }, [sidebarOpen]);

  useEffect(() => {
    workbenchOpenRef.current = workbenchOpen;
  }, [workbenchOpen]);

  useEffect(() => {
    if (composerOpen && !composerOpenRef.current) {
      composerImpulseRef.current = 1;
      composerImpulseAgeRef.current = 0;
      hostRef.current?.classList.add('is-composer-ripple-active');
      if (composerClassTimerRef.current) {
        window.clearTimeout(composerClassTimerRef.current);
      }
      composerClassTimerRef.current = window.setTimeout(() => {
        hostRef.current?.classList.remove('is-composer-ripple-active');
        composerClassTimerRef.current = null;
      }, COMPOSER_ACTIVE_CLASS_MS);
    }
    composerOpenRef.current = composerOpen;
  }, [composerOpen]);

  useEffect(() => {
    return () => {
      if (composerClassTimerRef.current) {
        window.clearTimeout(composerClassTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (signal.tokenPulse > lastTokenPulseRef.current) {
      tokenBurstRef.current = Math.min(0.72, tokenBurstRef.current + 0.24);
    }
    if (signal.errorPulse > lastErrorPulseRef.current) {
      errorBurstRef.current = Math.min(1.6, errorBurstRef.current + 1);
    }
    lastTokenPulseRef.current = signal.tokenPulse;
    lastErrorPulseRef.current = signal.errorPulse;
    signalRef.current = signal;
  }, [signal]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    const profile = resolveVisualPerformanceProfile(
      window.devicePixelRatio,
      navigator.hardwareConcurrency ?? 0
    );
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, profile.maxPixelRatio));
    renderer.setSize(host.clientWidth, host.clientHeight);
    if (THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      48,
      host.clientWidth / host.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 9.6);

    const group = new THREE.Group();
    group.scale.setScalar(1.18);
    // Center it in the middle for mobile view
    group.position.x = 0;
    scene.add(group);

    const particleCount = profile.particleCount;
    const positions = new Float32Array(particleCount * 3);
    const base = new Float32Array(particleCount * 3);
    const colorValues = new Float32Array(particleCount * 3);
    const color = new THREE.Color();

    for (let i = 0; i < particleCount; i += 1) {
      const band = i % 16;
      const lane = band % 9;
      const shell = Math.floor(i / 16);
      const angle = shell * 0.046 + band * 0.39;
      const radius =
        1.08 + (band % 5) * 0.16 + Math.sin(shell * 0.023 + band) * 0.08;
      const localX = Math.cos(angle) * radius;
      const localY = Math.sin(angle) * radius * (0.9 + (band % 4) * 0.035);
      const localZ =
        Math.sin(shell * 0.071 + band * 0.6) * 0.1 +
        Math.sin(angle * 3.2 + band) * 0.035;
      const rx = 0.24 + (((band * 37) % 128) / 128) * Math.PI;
      const ry = -0.92 + (((band * 53) % 128) / 128) * 1.84;
      const rz = band * 0.72;
      const [x, y, z] = rotatePoint(localX, localY, localZ, rx, ry, rz);

      base[i * 3] = x;
      base[i * 3 + 1] = y;
      base[i * 3 + 2] = z;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      color.setHSL(0.52 + lane * 0.01, 0.86, 0.5 + (i % 6) * 0.035);
      colorValues[i * 3] = color.r;
      colorValues[i * 3 + 1] = color.g;
      colorValues[i * 3 + 2] = color.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colorValues, 3));

    const material = new THREE.PointsMaterial({
      size: 0.026,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    group.add(particles);

    const ringGeometry = new THREE.TorusGeometry(
      2.08,
      0.006,
      10,
      132,
      Math.PI * 1.46
    );
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: '#7fd8ff',
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
    });
    const ringOrientations: Array<[number, number, number]> = [
      [Math.PI / 2, 0, 0],
      [0.32, Math.PI / 2, 0.16],
      [Math.PI / 2.7, 0.74, 0.42],
      [2.28, -0.46, 0.86],
      [0.68, -1.08, 1.34],
      [1.9, 0.48, 2.08],
    ];
    const ringCount = Math.min(
      ringOrientations.length,
      Math.max(2, profile.ringCount * 2)
    );
    const rings = ringOrientations
      .slice(0, ringCount)
      .map((orientation, index) => {
        const ring = new THREE.Mesh(ringGeometry, ringMaterial.clone());
        ring.rotation.x = orientation[0];
        ring.rotation.y = orientation[1];
        ring.rotation.z = orientation[2];
        ring.scale.setScalar(0.84 + index * 0.11);
        ring.userData.phase = index * 0.7;
        group.add(ring);
        return ring;
      });

    const coreGeometry = new THREE.IcosahedronGeometry(0.42, 3);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: '#e8fbff',
      wireframe: true,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    group.add(core);

    const haloGeometry = new THREE.SphereGeometry(0.62, 32, 16);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: '#7fd8ff',
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const coreHalo = new THREE.Mesh(haloGeometry, haloMaterial);
    group.add(coreHalo);

    const clock = new THREE.Clock();
    let animationFrame = 0;
    let idleTimer = 0;
    let frameScheduled = false;
    let visible = document.visibilityState === 'visible';
    let previousElapsed = 0;
    let sidebarInfluence = sidebarOpenRef.current ? 1 : 0;
    let workbenchInfluence = workbenchOpenRef.current ? 1 : 0;
    const interaction = {
      dragging: false,
      pointerId: -1,
      lastX: 0,
      lastY: 0,
      rotationX: 0,
      rotationY: 0,
      targetRotationX: 0,
      targetRotationY: 0,
      zoom: 9.6,
      targetZoom: 9.6,
    };

    const resize = (): void => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const handlePointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) {
        return;
      }
      interaction.dragging = true;
      interaction.pointerId = event.pointerId;
      interaction.lastX = event.clientX;
      interaction.lastY = event.clientY;
      host.classList.add('is-dragging');
      host.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent): void => {
      if (!interaction.dragging || event.pointerId !== interaction.pointerId) {
        return;
      }
      const deltaX = event.clientX - interaction.lastX;
      const deltaY = event.clientY - interaction.lastY;
      interaction.lastX = event.clientX;
      interaction.lastY = event.clientY;
      interaction.targetRotationY += deltaX * 0.006;
      interaction.targetRotationX = clamp(
        interaction.targetRotationX + deltaY * 0.004,
        -0.62,
        0.62
      );
    };

    const stopDragging = (event?: PointerEvent): void => {
      if (event && interaction.pointerId !== event.pointerId) {
        return;
      }
      if (
        interaction.dragging &&
        interaction.pointerId >= 0 &&
        host.hasPointerCapture(interaction.pointerId)
      ) {
        host.releasePointerCapture(interaction.pointerId);
      }
      interaction.dragging = false;
      interaction.pointerId = -1;
      host.classList.remove('is-dragging');
    };

    const handleLostPointerCapture = (): void => {
      stopDragging();
    };

    const handleWheel = (event: WheelEvent): void => {
      event.preventDefault();
      interaction.targetZoom = clamp(
        interaction.targetZoom + event.deltaY * 0.006,
        7.2,
        13.2
      );
    };

    const cancelScheduledFrame = (): void => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      if (idleTimer) {
        window.clearTimeout(idleTimer);
        idleTimer = 0;
      }
      frameScheduled = false;
    };

    const runScheduledFrame = (): void => {
      frameScheduled = false;
      animationFrame = 0;
      idleTimer = 0;
      animate();
    };

    const scheduleNextFrame = (): void => {
      if (frameScheduled) {
        return;
      }
      frameScheduled = true;
      if (visible) {
        animationFrame = requestAnimationFrame(runScheduledFrame);
        return;
      }

      idleTimer = window.setTimeout(runScheduledFrame, profile.idleFrameMs);
    };

    const animate = (): void => {
      const elapsed = clock.getElapsedTime();
      const deltaSeconds =
        previousElapsed > 0 ? Math.max(0, elapsed - previousElapsed) : 1 / 60;
      previousElapsed = elapsed;
      const currentMode = modeRef.current;
      const currentSignal = signalRef.current ?? FALLBACK_SIGNAL;
      const audio = currentSignal.audio;
      tokenBurstRef.current *= 0.86;
      errorBurstRef.current *= 0.88;
      const tokenBurst = tokenBurstRef.current;
      const errorBurst = errorBurstRef.current;
      let composerImpulse = 0;
      let composerProgress = 0;
      if (composerImpulseRef.current > 0) {
        composerImpulseAgeRef.current += deltaSeconds;
        composerProgress = clamp(
          (composerImpulseAgeRef.current - COMPOSER_CONTACT_DELAY_SECONDS) /
            COMPOSER_IMPULSE_SECONDS,
          0,
          1
        );
        if (
          composerImpulseAgeRef.current >=
          COMPOSER_CONTACT_DELAY_SECONDS + COMPOSER_IMPULSE_SECONDS
        ) {
          composerImpulseRef.current = 0;
          composerImpulseAgeRef.current = 0;
          host.classList.remove('is-composer-ripple-active');
        } else if (composerProgress > 0 && composerProgress < 1) {
          composerImpulse =
            Math.sin(composerProgress * Math.PI) *
            (1 - composerProgress * 0.12);
        }
      }
      sidebarInfluence +=
        ((sidebarOpenRef.current ? 1 : 0) - sidebarInfluence) * 0.08;
      workbenchInfluence +=
        ((workbenchOpenRef.current ? 1 : 0) - workbenchInfluence) * 0.08;
      interaction.rotationX +=
        (interaction.targetRotationX - interaction.rotationX) * 0.12;
      interaction.rotationY +=
        (interaction.targetRotationY - interaction.rotationY) * 0.12;
      interaction.zoom += (interaction.targetZoom - interaction.zoom) * 0.12;
      const breathSpeed =
        currentMode === 'ready'
          ? 0.72
          : currentMode === 'muted'
            ? 0.58
            : 1.28;
      const syntheticBreath = (Math.sin(elapsed * breathSpeed) + 1) * 0.5;
      const startupEnergy = Math.max(0, 1 - elapsed / 2.8);
      const breath = Math.max(audio.level, syntheticBreath * 0.18);
      const audioDrive =
        audio.low * 0.5 + audio.mid * 0.28 + audio.high * 0.22;
      const thinkingPull =
        currentSignal.thinkingLevel *
        (0.052 + Math.sin(elapsed * 1.4) * 0.012);
      const connectingPull =
        currentMode === 'connecting'
          ? 0.1 + (Math.sin(elapsed * 2.4) + 1) * 0.025
          : 0;
      const speakingExpansion =
        currentMode === 'speaking'
          ? (Math.sin(elapsed * 2.15) + 1) * 0.038
          : 0;
      const orbitAcceleration = clamp(
        audio.mid * 0.045 +
          audio.rhythm * 0.07 +
          currentSignal.thinkingLevel * 0.032 +
          (currentMode === 'connecting' ? 0.045 : 0) +
          tokenBurst * 0.012,
        0,
        0.12
      );
      const modeColor = MODE_COLORS[currentMode] || MODE_COLORS.idle;
      const modeEnergy =
        currentMode === 'ready'
          ? 0.94
          : currentMode === 'connecting'
            ? 1.12
            : currentMode === 'listening'
              ? 1.24
              : currentMode === 'transcribing'
                ? 1.1
                : currentMode === 'thinking'
                  ? 1.14
                  : currentMode === 'speaking'
                    ? 1.32
                    : currentMode === 'error' ||
                        currentMode === 'connection_error'
                      ? 1.08
                      : currentMode === 'muted'
                        ? 0.76
                        : 1;
      const energy =
        modeEnergy + tokenBurst * 0.12 + errorBurst * 0.18 + startupEnergy * 0.18;

      for (let i = 0; i < particleCount; i += 1) {
        const ix = i * 3;
        const band = i % 16;
        const lane = band % 9;
        const baseX = base[ix];
        const baseY = base[ix + 1];
        const baseZ = base[ix + 2];
        if (baseX === undefined || baseY === undefined || baseZ === undefined) continue;

        const composerSourceY = -2.24;
        const verticalTravel = Math.max(0, baseY - composerSourceY);
        const edgeDistance = verticalTravel + Math.abs(baseX) * 0.12;
        const edgeWidth = Math.exp(-(baseX * baseX) / 5.8);
        const composerTravel = composerProgress * 4.85;
        const composerBand =
          composerImpulse > 0
            ? edgeWidth *
              Math.exp(-((edgeDistance - composerTravel) ** 2) / (0.32 * 0.32))
            : 0;
        const composerNearSource =
          composerImpulse > 0
            ? edgeWidth * Math.exp(-(verticalTravel ** 2) / 0.16)
            : 0;
        const composerSheet =
          composerImpulse > 0
            ? 0.12 *
              Math.exp(-((verticalTravel - composerTravel * 0.72) ** 2) / 1.7) *
              edgeWidth
            : 0;
        const composerBottomWeight =
          composerImpulse > 0 ? clamp(1 - (baseY + 1.95) / 3.2, 0, 1) : 0;
        const composerRipple = composerImpulse * composerBand;
        const composerSourceGlow = composerImpulse * composerNearSource;
        const tokenRipple =
          Math.sin(elapsed * 6.2 + i * 0.047) *
          tokenBurst *
          (0.018 + lane * 0.002);
        const speakingRipple =
          Math.sin(elapsed * (2.1 + audio.high * 3.2) + i * 0.021) *
          currentSignal.speakingLevel *
          (0.025 + audio.high * 0.07);
        const orbitalFlicker =
          Math.sin(elapsed * (1.42 + lane * 0.07) + i * 0.029) *
          (0.012 + breath * 0.018);
        const pulse =
          1 -
          thinkingPull -
          connectingPull +
          speakingExpansion +
          breath * (0.1 + lane * 0.018) * energy +
          orbitalFlicker +
          tokenRipple +
          audio.low * 0.06 +
          composerRipple * 0.08 +
          composerImpulse * composerSheet * 0.035;
        const wave =
          Math.sin(elapsed * (0.75 + lane * 0.04 + audio.high * 0.42) + i * 0.019) *
            (0.04 + breath * 0.18 + audio.rhythm * 0.1) +
          speakingRipple;
        const twist = elapsed * (0.12 + lane * 0.01 + orbitAcceleration);
        const cos = Math.cos(twist);
        const sin = Math.sin(twist);
        const x = baseX * pulse;
        const y = baseY * pulse;
        const composerPhase = Math.sin(
          edgeDistance * 7.2 - composerProgress * 11.5
        );
        const composerLift =
          (composerRipple * 0.46 + composerImpulse * composerSheet * 0.18) *
          (0.62 + composerBottomWeight * 0.52);
        const composerDepth =
          (composerRipple * 0.82 +
            composerSourceGlow * 0.38 +
            composerImpulse * composerSheet * 0.34) *
          (0.72 + composerBottomWeight);

        positions[ix] = x * cos - y * sin;
        positions[ix + 1] =
          x * sin + y * cos + wave + composerLift * (0.76 + composerPhase * 0.18);
        positions[ix + 2] =
          baseZ *
            (1 + breath * 0.38 + audio.high * 0.12 + orbitalFlicker * 0.8) +
          Math.cos(elapsed + i * 0.013) * (breath + audioDrive) * 0.2 +
          composerDepth;

        const targetRed = Math.min(
          1,
          modeColor.r + errorBurst * 0.55 + startupEnergy * 0.12
        );
        const targetGreen = Math.min(
          1,
          modeColor.g +
            tokenBurst * 0.18 +
            audio.mid * 0.08 +
            composerRipple * 0.14 +
            composerSourceGlow * 0.08
        );
        const targetBlue = Math.min(
          1,
          modeColor.b +
            tokenBurst * 0.16 +
            audio.high * 0.08 +
            composerRipple * 0.12 +
            composerSourceGlow * 0.08
        );

        const r = colorValues[ix] ?? 0;
        const g = colorValues[ix + 1] ?? 0;
        const b = colorValues[ix + 2] ?? 0;

        colorValues[ix] = r + (targetRed - r) * 0.014;
        colorValues[ix + 1] = g + (targetGreen - g) * 0.014;
        colorValues[ix + 2] = b + (targetBlue - b) * 0.014;
      }

      if (geometry.attributes.position) {
        geometry.attributes.position.needsUpdate = true;
      }
      if (geometry.attributes.color) {
        geometry.attributes.color.needsUpdate = true;
      }

      const horizontalInfluence =
        sidebarInfluence * 0.74 - workbenchInfluence * 0.44;
      group.position.x = horizontalInfluence;
      group.position.y = composerImpulse * COMPOSER_CORE_PUSH;
      group.position.z = composerImpulse * 0.08;
      group.scale.setScalar(
        1.18 -
          connectingPull * 0.34 +
          speakingExpansion * 0.34 +
          sidebarInfluence * 0.04 +
          composerImpulse * COMPOSER_GROUP_SCALE
      );
      group.rotation.y =
        elapsed * (0.055 + orbitAcceleration * 0.44) +
        interaction.rotationY +
        sidebarInfluence * 0.42 -
        workbenchInfluence * 0.24 +
        composerImpulse * 0.032;
      group.rotation.x =
        Math.sin(elapsed * 0.22) * 0.08 +
        interaction.rotationX -
        sidebarInfluence * 0.08 +
        workbenchInfluence * 0.04 -
        composerImpulse * 0.045;
      camera.position.x = sidebarInfluence * 0.62 - workbenchInfluence * 0.34;
      camera.position.z = interaction.zoom - composerImpulse * COMPOSER_CAMERA_PUSH;
      camera.lookAt(
        sidebarInfluence * 0.28 - workbenchInfluence * 0.2,
        composerImpulse * 0.12,
        0
      );
      core.rotation.x = elapsed * 0.44;
      core.rotation.y = elapsed * 0.38;
      core.scale.setScalar(
        1 +
          breath * 0.42 +
          audio.low * 0.22 +
          tokenBurst * 0.035 +
          startupEnergy * 0.18 +
          composerImpulse * COMPOSER_CORE_SCALE
      );
      coreMaterial.opacity =
        0.34 + breath * 0.24 + tokenBurst * 0.06 + errorBurst * 0.18 + composerImpulse * 0.14;
      coreMaterial.color.lerp(
        errorBurst > 0.12 ? MODE_COLORS.error : modeColor,
        0.045
      );
      coreHalo.scale.setScalar(
        1 +
          audio.low * 0.5 +
          audio.rhythm * 0.28 +
          tokenBurst * 0.07 +
          startupEnergy * 0.34 +
          composerImpulse * COMPOSER_HALO_SCALE
      );
      haloMaterial.color.lerp(
        errorBurst > 0.12 ? MODE_COLORS.error : modeColor,
        0.04
      );
      haloMaterial.opacity = profile.advancedGlow
        ? 0.07 +
          breath * 0.14 +
          audioDrive * 0.16 +
          tokenBurst * 0.035 +
          composerImpulse * 0.14
        : 0.05 + breath * 0.08 + composerImpulse * 0.08;

      rings.forEach((ring, index) => {
        const waveform =
          Math.sin(elapsed * (2.8 + audio.mid * 3) + index * 1.8) *
          (audio.rhythm * 0.06 + currentSignal.speakingLevel * audio.high * 0.05);
        const phase =
          typeof ring.userData.phase === 'number' ? ring.userData.phase : 0;
        ring.rotation.z =
          phase + elapsed * (0.09 + index * 0.026 + audio.mid * 0.035);
        ring.scale.setScalar(
          0.88 +
            index * 0.12 -
            connectingPull * (0.7 + index * 0.08) +
            speakingExpansion * (0.8 + index * 0.12) +
            breath * (0.05 + index * 0.014) +
            waveform +
            tokenBurst * 0.012 +
            composerImpulse * (0.07 + index * 0.02)
        );
        const ringMat = ring.material as THREE.MeshBasicMaterial;
        ringMat.color.lerp(
          errorBurst > 0.12 ? MODE_COLORS.error : modeColor,
          0.025
        );
        ringMat.opacity = profile.advancedGlow
          ? 0.055 + breath * 0.05 + tokenBurst * 0.035 + composerImpulse * 0.06
          : 0.045 + breath * 0.035 + composerImpulse * 0.04;
      });

      material.size =
        0.022 +
        breath * 0.026 +
        audio.low * 0.008 +
        tokenBurst * 0.002 +
        startupEnergy * 0.004 +
        composerImpulse * 0.005;
      material.opacity =
        currentMode === 'error' || currentMode === 'connection_error'
          ? 0.82 + errorBurst * 0.12
          : currentMode === 'muted'
            ? 0.68
            : profile.advancedGlow
              ? 0.9 + composerImpulse * 0.08
              : 0.76 + composerImpulse * 0.08;
      renderer.render(scene, camera);
      scheduleNextFrame();
    };

    const handleVisibilityChange = (): void => {
      const nextVisible = document.visibilityState === 'visible';
      if (nextVisible === visible) {
        return;
      }
      visible = nextVisible;
      cancelScheduledFrame();
      scheduleNextFrame();
    };

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    host.addEventListener('pointerdown', handlePointerDown);
    host.addEventListener('pointermove', handlePointerMove);
    host.addEventListener('pointerup', stopDragging);
    host.addEventListener('pointercancel', stopDragging);
    host.addEventListener('lostpointercapture', handleLostPointerCapture);
    host.addEventListener('wheel', handleWheel, { passive: false });
    resize();
    animate();

    return () => {
      cancelScheduledFrame();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      host.removeEventListener('pointerdown', handlePointerDown);
      host.removeEventListener('pointermove', handlePointerMove);
      host.removeEventListener('pointerup', stopDragging);
      host.removeEventListener('pointercancel', stopDragging);
      host.removeEventListener('lostpointercapture', handleLostPointerCapture);
      host.removeEventListener('wheel', handleWheel);
      geometry.dispose();
      material.dispose();
      ringGeometry.dispose();
      rings.forEach((ring) => {
        (ring.material as THREE.Material).dispose();
      });
      coreGeometry.dispose();
      coreMaterial.dispose();
      haloGeometry.dispose();
      haloMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="particle-core"
      data-core-shell="wrapped"
      aria-label="ArcMind 3D 视觉"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none'
      }}
    />
  );
}
