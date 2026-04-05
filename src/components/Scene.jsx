/**
 * Scene.jsx — Clean render mode: during export/recording, ALL editor helpers
 * (grid, gizmos, selection rings, camera markers, transform controls, HUD)
 * are automatically hidden. Only models + lighting + environment render.
 */
import { useRef, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  OrbitControls, Environment, Grid, GizmoHelper,
  GizmoViewport, ContactShadows, PerspectiveCamera,
} from '@react-three/drei'
import * as THREE from 'three'
import useStore    from '../store/useStore'
import ModelManager from './ModelManager'
import PhysicsEngine from './PhysicsEngine'

// ── Lighting ────────────────────────────────────────────────────────────────
function LightingRig() {
  const preset = useStore(s => s.lightingPreset) || 'studio'
  const configs = {
    studio:   { amb:[0.4,'#fff8f0'], key:{p:[5,8,3],   i:2, c:'#fff5e0'}, fill:{p:[-4,4,-2],i:0.6,c:'#c0d8ff'}, rim:{p:[0,6,-6], i:0.8,c:'#ffefcc'} },
    outdoor:  { amb:[0.6,'#b0c8ff'], key:{p:[10,20,5], i:3, c:'#fff8e1'}, fill:{p:[-8,5,-3],i:0.4,c:'#d0e8ff'}, rim:{p:[0,8,-8], i:0.3,c:'#90b8ff'} },
    dramatic: { amb:[0.1,'#1a1a2e'], key:{p:[3,10,2],  i:4, c:'#ff6020'}, fill:{p:[-6,2,-2],i:0.2,c:'#200840'}, rim:{p:[0,4,-8], i:1.2,c:'#8040ff'} },
    neon:     { amb:[0.15,'#0a0020'],key:{p:[5,6,3],   i:2, c:'#00ffff'}, fill:{p:[-5,3,-3],i:1.5,c:'#ff00aa'}, rim:{p:[0,8,-6], i:1.0,c:'#aaff00'} },
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

// ── Dynamic scene lights from store ──────────────────────────────────────────
function SceneLights() {
  const lights = useStore(s => s.sceneLights) || []
  return (
    <>
      {lights.filter(l=>l.visible).map(l => {
        const pos  = l.position || [0,5,0]
        const tgt  = l.target   || [0,0,0]
        const col  = l.color    || '#ffffff'
        const int  = l.intensity ?? 1
        const sms  = l.shadowMapSize || 1024

        if (l.type==='ambient') return (
          <ambientLight key={l.id} color={col} intensity={int} />
        )
        if (l.type==='hemisphere') return (
          <hemisphereLight key={l.id} args={[l.skyColor||'#88aaff', l.groundColor||'#443322', int]} />
        )
        if (l.type==='directional') return (
          <directionalLight key={l.id} color={col} intensity={int}
            position={pos} castShadow={!!l.castShadow}
            shadow-mapSize={[sms,sms]} shadow-camera-near={0.1} shadow-camera-far={200}
            shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30}>
            {l.castShadow && <directionalLightHelper args={[null,1]} />}
          </directionalLight>
        )
        if (l.type==='point') return (
          <pointLight key={l.id} color={col} intensity={int} position={pos}
            distance={l.distance||0} castShadow={!!l.castShadow}
            shadow-mapSize={[sms,sms]} />
        )
        if (l.type==='spot') return (
          <spotLight key={l.id} color={col} intensity={int} position={pos}
            angle={l.angle||0.4} penumbra={l.penumbra||0.2}
            distance={l.distance||0} castShadow={!!l.castShadow}
            shadow-mapSize={[sms,sms]}
            target-position={tgt} />
        )
        return null
      })}
    </>
  )
}

// ── Skybox ──────────────────────────────────────────────────────────────────
function SkyboxApplier() {
  const skybox = useStore(s => s.skybox) || {}
  const { scene, gl } = useThree()
  useEffect(() => {
    if (!skybox.showBg || skybox.type === 'color' || !skybox.value) {
      scene.background = new THREE.Color(skybox.bgColor || '#080810')
      return
    }
    let disposed = false, tex = null
    const apply = async () => {
      try {
        if (skybox.type === 'hdr') {
          const { RGBELoader } = await import('three/examples/jsm/loaders/RGBELoader.js')
          new RGBELoader().load(skybox.value, t => {
            if (disposed) return t.dispose()
            t.mapping = THREE.EquirectangularReflectionMapping
            scene.background = scene.environment = tex = t
          })
        } else {
          new THREE.TextureLoader().load(skybox.value, t => {
            if (disposed) return t.dispose()
            t.mapping = THREE.EquirectangularReflectionMapping
            t.colorSpace = THREE.SRGBColorSpace
            scene.background = scene.environment = tex = t
          })
        }
      } catch(e) { console.warn('[Skybox]', e) }
    }
    apply()
    return () => { disposed = true; tex?.dispose() }
  }, [skybox, scene, gl])
  return null
}

function PresetEnv() {
  const skybox = useStore(s => s.skybox) || {}
  const preset = useStore(s => s.lightingPreset) || 'studio'
  if (skybox.type !== 'preset') return null
  const map = { studio:'studio', outdoor:'park', dramatic:'night', neon:'warehouse' }
  return <Environment preset={map[preset]||'studio'} background={!!skybox.showBg} blur={0.6} />
}

// ── Floor / Grid  (hidden in render mode) ───────────────────────────────────
function Floor() {
  const isRender = useStore(s => s.isRenderMode || s.isExporting)
  const showGrid = useStore(s => s.showGrid)
  const showCS   = useStore(s => s.showContactShadows)
  return (
    <>
      {/* Floor plane always visible (blends with background) */}
      <mesh receiveShadow rotation={[-Math.PI/2,0,0]} position={[0,-0.01,0]}>
        <planeGeometry args={[200,200]} />
        <meshStandardMaterial color="#0d0d1a" roughness={0.95} />
      </mesh>
      {/* Editor-only helpers */}
      {!isRender && showGrid && (
        <Grid args={[40,40]} cellSize={1} cellThickness={0.4} cellColor="#1a1a3a"
          sectionSize={5} sectionThickness={1} sectionColor="#2a2a5a" fadeDistance={50} />
      )}
      {!isRender && showCS && (
        <ContactShadows opacity={0.4} scale={30} blur={2} far={5} color="#000033" />
      )}
    </>
  )
}

// ── Deselect ─────────────────────────────────────────────────────────────────
function Deselect() {
  const isRender = useStore(s => s.isRenderMode || s.isExporting)
  if (isRender) return null
  return (
    <mesh position={[0,-500,0]} onClick={()=>useStore.getState().selectModel(null)}>
      <planeGeometry args={[5000,5000]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  )
}

// ── Playback ──────────────────────────────────────────────────────────────────
function Playback() {
  const acc = useRef(0)
  useFrame((_, delta) => {
    const s = useStore.getState()
    if (!s.isPlaying) return
    acc.current += delta
    if (acc.current >= 1/(s.fps||30)) {
      acc.current = 0
      const next = s.currentFrame + 1
      if (next >= s.totalFrames) {
        if (s.loopPlayback) s.setCurrentFrame(0)
        else { s.setIsPlaying(false); s.setCurrentFrame(0) }
      } else s.setCurrentFrame(next)
    }
  })
  return null
}

// ── Camera markers (hidden in render mode) ───────────────────────────────────
function CameraMarkers() {
  const cameras        = useStore(s => s.cameras) || []
  const activeCamId    = useStore(s => s.activeCameraId)
  const selectedCamId  = useStore(s => s.selectedCameraId)
  const isRender       = useStore(s => s.isRenderMode || s.isExporting)
  const showCams       = useStore(s => s.showCameraObjects)
  if (isRender || !showCams) return null
  return (
    <>
      {cameras.map(cam => {
        const pos   = cam.position || [0,2,5]
        const isAct = cam.id === activeCamId
        const isSel = cam.id === selectedCamId
        return (
          <group key={cam.id} position={pos}
            onClick={e => {
              e.stopPropagation()
              useStore.getState().setActiveCameraId(cam.id)
              useStore.getState().selectCamera(cam.id)
            }}>
            <mesh>
              <boxGeometry args={[0.25,0.18,0.32]} />
              <meshStandardMaterial color={isAct?'#4f8eff':'#666'}
                emissive={isAct?'#4f8eff':'#000'} emissiveIntensity={isAct?0.3:0}
                roughness={0.3} metalness={0.7} />
            </mesh>
            <mesh position={[0,0,-0.2]}>
              <cylinderGeometry args={[0.06,0.09,0.1,10]} />
              <meshStandardMaterial color={isAct?'#00e5ff':'#333'}
                emissive={isAct?'#00e5ff':'#000'} emissiveIntensity={0.3} />
            </mesh>
            {isAct && (
              <mesh position={[0,0,-0.5]} rotation={[Math.PI/2,0,0]}>
                <coneGeometry args={[0.45,0.9,4,1,true]} />
                <meshBasicMaterial color="#4f8eff" wireframe transparent opacity={0.2} />
              </mesh>
            )}
            {isSel && (
              <mesh rotation={[-Math.PI/2,0,0]}>
                <ringGeometry args={[0.35,0.45,32]} />
                <meshBasicMaterial color="#4f8eff" transparent opacity={0.8}
                  side={THREE.DoubleSide} depthWrite={false} />
              </mesh>
            )}
          </group>
        )
      })}
    </>
  )
}

// ── Camera sync ───────────────────────────────────────────────────────────────
function CamSync() {
  const { camera } = useThree()
  useFrame(() => {
    const s = useStore.getState()
    if (!s.inCameraView || !s.activeCameraId) return
    const cam    = (s.cameras||[]).find(c=>c.id===s.activeCameraId)
    if (!cam) return
    const interp = interpolateCamKF(s.activeCameraId, s.currentFrame, s.keyframes)
    const src    = interp || cam
    const pos    = src.position || [5,3,5]
    const tgt    = src.target   || [0,0,0]
    const fov    = src.fov      || 50
    camera.position.set(pos[0]||5, pos[1]||3, pos[2]||5)
    camera.lookAt(tgt[0]||0, tgt[1]||0, tgt[2]||0)
    if (Math.abs(camera.fov-fov)>0.1) { camera.fov=fov; camera.updateProjectionMatrix() }
  })
  return null
}

function interpolateCamKF(camId, frame, keyframes) {
  if (!keyframes||!camId) return null
  const key  = `__cam_${camId}__`
  const keys = Object.entries(keyframes)
    .filter(([,v])=>v[key]).map(([f,v])=>({frame:parseInt(f),data:v[key]}))
    .sort((a,b)=>a.frame-b.frame)
  if (!keys.length) return null
  const before=keys.filter(k=>k.frame<=frame), after=keys.filter(k=>k.frame>frame)
  if (!before.length) return keys[0].data
  if (!after.length)  return keys[keys.length-1].data
  const k0=before[before.length-1],k1=after[0]
  const t=(frame-k0.frame)/(k1.frame-k0.frame)
  const lv=(a,b,t)=>(a||[0,0,0]).map((v,i)=>v+((b||[0,0,0])[i]-v)*t)
  return { position:lv(k0.data.position,k1.data.position,t), target:lv(k0.data.target,k1.data.target,t), fov:(k0.data.fov||50)+((k1.data.fov||50)-(k0.data.fov||50))*t }
}

// ── Fly controls ───────────────────────────────────────────────────────────────
function FlyControls() {
  const inView = useStore(s=>s.inCameraView)
  const actId  = useStore(s=>s.activeCameraId)
  const { camera, gl } = useThree()
  const keys=useRef({}), drag=useRef({on:false,lx:0,ly:0})
  const yaw=useRef(0.5), pitch=useRef(-0.3), spd=useRef(0.08)
  useEffect(()=>{
    if(!inView||!actId) return
    const kd=e=>{keys.current[e.code]=true},ku=e=>{keys.current[e.code]=false}
    const md=e=>{drag.current={on:true,lx:e.clientX,ly:e.clientY}},mu=()=>{drag.current.on=false}
    const mm=e=>{if(!drag.current.on)return;yaw.current-=(e.clientX-drag.current.lx)*0.003;pitch.current=Math.max(-1.4,Math.min(1.4,pitch.current-(e.clientY-drag.current.ly)*0.003));drag.current.lx=e.clientX;drag.current.ly=e.clientY}
    const mw=e=>{spd.current=Math.max(0.01,Math.min(2,spd.current*(1-e.deltaY*0.001)))}
    let lt=[]
    const ts=e=>{lt=Array.from(e.touches);if(lt.length===1)drag.current={on:true,lx:lt[0].clientX,ly:lt[0].clientY}}
    const tm=e=>{if(e.touches.length===1&&drag.current.on){yaw.current-=(e.touches[0].clientX-drag.current.lx)*0.004;pitch.current=Math.max(-1.4,Math.min(1.4,pitch.current-(e.touches[0].clientY-drag.current.ly)*0.004));drag.current.lx=e.touches[0].clientX;drag.current.ly=e.touches[0].clientY}}
    const te=()=>{drag.current.on=false}
    window.addEventListener('keydown',kd);window.addEventListener('keyup',ku)
    gl.domElement.addEventListener('mousedown',md);window.addEventListener('mouseup',mu);window.addEventListener('mousemove',mm)
    gl.domElement.addEventListener('wheel',mw,{passive:true})
    gl.domElement.addEventListener('touchstart',ts,{passive:true});gl.domElement.addEventListener('touchmove',tm,{passive:true});gl.domElement.addEventListener('touchend',te)
    return()=>{window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku);gl.domElement.removeEventListener('mousedown',md);window.removeEventListener('mouseup',mu);window.removeEventListener('mousemove',mm);gl.domElement.removeEventListener('wheel',mw);gl.domElement.removeEventListener('touchstart',ts);gl.domElement.removeEventListener('touchmove',tm);gl.domElement.removeEventListener('touchend',te)}
  },[inView,actId,gl])
  useFrame(()=>{
    if(!inView||!actId)return
    const s=spd.current
    const fwd=new THREE.Vector3(Math.sin(yaw.current)*Math.cos(pitch.current),Math.sin(pitch.current),Math.cos(yaw.current)*Math.cos(pitch.current))
    const right=new THREE.Vector3().crossVectors(fwd,new THREE.Vector3(0,1,0)).normalize()
    if(keys.current.KeyW||keys.current.ArrowUp)    camera.position.addScaledVector(fwd,s)
    if(keys.current.KeyS||keys.current.ArrowDown)  camera.position.addScaledVector(fwd,-s)
    if(keys.current.KeyA||keys.current.ArrowLeft)  camera.position.addScaledVector(right,-s)
    if(keys.current.KeyD||keys.current.ArrowRight) camera.position.addScaledVector(right,s)
    if(keys.current.KeyQ||keys.current.KeyZ) camera.position.y-=s
    if(keys.current.KeyE||keys.current.KeyX) camera.position.y+=s
    const tgt=new THREE.Vector3().copy(camera.position).addScaledVector(fwd,5)
    useStore.getState().updateCamera(actId,{position:[camera.position.x,camera.position.y,camera.position.z],target:[tgt.x,tgt.y,tgt.z]})
  })
  return null
}

// ── Orbit controls ────────────────────────────────────────────────────────────
function OrbitCam() {
  const inView   = useStore(s=>s.inCameraView)
  const isRender = useStore(s=>s.isRenderMode||s.isExporting)
  if (inView || isRender) return null
  return (
    <OrbitControls makeDefault enableDamping dampingFactor={0.06}
      minDistance={0.3} maxDistance={300}
      touches={{ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN}}
      mouseButtons={{LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN}}
      enablePan screenSpacePanning />
  )
}

// ── Gizmo helper (hidden in render mode) ─────────────────────────────────────
function EditorGizmo() {
  const isRender  = useStore(s=>s.isRenderMode||s.isExporting)
  const showGizmo = useStore(s=>s.showGizmo)
  if (isRender || !showGizmo) return null
  return (
    <GizmoHelper alignment="bottom-right" margin={[72,80]}>
      <GizmoViewport axisColors={['#ff4060','#40ff80','#4080ff']} labelColor="#fff" />
    </GizmoHelper>
  )
}

// ── Camera HUD overlay (hidden during render) ─────────────────────────────────
function CamHUD() {
  const inView   = useStore(s=>s.inCameraView)
  const actId    = useStore(s=>s.activeCameraId)
  const cameras  = useStore(s=>s.cameras)||[]
  const isRender = useStore(s=>s.isRenderMode||s.isExporting)
  const cam      = cameras.find(c=>c.id===actId)
  if (!inView||!cam||isRender) return null
  const bl='2px solid rgba(79,142,255,0.8)'
  const corners=[
    {top:8,left:8,    borderTop:bl,borderLeft:bl},
    {top:8,right:8,   borderTop:bl,borderRight:bl},
    {bottom:8,left:8, borderBottom:bl,borderLeft:bl},
    {bottom:8,right:8,borderBottom:bl,borderRight:bl},
  ]
  return (
    <div style={{position:'absolute',inset:0,pointerEvents:'none',
      border:'2px solid rgba(79,142,255,0.5)',boxShadow:'inset 0 0 60px rgba(79,142,255,0.06)'}}>
      {corners.map((c,i)=>(<div key={i} style={{position:'absolute',width:18,height:18,...c}}/>))}
      <div style={{position:'absolute',top:10,left:'50%',transform:'translateX(-50%)',
        background:'rgba(8,8,20,0.75)',border:'1px solid rgba(79,142,255,0.4)',
        borderRadius:4,padding:'3px 12px',fontSize:11,color:'rgba(79,142,255,0.9)',
        fontFamily:'var(--font-mono)',backdropFilter:'blur(4px)',whiteSpace:'nowrap'}}>
        🎥 {cam.name} · {cam.fov||50}°
      </div>
      <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
        width:16,height:16,pointerEvents:'none'}}>
        <div style={{position:'absolute',top:'50%',left:0,right:0,height:1,background:'rgba(79,142,255,0.5)'}}/>
        <div style={{position:'absolute',left:'50%',top:0,bottom:0,width:1,background:'rgba(79,142,255,0.5)'}}/>
      </div>
      <div style={{position:'absolute',bottom:10,left:'50%',transform:'translateX(-50%)',
        fontSize:9,color:'rgba(79,142,255,0.5)',fontFamily:'var(--font-mono)',
        background:'rgba(0,0,0,0.4)',padding:'2px 10px',borderRadius:3,whiteSpace:'nowrap'}}>
        WASD move · Q/E up/down · drag look
      </div>
    </div>
  )
}

