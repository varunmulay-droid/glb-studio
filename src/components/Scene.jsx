/**
 * Scene.jsx
 * Three.js scene with:
 * - Multiple named cameras (stored in Zustand, rendered as visible objects)
 * - Camera-view mode: viewport switches to render through selected camera
 * - OrbitControls disabled when in camera-view mode
 * - Proper useThree() hooks for camera sync
 * - Dual controls (mouse + touch)
 * - Custom skybox / environment
 */
import { useRef, useEffect, Suspense, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  OrbitControls, Environment, Grid, GizmoHelper,
  GizmoViewport, ContactShadows, PerspectiveCamera,
} from '@react-three/drei'
import * as THREE from 'three'
import useStore   from '../store/useStore'
import ModelManager from './ModelManager'
import PhysicsEngine from './PhysicsEngine'

const CAM_ID = '__camera__'

// ── Lighting ───────────────────────────────────────────────────────────────────
function LightingRig() {
  const preset = useStore(s => s.lightingPreset)
  const configs = {
    studio:   { amb:[0.4,'#fff8f0'], key:{p:[5,8,3],   i:2,   c:'#fff5e0'}, fill:{p:[-4,4,-2],i:0.6,c:'#c0d8ff'}, rim:{p:[0,6,-6], i:0.8,c:'#ffefcc'} },
    outdoor:  { amb:[0.6,'#b0c8ff'], key:{p:[10,20,5], i:3,   c:'#fff8e1'}, fill:{p:[-8,5,-3],i:0.4,c:'#d0e8ff'}, rim:{p:[0,8,-8], i:0.3,c:'#90b8ff'} },
    dramatic: { amb:[0.1,'#1a1a2e'], key:{p:[3,10,2],  i:4,   c:'#ff6020'}, fill:{p:[-6,2,-2],i:0.2,c:'#200840'}, rim:{p:[0,4,-8], i:1.2,c:'#8040ff'} },
    neon:     { amb:[0.15,'#0a0020'],key:{p:[5,6,3],   i:2,   c:'#00ffff'}, fill:{p:[-5,3,-3],i:1.5,c:'#ff00aa'}, rim:{p:[0,8,-6], i:1.0,c:'#aaff00'} },
  }
  const cfg = configs[preset] || configs.studio
  return (
    <>
      <ambientLight intensity={cfg.amb[0]} color={cfg.amb[1]} />
      <directionalLight position={cfg.key.p} intensity={cfg.key.i} color={cfg.key.c} castShadow
        shadow-mapSize={[2048,2048]} shadow-camera-near={0.1} shadow-camera-far={100}
        shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />
      <directionalLight position={cfg.fill.p} intensity={cfg.fill.i} color={cfg.fill.c} />
      <directionalLight position={cfg.rim.p}  intensity={cfg.rim.i}  color={cfg.rim.c} />
    </>
  )
}

// ── Skybox ────────────────────────────────────────────────────────────────────
function CustomSkybox() {
  const skybox = useStore(s => s.skybox)
  const { scene, gl } = useThree()
  useEffect(() => {
    let tex = null
    const apply = async () => {
      if (!skybox.showBg || skybox.type === 'color' || !skybox.value) {
        scene.background = new THREE.Color(skybox.bgColor || '#080810')
        return
      }
      if (skybox.type === 'hdr') {
        const { RGBELoader } = await import('three/examples/jsm/loaders/RGBELoader.js')
        new RGBELoader().load(skybox.value, t => {
          t.mapping = THREE.EquirectangularReflectionMapping
          scene.background = scene.environment = tex = t
        })
      } else {
        new THREE.TextureLoader().load(skybox.value, t => {
          t.mapping = THREE.EquirectangularReflectionMapping
          t.colorSpace = THREE.SRGBColorSpace
          scene.background = scene.environment = tex = t
        })
      }
    }
    apply()
    return () => { if (tex) tex.dispose() }
  }, [skybox, scene, gl])
  return null
}

