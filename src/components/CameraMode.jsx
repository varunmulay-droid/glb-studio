/**
 * CameraMode.jsx
 * Prisma-3D-style cinematic camera system.
 *
 * Features:
 *  - Toggle between FREE (orbit) and CAMERA mode
 *  - In CAMERA mode: WASD + drag to fly the camera
 *  - Add camera keyframes (position + target + fov) at any timeline frame
 *  - Interpolate camera path during playback
 *  - "Capture Frame" — saves canvas PNG from the cinematic camera POV
 *  - "Record Sequence" — captures every frame along the timeline, zips as download
 *
 * Zero changes to existing components needed.
 */
import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import useStore from '../store/useStore'

// ── Zustand camera state (added as a standalone mini-store via module scope) ──
// We attach camera keyframes directly to the main store's keyframes namespace
// under the reserved key "__camera__" so the timeline renders them too.
const CAM_ID = '__camera__'

// ── Math helpers ──────────────────────────────────────────────────────────────
const lerpV3 = (a, b, t) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
})
const lerp = (a, b, t) => a + (b - a) * t

function getCameraKeyframes() {
  const kf = useStore.getState().keyframes
  return Object.entries(kf)
    .filter(([, v]) => v[CAM_ID])
    .map(([f, v]) => ({ frame: parseInt(f), data: v[CAM_ID] }))
    .sort((a, b) => a.frame - b.frame)
}

function interpolateCameraAt(frame) {
  const keys = getCameraKeyframes()
  if (!keys.length) return null
  const before = keys.filter(k => k.frame <= frame)
  const after  = keys.filter(k => k.frame >  frame)
  if (!before.length) return keys[0].data
  if (!after.length)  return keys[keys.length - 1].data
  const k0 = before[before.length - 1]
  const k1 = after[0]
  const t  = (frame - k0.frame) / (k1.frame - k0.frame)
  const d0 = k0.data, d1 = k1.data
  return {
    position: lerpV3(d0.position, d1.position, t),
    target:   lerpV3(d0.target,   d1.target,   t),
    fov:      lerp(d0.fov, d1.fov, t),
  }
}

// ── Add camera keyframe helper ────────────────────────────────────────────────
function addCameraKeyframe(frame, position, target, fov) {
  const store = useStore.getState()
  const kf = JSON.parse(JSON.stringify(store.keyframes))
  if (!kf[frame]) kf[frame] = {}
  kf[frame][CAM_ID] = {
    position: { x: position.x, y: position.y, z: position.z },
    target:   { x: target.x,   y: target.y,   z: target.z   },
    fov,
  }
  useStore.setState({ keyframes: kf })
}

function removeCameraKeyframe(frame) {
  const store = useStore.getState()
  const kf = JSON.parse(JSON.stringify(store.keyframes))
  if (kf[frame]) {
    delete kf[frame][CAM_ID]
    if (!Object.keys(kf[frame]).length) delete kf[frame]
  }
  useStore.setState({ keyframes: kf })
}

