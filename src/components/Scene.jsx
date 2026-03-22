import { useRef, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  OrbitControls, Environment, Grid, GizmoHelper, GizmoViewport,
  ContactShadows, PerspectiveCamera, Stats
} from '@react-three/drei'
import * as THREE from 'three'
import useStore from '../store/useStore'
import ModelManager from './ModelManager'

function LightingRig() {
  const preset = useStore(s => s.lightingPreset)

  const configs = {
    studio: {
      ambient: [0.4, '#fff8f0'],
      key: { pos: [5, 8, 3], intensity: 2, color: '#fff5e0' },
      fill: { pos: [-4, 4, -2], intensity: 0.6, color: '#c0d8ff' },
      rim: { pos: [0, 6, -6], intensity: 0.8, color: '#ffefcc' },
    },
    outdoor: {
      ambient: [0.6, '#b0c8ff'],
      key: { pos: [10, 20, 5], intensity: 3, color: '#fff8e1' },
      fill: { pos: [-8, 5, -3], intensity: 0.4, color: '#d0e8ff' },
      rim: { pos: [0, 8, -8], intensity: 0.3, color: '#90b8ff' },
    },
    dramatic: {
      ambient: [0.1, '#1a1a2e'],
      key: { pos: [3, 10, 2], intensity: 4, color: '#ff6020' },
      fill: { pos: [-6, 2, -2], intensity: 0.2, color: '#200840' },
      rim: { pos: [0, 4, -8], intensity: 1.2, color: '#8040ff' },
    },
    neon: {
      ambient: [0.15, '#0a0020'],
      key: { pos: [5, 6, 3], intensity: 2, color: '#00ffff' },
      fill: { pos: [-5, 3, -3], intensity: 1.5, color: '#ff00aa' },
      rim: { pos: [0, 8, -6], intensity: 1, color: '#aaff00' },
    },
  }

  const cfg = configs[preset] || configs.studio

  return (
    <>
      <ambientLight intensity={cfg.ambient[0]} color={cfg.ambient[1]} />
      <directionalLight
        position={cfg.key.pos} intensity={cfg.key.intensity}
        color={cfg.key.color} castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.1}
        shadow-camera-far={100}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <directionalLight position={cfg.fill.pos} intensity={cfg.fill.intensity} color={cfg.fill.color} />
      <directionalLight position={cfg.rim.pos} intensity={cfg.rim.intensity} color={cfg.rim.color} />
    </>
  )
}

function PlaybackController() {
  const { isPlaying, currentFrame, totalFrames, fps, setCurrentFrame, setIsPlaying } = useStore()
  const lastTime = useRef(0)
  const frameTime = useRef(0)

  useFrame((_, delta) => {
    if (!isPlaying) return
    frameTime.current += delta
    const frameDuration = 1 / fps
    if (frameTime.current >= frameDuration) {
      frameTime.current = 0
      const next = currentFrame + 1
      if (next >= totalFrames) {
        setIsPlaying(false)
        setCurrentFrame(0)
      } else {
        setCurrentFrame(next)
      }
    }
  })

  return null
}

function SceneFloor() {
  return (
    <>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#0d0d1a" roughness={0.9} />
      </mesh>
      <Grid
        args={[30, 30]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1a1a3a"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#2a2a5a"
        fadeDistance={30}
        fadeStrength={1}
        position={[0, 0, 0]}
      />
      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.4}
        scale={20}
        blur={2}
        far={4}
        color="#000033"
      />
    </>
  )
}

function ClickDeselect() {
  const { selectModel } = useStore()
  return (
    <mesh
      position={[0, -100, 0]}
      onClick={() => selectModel(null)}
    >
      <planeGeometry args={[1000, 1000]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  )
}

export default function Scene({ canvasRef }) {
  const lightingPreset = useStore(s => s.lightingPreset)

  const envMap = {
    studio: 'studio',
    outdoor: 'park',
    dramatic: 'night',
    neon: 'warehouse',
  }

  return (
    <Canvas
      ref={canvasRef}
      shadows
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        preserveDrawingBuffer: true,
        outputColorSpace: THREE.SRGBColorSpace,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2,
      }}
      style={{ background: '#080810' }}
    >
      <PerspectiveCamera makeDefault position={[5, 3, 5]} fov={50} near={0.01} far={1000} />

      <Suspense fallback={null}>
        <LightingRig />
        <SceneFloor />
        <ClickDeselect />
        <ModelManager />
        <PlaybackController />

        <Environment
          preset={envMap[lightingPreset] || 'studio'}
          background={false}
          blur={0.8}
        />
      </Suspense>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={0.5}
        maxDistance={100}
        touches={{
          ONE: 2, // ROTATE
          TWO: 1, // DOLLY_PAN
        }}
        mouseButtons={{
          LEFT: 2, // ROTATE
          MIDDLE: 1, // DOLLY
          RIGHT: 0, // PAN
        }}
      />

      <GizmoHelper alignment="bottom-right" margin={[70, 80]}>
        <GizmoViewport
          axisColors={['#ff4060', '#40ff80', '#4080ff']}
          labelColor="#ffffff"
        />
      </GizmoHelper>
    </Canvas>
  )
}