function PresetEnvironment() {
  const skybox        = useStore(s => s.skybox)
  const lightingPreset = useStore(s => s.lightingPreset)
  if (skybox.type !== 'preset') return null
  const map = { studio:'studio', outdoor:'park', dramatic:'night', neon:'warehouse' }
  return <Environment preset={map[lightingPreset]||'studio'} background={skybox.showBg} blur={0.6} />
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

// ── Deselect on empty click ────────────────────────────────────────────────────
function ClickDeselect() {
  const { selectModel } = useStore()
  return (
    <mesh position={[0,-200,0]} onClick={() => selectModel(null)}>
      <planeGeometry args={[2000,2000]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  )
}

// ── Playback ──────────────────────────────────────────────────────────────────
function PlaybackController() {
  const { isPlaying, currentFrame, totalFrames, fps, setCurrentFrame, setIsPlaying } = useStore()
  const acc = useRef(0)
  useFrame((_, delta) => {
    if (!isPlaying) return
    acc.current += delta
    if (acc.current >= 1/fps) {
      acc.current = 0
      const next = currentFrame + 1
      if (next >= totalFrames) { setIsPlaying(false); setCurrentFrame(0) }
      else setCurrentFrame(next)
    }
  })
  return null
}

// ── Camera objects rendered in scene ──────────────────────────────────────────
function CameraObjects() {
  const cameras      = useStore(s => s.cameras)
  const activeCamId  = useStore(s => s.activeCameraId)
  const inView       = useStore(s => s.inCameraView)
  const { selectCamera } = { selectCamera: (id) => useStore.getState().setActiveCameraId(id) }

  return (
    <>
      {cameras.map(cam => {
        const isActive = cam.id === activeCamId
        const pos = cam.position || [0,2,5]
        const tgt = cam.target   || [0,0,0]
        // Direction arrow
        const dir = new THREE.Vector3(
          tgt[0]-pos[0], tgt[1]-pos[1], tgt[2]-pos[2]
        ).normalize()

        return (
          <group key={cam.id} position={pos}
            onClick={e => { e.stopPropagation(); useStore.getState().setActiveCameraId(cam.id) }}>
            {/* Camera body */}
            <mesh>
              <boxGeometry args={[0.25,0.18,0.35]} />
              <meshStandardMaterial
                color={isActive ? '#4f8eff' : '#888'}
                emissive={isActive ? '#4f8eff' : '#000'}
                emissiveIntensity={isActive ? 0.4 : 0}
                roughness={0.3} metalness={0.7}
              />
            </mesh>
            {/* Lens */}
            <mesh position={[0,0,-0.22]}>
              <cylinderGeometry args={[0.06,0.08,0.1,12]} />
              <meshStandardMaterial color={isActive ? '#00f0ff' : '#444'} emissive={isActive ? '#00f0ff' : '#000'} emissiveIntensity={0.3} />
            </mesh>
            {/* Viewfinder cone (shows FOV) */}
            {isActive && (
              <mesh position={[0,0,-0.5]} rotation={[Math.PI/2,0,0]}>
                <coneGeometry args={[0.4,0.8,4,1,true]} />
                <meshBasicMaterial color="#4f8eff" wireframe transparent opacity={0.25} />
              </mesh>
            )}
            {/* Label */}
            {isActive && (
              <mesh position={[0,0.25,0]}>
                <planeGeometry args={[0.8,0.18]} />
                <meshBasicMaterial color="#4f8eff" transparent opacity={0.8} />
              </mesh>
            )}
          </group>
        )
      })}
    </>
  )
}

// ── Camera sync: applies active camera to R3F default camera ──────────────────
function CameraSync() {
  const { camera, set: setThree, gl } = useThree()
  const cameras    = useStore(s => s.cameras)
  const activeCamId = useStore(s => s.activeCameraId)
  const inView      = useStore(s => s.inCameraView)
  const currentFrame = useStore(s => s.currentFrame)
  const keyframes    = useStore(s => s.keyframes)

  // Apply active camera transform to the R3F camera
  useFrame(() => {
    if (!inView || !activeCamId) return

    // First check keyframe interpolation for this camera
    const camKf = getCamKeyframesForId(activeCamId, keyframes)
    const interp = interpolateCamAt(camKf, currentFrame)

    const camData = interp
      || cameras.find(c => c.id === activeCamId)
      || null

    if (!camData) return

    const pos = camData.position || camData.pos || [5,3,5]
    const tgt = camData.target   || camData.tar || [0,0,0]
    const fov = camData.fov      || 50

    camera.position.set(...(Array.isArray(pos) ? pos : [pos.x,pos.y,pos.z]))
    camera.lookAt(...(Array.isArray(tgt) ? tgt : [tgt.x,tgt.y,tgt.z]))
    if (camera.fov !== fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  })

  return null
}

// Helpers for camera keyframe interpolation
function getCamKeyframesForId(camId, keyframes) {
  const key = `__cam_${camId}__`
  return Object.entries(keyframes)
    .filter(([,v]) => v[key])
    .map(([f,v]) => ({ frame:parseInt(f), data:v[key] }))
    .sort((a,b)=>a.frame-b.frame)
}

function interpolateCamAt(keys, frame) {
  if (!keys.length) return null
  const before = keys.filter(k=>k.frame<=frame)
  const after  = keys.filter(k=>k.frame>frame)
  if (!before.length) return keys[0].data
  if (!after.length)  return keys[keys.length-1].data
  const k0=before[before.length-1], k1=after[0]
  const t=(frame-k0.frame)/(k1.frame-k0.frame)
  const lerp=(a,b,t)=>a+(b-a)*t
  const lv=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],t))
  return {
    position: lv(k0.data.position,k1.data.position,t),
    target:   lv(k0.data.target,  k1.data.target,  t),
    fov:      lerp(k0.data.fov,k1.data.fov,t),
  }
}