// ── Camera controller hook — attaches fly controls to the Three.js canvas ────
function useCameraController(active, threeCamera, renderer) {
  const keys    = useRef({})
  const drag    = useRef({ active: false, lastX: 0, lastY: 0 })
  const yaw     = useRef(0)
  const pitch   = useRef(-0.3)
  const speed   = useRef(0.06)
  const frameId = useRef(null)

  useEffect(() => {
    if (!active || !renderer) return
    const canvas = renderer.domElement

    const onKey = (e, down) => { keys.current[e.code] = down }
    const onDown = e => {
      drag.current = { active: true, lastX: e.clientX, lastY: e.clientY }
    }
    const onMove = e => {
      if (!drag.current.active) return
      const dx = e.clientX - drag.current.lastX
      const dy = e.clientY - drag.current.lastY
      drag.current.lastX = e.clientX
      drag.current.lastY = e.clientY
      yaw.current   -= dx * 0.003
      pitch.current -= dy * 0.003
      pitch.current  = Math.max(-1.4, Math.min(1.4, pitch.current))
    }
    const onUp    = () => { drag.current.active = false }
    const onWheel = e => { speed.current = Math.max(0.01, Math.min(1, speed.current * (1 - e.deltaY * 0.001))) }

    // Touch support
    let lastTouches = []
    const onTouchStart = e => {
      lastTouches = Array.from(e.touches)
      if (e.touches.length === 1) {
        drag.current = { active: true, lastX: e.touches[0].clientX, lastY: e.touches[0].clientY }
      }
    }
    const onTouchMove = e => {
      if (e.touches.length === 1 && drag.current.active) {
        const dx = e.touches[0].clientX - drag.current.lastX
        const dy = e.touches[0].clientY - drag.current.lastY
        drag.current.lastX = e.touches[0].clientX
        drag.current.lastY = e.touches[0].clientY
        yaw.current   -= dx * 0.004
        pitch.current -= dy * 0.004
        pitch.current  = Math.max(-1.4, Math.min(1.4, pitch.current))
      }
    }
    const onTouchEnd = () => { drag.current.active = false }

    window.addEventListener('keydown', e => onKey(e, true))
    window.addEventListener('keyup',   e => onKey(e, false))
    canvas.addEventListener('mousedown',  onDown)
    window.addEventListener('mousemove',  onMove)
    window.addEventListener('mouseup',    onUp)
    canvas.addEventListener('wheel',      onWheel, { passive: true })
    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: true })
    canvas.addEventListener('touchend',   onTouchEnd)

    // Fly loop
    const fly = () => {
      if (!threeCamera) { frameId.current = requestAnimationFrame(fly); return }
      const s = speed.current
      const forward = new THREE.Vector3(
        Math.sin(yaw.current) * Math.cos(pitch.current),
        Math.sin(pitch.current),
        Math.cos(yaw.current) * Math.cos(pitch.current)
      )
      const right = new THREE.Vector3()
        .crossVectors(forward, new THREE.Vector3(0,1,0)).normalize()

      if (keys.current['KeyW'] || keys.current['ArrowUp'])    threeCamera.position.addScaledVector(forward,  s)
      if (keys.current['KeyS'] || keys.current['ArrowDown'])  threeCamera.position.addScaledVector(forward, -s)
      if (keys.current['KeyA'] || keys.current['ArrowLeft'])  threeCamera.position.addScaledVector(right,   -s)
      if (keys.current['KeyD'] || keys.current['ArrowRight']) threeCamera.position.addScaledVector(right,    s)
      if (keys.current['KeyQ']) threeCamera.position.y -= s
      if (keys.current['KeyE']) threeCamera.position.y += s

      threeCamera.lookAt(
        threeCamera.position.x + forward.x,
        threeCamera.position.y + forward.y,
        threeCamera.position.z + forward.z,
      )
      frameId.current = requestAnimationFrame(fly)
    }
    frameId.current = requestAnimationFrame(fly)

    return () => {
      window.removeEventListener('keydown', e => onKey(e, true))
      window.removeEventListener('keyup',   e => onKey(e, false))
      canvas.removeEventListener('mousedown',  onDown)
      window.removeEventListener('mousemove',  onMove)
      window.removeEventListener('mouseup',    onUp)
      canvas.removeEventListener('wheel',      onWheel)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove',  onTouchMove)
      canvas.removeEventListener('touchend',   onTouchEnd)
      if (frameId.current) cancelAnimationFrame(frameId.current)
    }
  }, [active, threeCamera, renderer])
}

