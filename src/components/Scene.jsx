import { useRef, useEffect, Suspense, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  OrbitControls, Environment, Grid, GizmoHelper, GizmoViewport,
  ContactShadows, PerspectiveCamera, useTexture,
} from '@react-three/drei'
import * as THREE from 'three'
import useStore from '../store/useStore'
import PhysicsEngine from './PhysicsEngine'
import ModelManager from './ModelManager'

// ── Lighting ──────────────────────────────────────────────────────────────────
function LightingRig() {
  const preset = useStore(s => s.lightingPreset)
  const configs = {
    studio:   { amb:[0.4,'#fff8f0'], key:{pos:[5,8,3],   int:2,   col:'#fff5e0'}, fill:{pos:[-4,4,-2], int:0.6, col:'#c0d8ff'}, rim:{pos:[0,6,-6],  int:0.8, col:'#ffefcc'} },
    outdoor:  { amb:[0.6,'#b0c8ff'], key:{pos:[10,20,5], int:3,   col:'#fff8e1'}, fill:{pos:[-8,5,-3], int:0.4, col:'#d0e8ff'}, rim:{pos:[0,8,-8],  int:0.3, col:'#90b8ff'} },
    dramatic: { amb:[0.1,'#1a1a2e'], key:{pos:[3,10,2],  int:4,   col:'#ff6020'}, fill:{pos:[-6,2,-2], int:0.2, col:'#200840'}, rim:{pos:[0,4,-8],  int:1.2, col:'#8040ff'} },
    neon:     { amb:[0.15,'#0a0020'],key:{pos:[5,6,3],   int:2,   col:'#00ffff'}, fill:{pos:[-5,3,-3], int:1.5, col:'#ff00aa'}, rim:{pos:[0,8,-6],  int:1.0, col:'#aaff00'} },
  }
  const cfg = configs[preset] || configs.studio
  return (
    <>
      <ambientLight intensity={cfg.amb[0]} color={cfg.amb[1]} />
      <directionalLight position={cfg.key.pos} intensity={cfg.key.int} color={cfg.key.col} castShadow
        shadow-mapSize={[2048,2048]} shadow-camera-near={0.1} shadow-camera-far={100}
        shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />
      <directionalLight position={cfg.fill.pos} intensity={cfg.fill.int} color={cfg.fill.col} />
      <directionalLight position={cfg.rim.pos}  intensity={cfg.rim.int}  color={cfg.rim.col}  />
    </>
  )
}

// ── Custom skybox (image or solid color) ──────────────────────────────────────
function CustomSkybox() {
  const skybox = useStore(s => s.skybox)
  const { scene, gl } = useThree()

  useEffect(() => {
    let disposed = false
    let tex = null

    const apply = async () => {
      if (!skybox.showBg || skybox.type === 'color' || !skybox.value) {
        scene.background = new THREE.Color(skybox.bgColor || '#080810')
        return
      }

      if (skybox.type === 'hdr') {
        // Lazy import RGBELoader from three/examples
        const { RGBELoader } = await import('three/examples/jsm/loaders/RGBELoader.js')
        new RGBELoader().load(skybox.value, (t) => {
          if (disposed) { t.dispose(); return }
          t.mapping = THREE.EquirectangularReflectionMapping
          scene.background = t
          scene.environment = t
          tex = t
        })
      } else {
        new THREE.TextureLoader().load(skybox.value, (t) => {
          if (disposed) { t.dispose(); return }
          t.mapping = THREE.EquirectangularReflectionMapping
          t.colorSpace = THREE.SRGBColorSpace
          scene.background = t
          scene.environment = t
          tex = t
        })
      }
    }

    apply()
    return () => {
      disposed = true
      if (tex) tex.dispose()
    }
  }, [skybox, scene, gl])

  return null
}

// ── Preset environment (when no custom skybox) ────────────────────────────────
function PresetEnvironment() {
  const skybox        = useStore(s => s.skybox)
  const lightingPreset = useStore(s => s.lightingPreset)
  if (skybox.type !== 'preset') return null
  const envMap = { studio:'studio', outdoor:'park', dramatic:'night', neon:'warehouse' }
  return (
    <Environment
      preset={envMap[lightingPreset] || 'studio'}
      background={skybox.showBg}
      blur={0.6}
    />
  )
}