// ── Fly camera controls (keyboard + touch, only when in free-fly mode) ────────
function FlyCameraControls() {
  const inView     = useStore(s => s.inCameraView)
  const activeCamId = useStore(s => s.activeCameraId)
  const { camera, gl } = useThree()

  const keys   = useRef({})
  const drag   = useRef({ on:false, lx:0, ly:0 })
  const yaw    = useRef(Math.atan2(5,5))
  const pitch  = useRef(-0.3)
  const spd    = useRef(0.08)
  const active = inView && !!activeCamId

  useEffect(() => {
    if (!active) return
    const onKD = e => { keys.current[e.code]=true  }
    const onKU = e => { keys.current[e.code]=false }
    const onMD = e => { drag.current={on:true,lx:e.clientX,ly:e.clientY} }
    const onMU = () => { drag.current.on=false }
    const onMM = e => {
      if (!drag.current.on) return
      yaw.current   -= (e.clientX-drag.current.lx)*0.003
      pitch.current  = Math.max(-1.4,Math.min(1.4,pitch.current-(e.clientY-drag.current.ly)*0.003))
      drag.current.lx=e.clientX; drag.current.ly=e.clientY
    }
    const onWheel = e => { spd.current=Math.max(0.01,Math.min(2,spd.current*(1-e.deltaY*0.001))) }

    // Touch
    let lt=[]
    const onTS=e=>{ lt=Array.from(e.touches); if(lt.length===1) drag.current={on:true,lx:lt[0].clientX,ly:lt[0].clientY} }
    const onTM=e=>{ if(e.touches.length===1&&drag.current.on){
      yaw.current-=(e.touches[0].clientX-drag.current.lx)*0.004
      pitch.current=Math.max(-1.4,Math.min(1.4,pitch.current-(e.touches[0].clientY-drag.current.ly)*0.004))
      drag.current.lx=e.touches[0].clientX; drag.current.ly=e.touches[0].clientY
    }}
    const onTE=()=>{ drag.current.on=false }

    window.addEventListener('keydown',onKD); window.addEventListener('keyup',onKU)
    gl.domElement.addEventListener('mousedown',onMD)
    window.addEventListener('mouseup',onMU); window.addEventListener('mousemove',onMM)
    gl.domElement.addEventListener('wheel',onWheel,{passive:true})
    gl.domElement.addEventListener('touchstart',onTS,{passive:true})
    gl.domElement.addEventListener('touchmove',onTM,{passive:true})
    gl.domElement.addEventListener('touchend',onTE)
    return ()=>{
      window.removeEventListener('keydown',onKD); window.removeEventListener('keyup',onKU)
      gl.domElement.removeEventListener('mousedown',onMD)
      window.removeEventListener('mouseup',onMU); window.removeEventListener('mousemove',onMM)
      gl.domElement.removeEventListener('wheel',onWheel)
      gl.domElement.removeEventListener('touchstart',onTS)
      gl.domElement.removeEventListener('touchmove',onTM)
      gl.domElement.removeEventListener('touchend',onTE)
    }
  }, [active, gl])

  useFrame(() => {
    if (!active) return
    const s = spd.current
    const fwd = new THREE.Vector3(
      Math.sin(yaw.current)*Math.cos(pitch.current),
      Math.sin(pitch.current),
      Math.cos(yaw.current)*Math.cos(pitch.current)
    )
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0,1,0)).normalize()
    if (keys.current.KeyW||keys.current.ArrowUp)    camera.position.addScaledVector(fwd,   s)
    if (keys.current.KeyS||keys.current.ArrowDown)  camera.position.addScaledVector(fwd,  -s)
    if (keys.current.KeyA||keys.current.ArrowLeft)  camera.position.addScaledVector(right,-s)
    if (keys.current.KeyD||keys.current.ArrowRight) camera.position.addScaledVector(right, s)
    if (keys.current.KeyQ||keys.current.KeyZ)       camera.position.y -= s
    if (keys.current.KeyE||keys.current.KeyX)       camera.position.y += s
    camera.lookAt(camera.position.x+fwd.x, camera.position.y+fwd.y, camera.position.z+fwd.z)

    // Write back to store so the camera object in scene moves too
    const pos = camera.position
    const tgt = new THREE.Vector3().copy(pos).add(fwd.multiplyScalar(5))
    useStore.getState().updateCamera(activeCamId, {
      position:[pos.x,pos.y,pos.z],
      target:[tgt.x,tgt.y,tgt.z],
    })
  })

  return null
}