// ── Render-mode overlay indicator ─────────────────────────────────────────────
function RenderIndicator() {
  const isRender = useStore(s=>s.isRenderMode||s.isExporting)
  const progress = useStore(s=>s.exportProgress)
  if (!isRender) return null
  return (
    <div style={{position:'absolute',top:10,left:'50%',transform:'translateX(-50%)',
      background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.4)',
      borderRadius:6,padding:'5px 16px',pointerEvents:'none',
      display:'flex',alignItems:'center',gap:8,zIndex:100}}>
      <div style={{width:8,height:8,borderRadius:'50%',background:'var(--danger)',
        animation:'pulse 1s ease infinite'}}/>
      <span style={{fontSize:12,fontWeight:700,color:'var(--danger)',fontFamily:'var(--font-mono)'}}>
        RENDERING {progress>0?`${progress}%`:''}
      </span>
    </div>
  )
}

// ── Camera transform gizmo ────────────────────────────────────────────────────
// Allows Move / Rotate on camera objects directly in the 3D viewport
function CameraTransformGizmo() {
  const selectedCameraId    = useStore(s => s.selectedCameraId)
  const cameraTransformMode = useStore(s => s.cameraTransformMode) || 'translate'
  const inView              = useStore(s => s.inCameraView)
  const isRender            = useStore(s => s.isRenderMode || s.isExporting)
  const camRefs             = useRef({})  // { [camId]: THREE.Object3D }

  // We can't use TransformControls on cameras in the scene normally,
  // so we maintain invisible proxy objects at camera positions
  const cameras = useStore(s => s.cameras) || []
  const updateCamera = useStore(s => s.updateCamera)

  const selCam = cameras.find(c => c.id === selectedCameraId)

  if (!selCam || inView || isRender) return null

  return (
    <group
      position={selCam.position || [0,2,5]}
      ref={el => { if (el) camRefs.current[selectedCameraId] = el }}
      onUpdate={self => {
        // Sync proxy group position back to store
        const p = self.position
        updateCamera(selectedCameraId, { position:[p.x, p.y, p.z] })
      }}
    >
      {camRefs.current[selectedCameraId] && (
        <TransformControls
          key={`cam-tc-${selectedCameraId}`}
          object={camRefs.current[selectedCameraId]}
          mode={cameraTransformMode}
          size={0.7}
          onChange={() => {
            const obj = camRefs.current[selectedCameraId]
            if (!obj) return
            const p = obj.position
            if (cameraTransformMode === 'translate') {
              updateCamera(selectedCameraId, { position:[p.x, p.y, p.z] })
            } else if (cameraTransformMode === 'rotate') {
              // Compute new look-at target from rotation
              const dir = new THREE.Vector3(0, 0, -1)
                .applyQuaternion(obj.quaternion)
                .multiplyScalar(5)
                .add(p)
              updateCamera(selectedCameraId, { target:[dir.x, dir.y, dir.z] })
            }
          }}
        />
      )}
    </group>
  )
}