// ── Playback ──────────────────────────────────────────────────────────────────
function PlaybackController() {
  const { isPlaying, currentFrame, totalFrames, fps, setCurrentFrame, setIsPlaying } = useStore()
  const acc = useRef(0)
  useFrame((_, delta) => {
    if (!isPlaying) return
    acc.current += delta
    if (acc.current >= 1 / fps) {
      acc.current = 0
      const next = currentFrame + 1
      if (next >= totalFrames) { setIsPlaying(false); setCurrentFrame(0) }
      else setCurrentFrame(next)
    }
  })
  return null
}

// ── Floor + Grid ──────────────────────────────────────────────────────────────
function SceneFloor() {
  return (
    <>
      <mesh receiveShadow rotation={[-Math.PI/2,0,0]} position={[0,-0.01,0]}>
        <planeGeometry args={[100,100]} />
        <meshStandardMaterial color="#0d0d1a" roughness={0.9} />
      </mesh>
      <Grid args={[40,40]} cellSize={1} cellThickness={0.4} cellColor="#1a1a3a"
        sectionSize={5} sectionThickness={1} sectionColor="#2a2a5a"
        fadeDistance={50} fadeStrength={1} />
      <ContactShadows position={[0,0,0]} opacity={0.5} scale={30} blur={2} far={5} color="#000033" />
    </>
  )
}

// ── Deselect on empty click ───────────────────────────────────────────────────
function ClickDeselect() {
  const { selectModel } = useStore()
  return (
    <mesh position={[0,-200,0]} onClick={() => selectModel(null)}>
      <planeGeometry args={[2000,2000]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  )
}

// ── Dual OrbitControls: separate mouse and touch mappings ─────────────────────
function DualOrbitControls() {
  // Detect if user is on a touch device
  const isTouch = useRef('ontouchstart' in window || navigator.maxTouchPoints > 0)

  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={0.06}
      minDistance={0.3}
      maxDistance={200}
      zoomSpeed={isTouch.current ? 0.5 : 1.2}
      rotateSpeed={isTouch.current ? 0.6 : 0.8}
      panSpeed={isTouch.current ? 0.6 : 0.8}
      // Touch: ONE finger = rotate, TWO fingers = dolly+pan
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      // Mouse: LEFT = rotate, MIDDLE = dolly, RIGHT = pan
      mouseButtons={{
        LEFT:   THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT:  THREE.MOUSE.PAN,
      }}
      // Mobile-friendly: enable panning on touch
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      // Smoother on mobile
      screenSpacePanning={true}
    />
  )
}

// ── Main Scene ────────────────────────────────────────────────────────────────
export default function Scene({ canvasRef }) {
  return (
    <Canvas
      ref={canvasRef}
      shadows
      dpr={[1, Math.min(window.devicePixelRatio, 2)]}
      gl={{
        antialias: true,
        preserveDrawingBuffer: true,
        outputColorSpace: THREE.SRGBColorSpace,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2,
        powerPreference: 'high-performance',
      }}
      style={{ width: '100%', height: '100%', display: 'block' }}
      // Prevent default touch behavior (scroll) on canvas
      onCreated={({ gl }) => {
        gl.domElement.style.touchAction = 'none'
      }}
    >
      <PerspectiveCamera makeDefault position={[5, 3, 5]} fov={50} near={0.01} far={1000} />

      <Suspense fallback={null}>
        <CustomSkybox />
        <PresetEnvironment />
        <LightingRig />
        <SceneFloor />
        <ClickDeselect />
        <ModelManager />
        <PlaybackController />
      </Suspense>

      <DualOrbitControls />
      <PhysicsEngine />

      <GizmoHelper alignment="bottom-right" margin={[80, 90]}>
        <GizmoViewport axisColors={['#ff4060','#40ff80','#4080ff']} labelColor="#ffffff" />
      </GizmoHelper>
    </Canvas>
  )
}