// ── Dual OrbitControls ────────────────────────────────────────────────────────
function DualOrbitControls() {
  const inView = useStore(s => s.inCameraView)
  if (inView) return null   // Disable orbit when in camera-view
  return (
    <OrbitControls makeDefault enableDamping dampingFactor={0.06}
      minDistance={0.3} maxDistance={200}
      touches={{ ONE:THREE.TOUCH.ROTATE, TWO:THREE.TOUCH.DOLLY_PAN }}
      mouseButtons={{ LEFT:THREE.MOUSE.ROTATE, MIDDLE:THREE.MOUSE.DOLLY, RIGHT:THREE.MOUSE.PAN }}
      enablePan screenSpacePanning />
  )
}

// ── Camera view overlay HUD ────────────────────────────────────────────────────
function CameraHUD() {
  const inView     = useStore(s => s.inCameraView)
  const activeCamId = useStore(s => s.activeCameraId)
  const cameras    = useStore(s => s.cameras)
  const cam        = cameras.find(c=>c.id===activeCamId)
  if (!inView || !cam) return null
  return (
    <div style={{
      position:'absolute', inset:0, pointerEvents:'none',
      border:'2px solid rgba(79,142,255,0.5)',
      boxShadow:'inset 0 0 40px rgba(79,142,255,0.08)',
    }}>
      {/* Corner brackets */}
      {['topleft','topright','bottomleft','bottomright'].map(corner => (
        <div key={corner} style={{
          position:'absolute',
          top:    corner.includes('top')    ?  8 : 'auto',
          bottom: corner.includes('bottom') ?  8 : 'auto',
          left:   corner.includes('left')   ?  8 : 'auto',
          right:  corner.includes('right')  ?  8 : 'auto',
          width:20, height:20,
          borderTop:    corner.includes('top')    ? '2px solid rgba(79,142,255,0.8)' : 'none',
          borderBottom: corner.includes('bottom') ? '2px solid rgba(79,142,255,0.8)' : 'none',
          borderLeft:   corner.includes('left')   ? '2px solid rgba(79,142,255,0.8)' : 'none',
          borderRight:  corner.includes('right')  ? '2px solid rgba(79,142,255,0.8)' : 'none',
        }}/>
      ))}
      {/* Camera label */}
      <div style={{
        position:'absolute', top:12, left:'50%', transform:'translateX(-50%)',
        background:'rgba(79,142,255,0.15)', border:'1px solid rgba(79,142,255,0.4)',
        borderRadius:4, padding:'3px 10px',
        fontSize:11, color:'rgba(79,142,255,0.9)',
        fontFamily:'var(--font-mono)', letterSpacing:'0.08em',
        backdropFilter:'blur(4px)',
      }}>🎥 {cam.name} · FOV {cam.fov}°</div>
      {/* Center crosshair */}
      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
        width:16, height:16 }}>
        <div style={{ position:'absolute', top:'50%', left:0, right:0, height:1, background:'rgba(79,142,255,0.5)' }}/>
        <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:1, background:'rgba(79,142,255,0.5)' }}/>
      </div>
      {/* Controls hint */}
      <div style={{
        position:'absolute', bottom:12, left:'50%', transform:'translateX(-50%)',
        fontSize:10, color:'rgba(79,142,255,0.6)',
        fontFamily:'var(--font-mono)', letterSpacing:'0.06em',
        background:'rgba(0,0,0,0.3)', padding:'2px 8px', borderRadius:3,
      }}>WASD·move  Q/E·up-down  drag·look</div>
    </div>
  )
}