// ── Main Scene ─────────────────────────────────────────────────────────────────
export default function Scene({ canvasRef }) {
  return (
    <div style={{position:'absolute',inset:0}}>
      <Canvas
        shadows
        dpr={[1,Math.min(typeof window!=='undefined'?window.devicePixelRatio:1,2)]}
        gl={{
          antialias:true, preserveDrawingBuffer:true,
          outputColorSpace:THREE.SRGBColorSpace,
          toneMapping:THREE.ACESFilmicToneMapping, toneMappingExposure:1.2,
          powerPreference:'high-performance', failIfMajorPerformanceCaveat:false,
        }}
        style={{width:'100%',height:'100%',display:'block'}}
        onCreated={({gl})=>{gl.domElement.style.touchAction='none'}}
      >
        <PerspectiveCamera makeDefault position={[5,3,5]} fov={50} near={0.01} far={1000} />
        <Suspense fallback={null}>
          <SkyboxApplier />
          <PresetEnv />
          <LightingRig />
          <SceneLights />
          <Floor />
          <Deselect />
          <ModelManager />
          <CameraMarkers />
          <CameraTransformGizmo />
          <CamSync />
          <FlyControls />
          <Playback />
        </Suspense>
        <OrbitCam />
        <EditorGizmo />
        <PhysicsEngine />
      </Canvas>

      {/* Overlays — hidden when rendering */}
      <CamHUD />
      <RenderIndicator />
    </div>
  )
}
