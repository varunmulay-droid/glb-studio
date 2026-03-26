/**
 * CameraMode.jsx
 * Complete camera management panel:
 *  - Add / rename / delete cameras
 *  - Select active camera
 *  - Enter / Exit camera view (viewport switches to render through camera)
 *  - FOV, near/far clip controls
 *  - Camera position/target inputs
 *  - Camera keyframes on the timeline (per camera)
 *  - Capture PNG from camera POV
 *  - Record WebM sequence from camera
 *  - Camera layer visible in Timeline
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import useStore   from '../store/useStore'

const UID = () => `cam_${Date.now().toString(36)}`

// Camera keyframe key per camera: __cam_<id>__
const camKey = id => `__cam_${id}__`

function addCamKeyframe(camId, frame, position, target, fov) {
  const s  = useStore.getState()
  const kf = JSON.parse(JSON.stringify(s.keyframes))
  if (!kf[frame]) kf[frame] = {}
  kf[frame][camKey(camId)] = {
    position: Array.isArray(position) ? position : [position.x,position.y,position.z],
    target:   Array.isArray(target)   ? target   : [target.x,target.y,target.z],
    fov,
  }
  useStore.setState({ keyframes: kf })
}

function removeCamKeyframe(camId, frame) {
  const s  = useStore.getState()
  const kf = JSON.parse(JSON.stringify(s.keyframes))
  const k  = camKey(camId)
  if (kf[frame]?.[k]) {
    delete kf[frame][k]
    if (!Object.keys(kf[frame]).length) delete kf[frame]
    useStore.setState({ keyframes: kf })
  }
}

function getCamKeyframes(camId) {
  const kf = useStore.getState().keyframes
  const k  = camKey(camId)
  return Object.entries(kf)
    .filter(([,v]) => v[k])
    .map(([f,v]) => ({ frame:parseInt(f), data:v[k] }))
    .sort((a,b)=>a.frame-b.frame)
}

// ── Vec3 input row ─────────────────────────────────────────────────────────────
function Vec3Input({ label, value, onChange, step=0.1 }) {
  const axes = ['X','Y','Z']
  const colors = ['#ef4444','#22c55e','#3b82f6']
  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ fontSize:10, color:'var(--text2)', fontWeight:600,
        letterSpacing:'0.06em', marginBottom:4 }}>{label}</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
        {axes.map((ax,i) => (
          <div key={ax} style={{ display:'flex', alignItems:'center',
            background:'var(--bg1)', border:`1px solid ${colors[i]}33`,
            borderRadius:'var(--radius-sm)', overflow:'hidden' }}>
            <span style={{ padding:'0 5px', fontSize:9, fontWeight:700,
              color:colors[i], background:'var(--bg2)', alignSelf:'stretch',
              display:'flex', alignItems:'center', borderRight:`1px solid ${colors[i]}22` }}>{ax}</span>
            <input type="number" step={step}
              value={(value?.[i]||0).toFixed(2)}
              onChange={e => {
                const v = [...(value||[0,0,0])]
                v[i] = parseFloat(e.target.value)||0; onChange(v)
              }}
              style={{ border:'none', background:'transparent', width:'100%',
                padding:'5px 4px', fontSize:11, fontFamily:'var(--font-mono)', color:'var(--text0)' }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Single camera card ─────────────────────────────────────────────────────────
function CameraCard({ cam, isActive, isInView }) {
  const {
    setActiveCameraId, setInCameraView, updateCamera, removeCamera, cameras,
    currentFrame, inCameraView, activeCameraId,
  } = useStore()
  const [expanded, setExpanded] = useState(isActive)
  const [renaming, setRenaming] = useState(false)
  const [nameVal,  setNameVal]  = useState(cam.name)
  const [camKeys,  setCamKeys]  = useState([])
  const recording  = useRef(false)
  const cancelRef  = useRef(false)
  const [recProg,  setRecProg]  = useState(0)
  const [recActive,setRecAct]   = useState(false)

  const refreshKeys = useCallback(() => setCamKeys(getCamKeyframes(cam.id)), [cam.id])
  useEffect(() => {
    const unsub = useStore.subscribe(s=>s.keyframes, refreshKeys)
    refreshKeys()
    return unsub
  }, [refreshKeys])

  const enterCamera = () => {
    setActiveCameraId(cam.id)
    setInCameraView(true)
    setExpanded(true)
  }
  const exitCamera = () => {
    setInCameraView(false)
  }

  const addKF = () => {
    const s   = useStore.getState()
    // Get current viewport camera position (the r3f camera if we're in view, else cam data)
    const pos = cam.position || [5,3,5]
    const tgt = cam.target   || [0,0,0]
    addCamKeyframe(cam.id, currentFrame, pos, tgt, cam.fov||50)
    refreshKeys()
  }

  const captureFrame = () => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    const url  = canvas.toDataURL('image/png')
    const a    = document.createElement('a')
    a.href = url; a.download = `${cam.name}_frame${currentFrame}.png`; a.click()
  }

  const recordSeq = async () => {
    const canvas = document.querySelector('canvas')
    if (!canvas || recActive) return
    const s = useStore.getState()
    setRecAct(true); cancelRef.current = false
    const chunks = []
    const rec = new MediaRecorder(canvas.captureStream(s.fps),
      { mimeType:'video/webm', videoBitsPerSecond:10_000_000 })
    rec.ondataavailable = e => chunks.push(e.data)
    rec.start()
    for (let f=0; f<s.totalFrames; f++) {
      if (cancelRef.current) break
      s.setCurrentFrame(f)
      await new Promise(r=>setTimeout(r,1000/s.fps+8))
      setRecProg(Math.round(f/s.totalFrames*100))
    }
    rec.stop()
    await new Promise(r=>{ rec.onstop=r })
    if (!cancelRef.current) {
      const url = URL.createObjectURL(new Blob(chunks,{type:'video/webm'}))
      const a   = document.createElement('a')
      a.href=url; a.download=`${cam.name}_${Date.now()}.webm`; a.click()
    }
    setRecAct(false); setRecProg(0); s.setCurrentFrame(0)
  }

  const hasKfNow = camKeys.some(k=>k.frame===currentFrame)
  const thisActive = activeCameraId===cam.id
  const inThisView = thisActive && inCameraView

  return (
    <div style={{
      border:`1px solid ${thisActive ? 'rgba(79,142,255,0.4)' : 'var(--border)'}`,
      borderRadius:'var(--radius)',
      background: thisActive ? 'rgba(79,142,255,0.05)' : 'var(--bg2)',
      overflow:'hidden', transition:'all 0.15s',
      marginBottom:8,
    }}>
      {/* Header row */}
      <div style={{ padding:'8px 10px', display:'flex', alignItems:'center', gap:8 }}>
        {/* Camera icon */}
        <div style={{
          width:28, height:28, borderRadius:'var(--radius-sm)', flexShrink:0,
          background: inThisView ? 'rgba(79,142,255,0.2)' : 'var(--bg3)',
          border:`1px solid ${inThisView ? 'rgba(79,142,255,0.5)' : 'var(--border)'}`,
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
          boxShadow: inThisView ? '0 0 12px rgba(79,142,255,0.3)' : 'none',
        }}>🎥</div>

        {/* Name */}
        {renaming ? (
          <input value={nameVal}
            onChange={e=>setNameVal(e.target.value)}
            onBlur={()=>{ updateCamera(cam.id,{name:nameVal}); setRenaming(false) }}
            onKeyDown={e=>{ if(e.key==='Enter'){ updateCamera(cam.id,{name:nameVal}); setRenaming(false) }}}
            autoFocus
            style={{ flex:1, fontSize:12, fontWeight:700, padding:'2px 6px', borderRadius:3 }}
          />
        ) : (
          <span onDoubleClick={()=>{ setNameVal(cam.name); setRenaming(true) }}
            style={{ flex:1, fontSize:12, fontWeight:700, color:'var(--text0)',
              cursor:'text', userSelect:'none' }}
            title="Double-click to rename"
          >{cam.name}</span>
        )}

        {/* FOV badge */}
        <span style={{ fontSize:9, color:'var(--text3)', fontFamily:'var(--font-mono)',
          background:'var(--bg3)', padding:'2px 6px', borderRadius:3, flexShrink:0 }}>
          {cam.fov||50}°
        </span>

        {/* Expand */}
        <button onClick={()=>setExpanded(!expanded)}
          style={{ background:'none', border:'none', color:'var(--text2)', cursor:'pointer',
            fontSize:12, padding:2, transition:'transform 0.15s',
            transform: expanded?'rotate(0deg)':'rotate(-90deg)' }}>▾</button>

        {/* Delete */}
        {cameras.length > 1 && (
          <button onClick={()=>removeCamera(cam.id)}
            style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer',
              fontSize:12, padding:2, transition:'color 0.12s' }}
            onMouseEnter={e=>e.currentTarget.style.color='var(--danger)'}
            onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}
            title="Delete camera"
          >✕</button>
        )}
      </div>

      {/* Enter / Exit camera view button */}
      <div style={{ padding:'0 10px 8px', display:'flex', gap:6 }}>
        {!inThisView ? (
          <button onClick={enterCamera} style={{
            flex:1, padding:'7px 0', borderRadius:'var(--radius-sm)',
            background:'rgba(79,142,255,0.12)',
            border:'1px solid rgba(79,142,255,0.35)',
            color:'var(--accent)', fontSize:11, fontWeight:700, cursor:'pointer',
            transition:'all 0.15s',
            boxShadow: thisActive ? '0 0 10px rgba(79,142,255,0.2)' : 'none',
          }}>
            📷 Enter Camera View
          </button>
        ) : (
          <button onClick={exitCamera} style={{
            flex:1, padding:'7px 0', borderRadius:'var(--radius-sm)',
            background:'rgba(239,68,68,0.12)',
            border:'1px solid rgba(239,68,68,0.35)',
            color:'var(--danger)', fontSize:11, fontWeight:700, cursor:'pointer',
          }}>
            ↩ Exit Camera View
          </button>
        )}
      </div>

      {expanded && (
        <div style={{ padding:'0 10px 12px', borderTop:'1px solid var(--border)',
          paddingTop:10, display:'flex', flexDirection:'column', gap:8 }}>

          {/* Position / Target */}
          <Vec3Input label="Position" value={cam.position}
            onChange={v=>updateCamera(cam.id,{position:v})} />
          <Vec3Input label="Look At (Target)" value={cam.target}
            onChange={v=>updateCamera(cam.id,{target:v})} />

          {/* FOV */}
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:10, color:'var(--text2)', fontWeight:600 }}>Field of View</span>
              <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--accent)' }}>
                {cam.fov||50}°
              </span>
            </div>
            <input type="range" min={10} max={150} step={1} value={cam.fov||50}
              onChange={e=>updateCamera(cam.id,{fov:+e.target.value})} />
            <div style={{ display:'flex', gap:4, marginTop:5 }}>
              {[24,35,50,70,90].map(f=>(
                <button key={f} onClick={()=>updateCamera(cam.id,{fov:f})} style={{
                  flex:1, padding:'3px 0', borderRadius:3, fontSize:9,
                  background:(cam.fov||50)===f?'rgba(79,142,255,0.15)':'var(--bg3)',
                  border:`1px solid ${(cam.fov||50)===f?'rgba(79,142,255,0.4)':'var(--border)'}`,
                  color:(cam.fov||50)===f?'var(--accent)':'var(--text1)', cursor:'pointer',
                }}>{f}</button>
              ))}
            </div>
          </div>

          {/* Near / Far */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            {[['Near Clip','near',0.01],['Far Clip','far',1000]].map(([lbl,key,def])=>(
              <div key={key}>
                <div style={{ fontSize:9, color:'var(--text2)', marginBottom:3 }}>{lbl}</div>
                <input type="number" step={key==='near'?0.01:100} value={cam[key]||def}
                  onChange={e=>updateCamera(cam.id,{[key]:parseFloat(e.target.value)||def})}
                  style={{}} />
              </div>
            ))}
          </div>

          {/* Keyframes */}
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:8 }}>
            <div style={{ fontSize:10, color:'var(--text2)', fontWeight:600,
              letterSpacing:'0.06em', marginBottom:6 }}>
              CAMERA KEYFRAMES
            </div>
            <div style={{ display:'flex', gap:5, marginBottom:6 }}>
              <button onClick={addKF} style={{
                flex:1, padding:'6px 0', borderRadius:'var(--radius-sm)',
                background: hasKfNow?'rgba(245,158,11,0.15)':'rgba(79,142,255,0.1)',
                border:`1px solid ${hasKfNow?'rgba(245,158,11,0.4)':'rgba(79,142,255,0.3)'}`,
                color:hasKfNow?'var(--warn)':'var(--accent)',
                fontSize:11, fontWeight:600, cursor:'pointer',
              }}>{hasKfNow?'◆ Update KF':'◆ Add KF @ '+currentFrame}</button>
              {hasKfNow && (
                <button onClick={()=>{removeCamKeyframe(cam.id,currentFrame);refreshKeys()}} style={{
                  padding:'6px 10px', borderRadius:'var(--radius-sm)',
                  background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)',
                  color:'var(--danger)', cursor:'pointer', fontSize:11,
                }}>✕</button>
              )}
            </div>

            {camKeys.length>0 && (
              <div style={{ maxHeight:100, overflow:'auto', display:'flex', flexDirection:'column', gap:2 }}>
                {camKeys.map(({frame,data})=>(
                  <div key={frame}
                    onClick={()=>useStore.getState().setCurrentFrame(frame)}
                    style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      padding:'4px 8px', borderRadius:'var(--radius-sm)', cursor:'pointer',
                      background:frame===currentFrame?'rgba(245,158,11,0.1)':'var(--bg1)',
                      border:`1px solid ${frame===currentFrame?'rgba(245,158,11,0.25)':'var(--border)'}`,
                    }}>
                    <span style={{ fontSize:10, color:frame===currentFrame?'var(--warn)':'var(--text1)' }}>
                      🎥 Frame {frame} · FOV {Math.round(data.fov||50)}°
                    </span>
                    <button onClick={e=>{e.stopPropagation();removeCamKeyframe(cam.id,frame);refreshKeys()}}
                      style={{ background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:11 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Capture */}
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:8, display:'flex', flexDirection:'column', gap:6 }}>
            <div style={{ fontSize:10, color:'var(--text2)', fontWeight:600, letterSpacing:'0.06em' }}>
              RENDER OUTPUT
            </div>
            <button onClick={captureFrame} style={{
              padding:'7px 0', borderRadius:'var(--radius-sm)',
              background:'rgba(6,214,160,0.08)', border:'1px solid rgba(6,214,160,0.25)',
              color:'var(--accent3)', fontSize:11, cursor:'pointer',
            }}>📸 Capture Frame {currentFrame} as PNG</button>

            {!recActive ? (
              <button onClick={recordSeq} style={{
                padding:'8px 0', borderRadius:'var(--radius-sm)',
                background:'linear-gradient(135deg,rgba(79,142,255,0.15),rgba(124,58,237,0.15))',
                border:'1px solid rgba(79,142,255,0.3)',
                color:'var(--accent)', fontSize:11, fontWeight:700, cursor:'pointer',
                letterSpacing:'0.04em',
              }}>🎬 Record Full Sequence (WebM)</button>
            ) : (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:10, color:'var(--text2)' }}>Recording…</span>
                  <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--accent)' }}>{recProg}%</span>
                </div>
                <div style={{ height:4, background:'var(--bg3)', borderRadius:2, marginBottom:6 }}>
                  <div style={{ height:'100%', width:`${recProg}%`, borderRadius:2,
                    background:'linear-gradient(90deg,var(--accent),var(--accent2))', transition:'width 0.3s' }}/>
                </div>
                <button onClick={()=>cancelRef.current=true} style={{
                  width:'100%', padding:'6px 0', borderRadius:'var(--radius-sm)',
                  background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)',
                  color:'var(--danger)', fontSize:11, cursor:'pointer',
                }}>⏹ Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Panel ─────────────────────────────────────────────────────────────────