// ── Main Scene export ──────────────────────────────────────────────────────────
export default function Scene({ canvasRef }) {
  return (
    <div style={{ position:'absolute', inset:0 }}>
      <Canvas
        ref={canvasRef}
        shadows
        dpr={[1, Math.min(window.devicePixelRatio, 2)]}
        gl={{
          antialias:true, preserveDrawingBuffer:true,
          outputColorSpace:THREE.SRGBColorSpace,
          toneMapping:THREE.ACESFilmicToneMapping,
          toneMappingExposure:1.2,
          powerPreference:'high-performance',
        }}
        style={{ width:'100%', height:'100%' }}
        onCreated={({ gl }) => { gl.domElement.style.touchAction='none' }}
      >
        <PerspectiveCamera makeDefault position={[5,3,5]} fov={50} near={0.01} far={1000} />

        <Suspense fallback={null}>
          <CustomSkybox />
          <PresetEnvironment />
          <LightingRig />
          <SceneFloor />
          <ClickDeselect />
          <ModelManager />
          <CameraObjects />
          <PlaybackController />
          <CameraSync />
          <FlyCameraControls />
        </Suspense>

        <DualOrbitControls />

        <GizmoHelper alignment="bottom-right" margin={[80,90]}>
          <GizmoViewport axisColors={['#ff4060','#40ff80','#4080ff']} labelColor="#fff" />
        </GizmoHelper>

        <PhysicsEngine />
      </Canvas>

      {/* Camera HUD overlay */}
      <CameraHUD />
    </div>
  )
}