// ── Main CameraMode component ─────────────────────────────────────────────────
export default function CameraMode({ sceneRef }) {
  const [cameraMode, setCameraMode]   = useState(false)
  const [fov,        setFov]          = useState(50)
  const [capturing,  setCapturing]    = useState(false)
  const [recording,  setRecording]    = useState(false)
  const [progress,   setProgress]     = useState(0)
  const [camKeys,    setCamKeys]       = useState([])

  const currentFrame = useStore(s => s.currentFrame)
  const totalFrames  = useStore(s => s.totalFrames)
  const fps          = useStore(s => s.fps)
  const isPlaying    = useStore(s => s.isPlaying)
  const { setCurrentFrame, setIsPlaying } = useStore.getState()

  // Refs to Three.js objects (grabbed from the canvas DOM)
  const threeCamera   = useRef(null)
  const threeRenderer = useRef(null)
  const cancelRecord  = useRef(false)

  // Grab Three.js camera + renderer from the canvas wrapper
  useEffect(() => {
    const tryGrab = () => {
      const canvas = sceneRef?.current?.querySelector('canvas')
      if (!canvas) return
      // Access Three.js internals via the canvas's __r3f property (R3F exposes this)
      const r3f = canvas.__r3f?.root?.getState?.()
      if (r3f) {
        threeCamera.current   = r3f.camera
        threeRenderer.current = r3f.gl
      }
    }
    const t = setInterval(tryGrab, 500)
    return () => clearInterval(t)
  }, [sceneRef])

  // Apply camera keyframe interpolation during playback
  useEffect(() => {
    if (!cameraMode || !threeCamera.current) return
    const interp = interpolateCameraAt(currentFrame)
    if (!interp) return
    const { position, target, fov: kfov } = interp
    threeCamera.current.position.set(position.x, position.y, position.z)
    threeCamera.current.lookAt(target.x, target.y, target.z)
    threeCamera.current.fov = kfov
    threeCamera.current.updateProjectionMatrix()
    setFov(kfov)
  }, [currentFrame, cameraMode])

  // Update fov on camera
  useEffect(() => {
    if (!threeCamera.current) return
    threeCamera.current.fov = fov
    threeCamera.current.updateProjectionMatrix()
  }, [fov])

  // Fly controls
  useCameraController(
    cameraMode,
    threeCamera.current,
    threeRenderer.current,
  )

  // Refresh camera keyframe list
  const refreshKeys = useCallback(() => {
    setCamKeys(getCameraKeyframes())
  }, [])

  useEffect(() => {
    // Subscribe to keyframe changes
    const unsub = useStore.subscribe(
      s => s.keyframes,
      () => refreshKeys()
    )
    refreshKeys()
    return unsub
  }, [refreshKeys])

  // Add camera keyframe at current frame
  const addKey = () => {
    const cam = threeCamera.current
    if (!cam) return
    const dir = new THREE.Vector3()
    cam.getWorldDirection(dir)
    const target = cam.position.clone().add(dir.multiplyScalar(5))
    addCameraKeyframe(currentFrame, cam.position, target, cam.fov)
    refreshKeys()
  }

  // Capture single frame PNG
  const captureFrame = () => {
    const canvas = sceneRef?.current?.querySelector('canvas')
    if (!canvas) return
    const url  = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.href     = url
    link.download = `frame_${String(currentFrame).padStart(4,'0')}.png`
    link.click()
  }

  // Record full sequence → WebM
  const recordSequence = async () => {
    const canvas = sceneRef?.current?.querySelector('canvas')
    if (!canvas || recording) return
    setRecording(true)
    cancelRecord.current = false
    const chunks = []

    const stream   = canvas.captureStream(fps)
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm', videoBitsPerSecond: 10_000_000 })
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }

    recorder.start()
    const sleep = ms => new Promise(r => setTimeout(r, ms))

    for (let f = 0; f < totalFrames; f++) {
      if (cancelRecord.current) break
      setCurrentFrame(f)
      await sleep(1000 / fps + 8)
      setProgress(Math.round((f / totalFrames) * 100))
    }

    recorder.stop()
    await new Promise(r => { recorder.onstop = r })

    if (!cancelRecord.current) {
      const blob = new Blob(chunks, { type: 'video/webm' })
      const url  = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href     = url
      link.download = `cinematic_${Date.now()}.webm`
      link.click()
    }

    setRecording(false)
    setProgress(0)
    setCurrentFrame(0)
  }

  const hasKeyNow = camKeys.some(k => k.frame === currentFrame)

  return (
    <div style={{ fontFamily:'Space Mono,monospace', overflow:'auto', maxHeight:'100%' }}>

      {/* ── Mode toggle ── */}
      <div style={{ padding:'10px 10px 6px' }}>
        <div style={{ fontSize:10, color:'#555', letterSpacing:'0.12em', marginBottom:8 }}>
          CAMERA MODE
        </div>
        <button
          onClick={() => setCameraMode(!cameraMode)}
          style={{
            width:'100%', padding:'10px 0',
            background: cameraMode
              ? 'linear-gradient(135deg,rgba(255,170,0,0.2),rgba(255,80,0,0.15))'
              : 'rgba(255,255,255,0.04)',
            border: `1px solid ${cameraMode ? '#ffaa00' : 'rgba(255,255,255,0.12)'}`,
            color: cameraMode ? '#ffaa00' : '#666',
            borderRadius:8, cursor:'pointer',
            fontSize:12, fontFamily:'Space Mono',
            fontWeight: cameraMode ? 700 : 400,
            letterSpacing:'0.1em',
            transition:'all 0.2s',
            boxShadow: cameraMode ? '0 0 20px rgba(255,170,0,0.2)' : 'none',
          }}
        >
          {cameraMode ? '🎥 CAMERA MODE ON' : '📷 ENTER CAMERA MODE'}
        </button>
      </div>

      {cameraMode && <>
        {/* ── Info ── */}
        <div style={{
          margin:'0 10px 8px',
          padding:'8px 10px',
          background:'rgba(255,170,0,0.05)',
          border:'1px solid rgba(255,170,0,0.15)',
          borderRadius:6, fontSize:10, color:'#664400', lineHeight:1.8,
        }}>
          <span style={{color:'#ffaa00'}}>WASD</span> fly &nbsp;·&nbsp;
          <span style={{color:'#ffaa00'}}>Q/E</span> up/down &nbsp;·&nbsp;
          <span style={{color:'#ffaa00'}}>Drag</span> look<br/>
          <span style={{color:'#ffaa00'}}>Pinch</span> speed on mobile
        </div>

        {/* ── FOV ── */}
        <div style={{ padding:'0 10px 8px' }}>
          <div style={{ fontSize:10, color:'#555', marginBottom:4 }}>FIELD OF VIEW</div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input type="range" min={20} max={120} step={1}
              value={fov} onChange={e => setFov(+e.target.value)}
              style={{ flex:1, accentColor:'#ffaa00' }} />
            <span style={{ color:'#ffaa00', fontSize:11, minWidth:34 }}>{fov}°</span>
          </div>
        </div>

        <div style={{ height:1, background:'rgba(255,255,255,0.06)', margin:'0 10px 8px' }} />

        {/* ── Camera keyframes ── */}
        <div style={{ padding:'0 10px 8px' }}>
          <div style={{ fontSize:10, color:'#555', letterSpacing:'0.1em', marginBottom:6 }}>
            CAMERA KEYFRAMES
          </div>
          <div style={{ display:'flex', gap:6, marginBottom:8 }}>
            <button
              onClick={addKey}
              style={{
                flex:1, padding:'7px 0',
                background: hasKeyNow ? 'rgba(255,170,0,0.2)' : 'rgba(0,245,255,0.1)',
                border: `1px solid ${hasKeyNow ? '#ffaa00' : '#00f5ff'}`,
                color: hasKeyNow ? '#ffaa00' : '#00f5ff',
                borderRadius:5, cursor:'pointer',
                fontSize:11, fontFamily:'Space Mono',
              }}
            >
              {hasKeyNow ? '◆ UPDATE' : '◆ ADD CAM KF'}
            </button>
            {hasKeyNow && (
              <button
                onClick={() => { removeCameraKeyframe(currentFrame); refreshKeys() }}
                style={{
                  padding:'7px 10px',
                  background:'rgba(255,64,96,0.1)',
                  border:'1px solid rgba(255,64,96,0.3)',
                  color:'#ff4060', borderRadius:5,
                  cursor:'pointer', fontSize:11,
                }}
              >✕</button>
            )}
          </div>

          {/* Keyframe list */}
          {camKeys.length > 0 && (
            <div style={{ maxHeight:100, overflow:'auto' }}>
              {camKeys.map(({ frame, data }) => (
                <div key={frame}
                  onClick={() => setCurrentFrame(frame)}
                  style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding:'4px 8px', marginBottom:2, borderRadius:4,
                    background: frame===currentFrame ? 'rgba(255,170,0,0.1)' : 'rgba(255,255,255,0.03)',
                    border:`1px solid ${frame===currentFrame ? 'rgba(255,170,0,0.3)' : 'transparent'}`,
                    cursor:'pointer',
                  }}>
                  <span style={{ fontSize:10, color:'#aaa' }}>
                    🎥 Frame {frame} &nbsp;·&nbsp; FOV {Math.round(data.fov)}°
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); removeCameraKeyframe(frame); refreshKeys() }}
                    style={{ background:'none', border:'none', color:'#444', cursor:'pointer', fontSize:11 }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ height:1, background:'rgba(255,255,255,0.06)', margin:'0 10px 8px' }} />

        {/* ── Capture ── */}
        <div style={{ padding:'0 10px 10px' }}>
          <div style={{ fontSize:10, color:'#555', letterSpacing:'0.1em', marginBottom:6 }}>
            CAPTURE FROM CAMERA
          </div>

          {/* Single frame */}
          <button
            onClick={captureFrame}
            style={{
              width:'100%', padding:'8px 0', marginBottom:6,
              background:'rgba(64,255,128,0.1)',
              border:'1px solid rgba(64,255,128,0.3)',
              color:'#40ff80', borderRadius:6,
              cursor:'pointer', fontSize:11,
              fontFamily:'Space Mono',
            }}
          >
            📸 CAPTURE FRAME {currentFrame} (PNG)
          </button>

          {/* Record sequence */}
          {!recording ? (
            <button
              onClick={recordSequence}
              style={{
                width:'100%', padding:'9px 0',
                background:'linear-gradient(135deg,rgba(0,245,255,0.15),rgba(0,128,255,0.15))',
                border:'1px solid rgba(0,245,255,0.35)',
                color:'#00f5ff', borderRadius:6,
                cursor:'pointer', fontSize:11,
                fontFamily:'Space Mono', fontWeight:700,
                letterSpacing:'0.08em',
              }}
            >
              🎬 RECORD FULL SEQUENCE (WebM)
            </button>
          ) : (
            <>
              <div style={{ marginBottom:6 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:10, color:'#888' }}>Recording...</span>
                  <span style={{ fontSize:10, color:'#00f5ff' }}>{progress}%</span>
                </div>
                <div style={{ height:4, background:'rgba(255,255,255,0.08)', borderRadius:2 }}>
                  <div style={{
                    height:'100%', width:`${progress}%`,
                    background:'linear-gradient(90deg,#00f5ff,#0055ff)',
                    borderRadius:2, transition:'width 0.3s',
                  }} />
                </div>
              </div>
              <button
                onClick={() => { cancelRecord.current = true }}
                style={{
                  width:'100%', padding:'8px 0',
                  background:'rgba(255,64,96,0.1)',
                  border:'1px solid rgba(255,64,96,0.3)',
                  color:'#ff4060', borderRadius:6,
                  cursor:'pointer', fontSize:11,
                  fontFamily:'Space Mono',
                }}
              >⏹ CANCEL</button>
            </>
          )}
        </div>
      </>}
    </div>
  )
}