export default function CameraMode() {
  const { cameras, activeCameraId, inCameraView, addCamera, setActiveCameraId, setInCameraView } = useStore()

  const addNewCamera = () => {
    const id  = UID()
    const n   = cameras.length + 1
    // Place new camera offset from current active
    const base = cameras.find(c=>c.id===activeCameraId)||cameras[0]
    const pos  = base
      ? [base.position[0]+n*1.5, base.position[1], base.position[2]+n*0.5]
      : [5,3,5]
    addCamera({
      id, name:`Camera ${n}`,
      position:pos, target:[0,0,0], fov:50, near:0.01, far:1000,
    })
    setActiveCameraId(id)
  }

  return (
    <div style={{ padding:12, display:'flex', flexDirection:'column', gap:8,
      overflow:'auto', maxHeight:'100%' }}>

      {/* Header + Add button */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text0)' }}>
            Cameras <span style={{ fontSize:11, color:'var(--text3)',
              background:'var(--bg3)', padding:'1px 6px', borderRadius:3,
              marginLeft:4 }}>{cameras.length}</span>
          </div>
          <div style={{ fontSize:10, color:'var(--text2)', marginTop:2 }}>
            {inCameraView ? '🎥 In camera view' : 'Free orbit mode'}
          </div>
        </div>
        <button onClick={addNewCamera} style={{
          padding:'7px 12px', borderRadius:'var(--radius-sm)',
          background:'rgba(79,142,255,0.12)', border:'1px solid rgba(79,142,255,0.3)',
          color:'var(--accent)', fontSize:11, fontWeight:700, cursor:'pointer',
          transition:'all 0.15s',
        }}>+ Add Camera</button>
      </div>

      {/* Status bar */}
      {inCameraView && (
        <div style={{
          padding:'8px 12px', borderRadius:'var(--radius-sm)',
          background:'rgba(79,142,255,0.08)', border:'1px solid rgba(79,142,255,0.25)',
          fontSize:11, color:'var(--accent)',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          animation:'fadeUp 0.2s ease',
        }}>
          <span>🎥 Rendering through {cameras.find(c=>c.id===activeCameraId)?.name}</span>
          <button onClick={()=>setInCameraView(false)} style={{
            padding:'3px 8px', borderRadius:3,
            background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)',
            color:'var(--danger)', fontSize:10, cursor:'pointer',
          }}>Exit ↩</button>
        </div>
      )}

      {/* Controls hint */}
      {inCameraView && (
        <div style={{
          padding:'8px 10px', borderRadius:'var(--radius-sm)',
          background:'var(--bg2)', border:'1px solid var(--border)',
          fontSize:10, color:'var(--text2)', lineHeight:1.8,
        }}>
          <span style={{color:'var(--warn)',fontWeight:600}}>WASD</span> fly &nbsp;
          <span style={{color:'var(--warn)',fontWeight:600}}>Q/E</span> up/down &nbsp;
          <span style={{color:'var(--warn)',fontWeight:600}}>Drag</span> look around &nbsp;
          <span style={{color:'var(--warn)',fontWeight:600}}>Scroll</span> speed
        </div>
      )}

      {/* Camera cards */}
      {cameras.map(cam => (
        <CameraCard key={cam.id} cam={cam}
          isActive={cam.id===activeCameraId}
          isInView={cam.id===activeCameraId&&inCameraView} />
      ))}

      {/* Tips */}
      <div style={{
        padding:'10px 12px', borderRadius:'var(--radius-sm)',
        background:'var(--bg2)', border:'1px solid var(--border)',
        fontSize:10, color:'var(--text3)', lineHeight:1.8,
      }}>
        💡 <b style={{color:'var(--text2)'}}>Tips:</b><br/>
        • Double-click camera name to rename<br/>
        • Add keyframes to animate camera path<br/>
        • Use FOV presets: 24mm/35mm/50mm feel<br/>
        • Record Sequence captures from camera POV
      </div>
    </div>
  )
}
