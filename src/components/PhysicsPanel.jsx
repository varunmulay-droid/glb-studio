/**
 * PhysicsPanel.jsx — Full physics control panel
 * Gravity, wind, global friction/restitution, per-model body properties,
 * velocity/force controls, telemetry readout, vehicle presets.
 */
import { useState, useEffect, useRef } from 'react'
import useStore from '../store/useStore'
import {
  applyImpulse, applyForce, setBodyVelocity, setAngularVelocity,
  setConstantForce, getBodyState, teleportBody, getBodies,
} from './PhysicsEngine'

const COLORS = ['#4f8eff','#ef4444','#22c55e','#f59e0b','#8b5cf6','#f97316']

// ── Reusable slider ─────────────────────────────────────────────────────────
function Slider({ label, value, onChange, min=0, max=1, step=0.01, unit='', color='var(--accent)', fmt }) {
  const disp = fmt ? fmt(value) : (typeof value==='number' ? value.toFixed(step<0.01?3:step<0.1?2:1) : value)
  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:10, color:'var(--text2)', fontWeight:500 }}>{label}</span>
        <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color }}>{disp}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(+e.target.value)} />
    </div>
  )
}

// ── Toggle switch ────────────────────────────────────────────────────────────
function Toggle({ value, onChange, color='var(--accent)' }) {
  return (
    <button onClick={()=>onChange(!value)} style={{
      width:38, height:21, borderRadius:11, border:'none', cursor:'pointer', flexShrink:0,
      background: value ? color : 'var(--bg4)', position:'relative', transition:'background 0.2s',
      boxShadow: value ? `0 0 8px ${color}55` : 'none',
    }}>
      <div style={{ position:'absolute', top:3, width:15, height:15, borderRadius:8,
        background:'#fff', transition:'left 0.2s', left: value ? 20 : 3,
        boxShadow:'0 1px 3px rgba(0,0,0,0.4)' }}/>
    </button>
  )
}

// ── Section collapse ─────────────────────────────────────────────────────────
function Sec({ title, color='var(--text2)', children, open:initOpen=true }) {
  const [open, setOpen] = useState(initOpen)
  return (
    <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', overflow:'hidden', marginBottom:6 }}>
      <button onClick={()=>setOpen(v=>!v)} style={{
        width:'100%', padding:'8px 10px', background:'var(--bg2)',
        border:'none', color, fontSize:11, fontWeight:700, cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        letterSpacing:'0.06em',
      }}>
        {title}
        <span style={{ color:'var(--text3)', fontWeight:400, transition:'transform 0.15s', display:'inline-block', transform:open?'none':'rotate(-90deg)' }}>▾</span>
      </button>
      {open && <div style={{ padding:'10px 12px' }}>{children}</div>}
    </div>
  )
}

// ── Telemetry readout ────────────────────────────────────────────────────────
function Telemetry({ modelId }) {
  const [state, setState] = useState(null)
  useEffect(() => {
    if (!modelId) return
    const iv = setInterval(() => setState(getBodyState(modelId)), 100)
    return () => clearInterval(iv)
  }, [modelId])

  if (!state) return (
    <div style={{ fontSize:10, color:'var(--text3)', textAlign:'center', padding:'8px 0' }}>
      No physics body active for this model
    </div>
  )
  const speed = state.speed.toFixed(2)
  const rows = [
    ['Speed',    `${speed} m/s`],
    ['Vel X',    state.velocity.x.toFixed(3)],
    ['Vel Y',    state.velocity.y.toFixed(3)],
    ['Vel Z',    state.velocity.z.toFixed(3)],
    ['Pos X',    state.position.x.toFixed(2)],
    ['Pos Y',    state.position.y.toFixed(2)],
    ['Pos Z',    state.position.z.toFixed(2)],
    ['ω X',      state.angularVelocity.x.toFixed(3)],
    ['Sleeping', state.sleeping ? 'YES' : 'no'],
  ]
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'3px 8px' }}>
      {rows.map(([k,v]) => (
        <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'3px 6px', background:'var(--bg1)', borderRadius:3,
          border:'1px solid var(--border)' }}>
          <span style={{ fontSize:9, color:'var(--text3)' }}>{k}</span>
          <span style={{ fontSize:9, fontFamily:'var(--font-mono)',
            color: k==='Speed' ? (parseFloat(speed)>0.5?'var(--accent3)':'var(--text1)') :
                   k==='Sleeping' ? (v==='YES'?'var(--text3)':'var(--accent)') : 'var(--text0)' }}>
            {v}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Vehicle preset ────────────────────────────────────────────────────────────
const VEHICLE_PRESETS = {
  car:        { mass:1200, damping:0.3, angularDamping:0.7, friction:0.6, restitution:0.1, centerOfMassY:-0.3, collisionShape:'box', ccdRadius:1 },
  truck:      { mass:8000, damping:0.5, angularDamping:0.9, friction:0.7, restitution:0.05,centerOfMassY:-0.5, collisionShape:'box', ccdRadius:1 },
  motorcycle: { mass:250,  damping:0.2, angularDamping:0.4, friction:0.5, restitution:0.1, centerOfMassY:-0.1, collisionShape:'box', ccdRadius:1 },
  ball:       { mass:1,    damping:0.01,angularDamping:0.01,friction:0.2, restitution:0.8, centerOfMassY:0,    collisionShape:'sphere' },
  box:        { mass:50,   damping:0.4, angularDamping:0.6, friction:0.5, restitution:0.3, centerOfMassY:0,    collisionShape:'box' },
  feather:    { mass:0.01, damping:0.99,angularDamping:0.99,friction:0.1, restitution:0.1, centerOfMassY:0,    collisionShape:'box' },
}

// ── Per-model card ────────────────────────────────────────────────────────────
function ModelPhysicsCard({ model, index, physicsEnabled }) {
  const { modelPhysics, setModelPhysics } = useStore()
  const props = { mass:1, damping:0.3, angularDamping:0.5, type:'dynamic',
    friction:0.4, restitution:0.2, staticFriction:0.6, centerOfMassY:0,
    collisionShape:'box', ccdRadius:0, ...modelPhysics[model.id] }
  const c = COLORS[index % COLORS.length]
  const [open, setOpen] = useState(false)
  const [engineForce, setEngineForce] = useState({ x:0, y:0, z:0 })
  const [velocity,    setVelocityUI]  = useState({ x:0, y:0, z:0 })

  const upd = (k, v) => setModelPhysics(model.id, { [k]:v })

  const applyPreset = (name) => {
    const p = VEHICLE_PRESETS[name]
    if (p) setModelPhysics(model.id, p)
  }

  const handleSetVelocity = () => {
    setBodyVelocity(model.id, velocity)
  }

  const handleSetForce = () => {
    setConstantForce(model.id, (engineForce.x||engineForce.y||engineForce.z) ? engineForce : null)
  }

  return (
    <div style={{ border:`1px solid ${open?`${c}44`:'var(--border)'}`, borderRadius:'var(--radius)',
      overflow:'hidden', marginBottom:6, transition:'border-color 0.15s' }}>

      {/* Header */}
      <button onClick={()=>setOpen(v=>!v)} style={{
        width:'100%', padding:'8px 10px', background: open?`${c}08`:'var(--bg2)',
        border:'none', cursor:'pointer',
        display:'flex', alignItems:'center', gap:8, transition:'background 0.15s',
      }}>
        <div style={{ width:8, height:8, borderRadius:1, rotate:'45deg', background:c, flexShrink:0,
          boxShadow:`0 0 5px ${c}88` }}/>
        <span style={{ flex:1, fontSize:12, fontWeight:700, color:'var(--text0)', textAlign:'left',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{model.name}</span>
        <span style={{ fontSize:9, padding:'2px 7px', borderRadius:10,
          background: props.type==='dynamic'?'rgba(79,142,255,0.15)':props.type==='static'?'rgba(239,68,68,0.12)':'rgba(245,158,11,0.12)',
          color: props.type==='dynamic'?'var(--accent)':props.type==='static'?'var(--danger)':'var(--warn)',
          fontWeight:700 }}>{props.type}</span>
        <span style={{ color:'var(--text3)', fontSize:11 }}>{open?'▲':'▼'}</span>
      </button>

      {open && (
        <div style={{ padding:'10px 12px', background:'var(--bg1)',
          borderTop:`1px solid ${c}22`, display:'flex', flexDirection:'column', gap:10 }}>

          {/* Presets */}
          <div>
            <div style={{ fontSize:9, color:'var(--text3)', fontWeight:700, letterSpacing:'0.08em', marginBottom:5 }}>PRESETS</div>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {Object.keys(VEHICLE_PRESETS).map(name => (
                <button key={name} onClick={()=>applyPreset(name)} style={{
                  padding:'4px 9px', borderRadius:'var(--radius-sm)', fontSize:10,
                  background:'var(--bg3)', border:'1px solid var(--border)',
                  color:'var(--text1)', cursor:'pointer', textTransform:'capitalize',
                  transition:'all 0.1s',
                }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=c;e.currentTarget.style.color=c}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text1)'}}
                >{name}</button>
              ))}
            </div>
          </div>

          {/* Body type */}
          <div>
            <div style={{ fontSize:9, color:'var(--text3)', fontWeight:700, letterSpacing:'0.08em', marginBottom:5 }}>BODY TYPE</div>
            <div style={{ display:'flex', gap:4 }}>
              {['dynamic','static','kinematic'].map(t=>(
                <button key={t} onClick={()=>upd('type',t)} style={{
                  flex:1, padding:'5px 0', borderRadius:'var(--radius-sm)', fontSize:10,
                  background: props.type===t?`${c}18`:'var(--bg3)',
                  border:`1px solid ${props.type===t?`${c}44`:'var(--border)'}`,
                  color: props.type===t?c:'var(--text1)', cursor:'pointer', textTransform:'capitalize',
                  fontWeight: props.type===t?700:400,
                }}>{t}</button>
              ))}
            </div>
          </div>

          {/* Collision shape */}
          <div>
            <div style={{ fontSize:9, color:'var(--text3)', fontWeight:700, letterSpacing:'0.08em', marginBottom:5 }}>COLLISION SHAPE</div>
            <div style={{ display:'flex', gap:4 }}>
              {['box','sphere','cylinder'].map(sh=>(
                <button key={sh} onClick={()=>upd('collisionShape',sh)} style={{
                  flex:1, padding:'4px 0', borderRadius:'var(--radius-sm)', fontSize:10,
                  background: props.collisionShape===sh?`${c}18`:'var(--bg3)',
                  border:`1px solid ${props.collisionShape===sh?`${c}44`:'var(--border)'}`,
                  color: props.collisionShape===sh?c:'var(--text1)', cursor:'pointer',
                  textTransform:'capitalize',
                }}>{sh==='box'?'📦 Box':sh==='sphere'?'⚽ Sphere':'🛢 Cylinder'}</button>
              ))}
            </div>
          </div>

          {props.type !== 'static' && <>
            <Slider label="Mass (kg)" value={props.mass} min={0.01} max={10000} step={0.1} unit="kg"
              color={c} onChange={v=>upd('mass',v)} />
            <Slider label="Linear Damping (air resistance)" value={props.damping} min={0} max={1}
              color={c} onChange={v=>upd('damping',v)} />
            <Slider label="Angular Damping (spin resistance)" value={props.angularDamping} min={0} max={1}
              color={c} onChange={v=>upd('angularDamping',v)} />
            <Slider label="Dynamic Friction" value={props.friction} min={0} max={2} step={0.01}
              color={c} onChange={v=>upd('friction',v)} />
            <Slider label="Static Friction" value={props.staticFriction} min={0} max={2} step={0.01}
              color={c} onChange={v=>upd('staticFriction',v)} />
            <Slider label="Restitution (bounciness)" value={props.restitution} min={0} max={1}
              color={c} onChange={v=>upd('restitution',v)} />
            <Slider label="Center of Mass Y offset" value={props.centerOfMassY} min={-2} max={2} step={0.05}
              color={c} onChange={v=>upd('centerOfMassY',v)}
              fmt={v=>(v>0?'+':'')+v.toFixed(2)} unit="m" />
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:10, color:'var(--text2)' }}>CCD (fast-moving objects)</span>
              <Toggle value={props.ccdRadius>0} onChange={v=>upd('ccdRadius',v?1:0)} color={c} />
            </div>
          </>}

          {/* ── Live controls (requires physics ON) ── */}
          {physicsEnabled && props.type==='dynamic' && (
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:10 }}>
              <div style={{ fontSize:9, color:'var(--text3)', fontWeight:700, letterSpacing:'0.08em', marginBottom:8 }}>LIVE CONTROLS</div>

              {/* Impulse buttons */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, marginBottom:8 }}>
                {[
                  ['⬆ Up',     ()=>applyImpulse(model.id,{x:0,y:props.mass*5,z:0})],
                  ['→ Right',  ()=>applyImpulse(model.id,{x:props.mass*3,y:0,z:0})],
                  ['← Left',   ()=>applyImpulse(model.id,{x:-props.mass*3,y:0,z:0})],
                  ['▶ Fwd',    ()=>applyImpulse(model.id,{x:0,y:0,z:-props.mass*3})],
                  ['◀ Back',   ()=>applyImpulse(model.id,{x:0,y:0,z:props.mass*3})],
                  ['⏹ Stop',   ()=>{ setBodyVelocity(model.id,{x:0,y:0,z:0}); setAngularVelocity(model.id,{x:0,y:0,z:0}) }],
                ].map(([lbl,fn])=>(
                  <button key={lbl} onClick={fn} style={{
                    padding:'5px 0', borderRadius:'var(--radius-sm)', fontSize:10,
                    background:`${c}12`, border:`1px solid ${c}33`, color:c, cursor:'pointer',
                    transition:'all 0.1s',
                  }}
                    onMouseEnter={e=>e.currentTarget.style.background=`${c}24`}
                    onMouseLeave={e=>e.currentTarget.style.background=`${c}12`}
                  >{lbl}</button>
                ))}
              </div>

              {/* Set velocity */}
              <div style={{ marginBottom:8 }}>
                <div style={{ fontSize:9, color:'var(--text3)', marginBottom:4 }}>Set Velocity (m/s)</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
                  {['x','y','z'].map(ax=>(
                    <input key={ax} type="number" step={0.5} value={velocity[ax]}
                      onChange={e=>setVelocityUI(v=>({...v,[ax]:+e.target.value}))}
                      placeholder={ax.toUpperCase()}
                      style={{ fontSize:11, textAlign:'center' }}/>
                  ))}
                </div>
                <button onClick={handleSetVelocity} style={{
                  width:'100%', marginTop:4, padding:'5px 0',
                  borderRadius:'var(--radius-sm)', fontSize:10, cursor:'pointer',
                  background:`${c}12`, border:`1px solid ${c}33`, color:c,
                }}>Apply Velocity</button>
              </div>

              {/* Constant engine force */}
              <div>
                <div style={{ fontSize:9, color:'var(--text3)', marginBottom:4 }}>Constant Force (N) — engine/motor</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
                  {['x','y','z'].map(ax=>(
                    <input key={ax} type="number" step={100} value={engineForce[ax]}
                      onChange={e=>setEngineForce(f=>({...f,[ax]:+e.target.value}))}
                      placeholder={ax.toUpperCase()}
                      style={{ fontSize:11, textAlign:'center' }}/>
                  ))}
                </div>
                <div style={{ display:'flex', gap:4, marginTop:4 }}>
                  <button onClick={handleSetForce} style={{
                    flex:1, padding:'5px 0', borderRadius:'var(--radius-sm)', fontSize:10, cursor:'pointer',
                    background:`${c}12`, border:`1px solid ${c}33`, color:c,
                  }}>Apply Force</button>
                  <button onClick={()=>{ setEngineForce({x:0,y:0,z:0}); setConstantForce(model.id,null) }}
                    style={{ flex:1, padding:'5px 0', borderRadius:'var(--radius-sm)', fontSize:10, cursor:'pointer',
                      background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text2)' }}>
                    Clear Force
                  </button>
                </div>
              </div>

              {/* Telemetry */}
              <div style={{ marginTop:8 }}>
                <div style={{ fontSize:9, color:'var(--text3)', fontWeight:700, letterSpacing:'0.08em', marginBottom:5 }}>TELEMETRY</div>
                <Telemetry modelId={model.id} />
              </div>

              {/* Teleport to origin */}
              <button onClick={()=>teleportBody(model.id,{x:0,y:2,z:0},null)} style={{
                width:'100%', marginTop:6, padding:'5px 0',
                borderRadius:'var(--radius-sm)', fontSize:10, cursor:'pointer',
                background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text2)',
              }}>↩ Reset to Origin</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main PhysicsPanel ─────────────────────────────────────────────────────────
export default function PhysicsPanel() {
  const {
    physicsEnabled, setPhysicsEnabled,
    gravity, setGravity,
    physicsConfig, setPhysicsConfig,
    physicsWind, setPhysicsWind,
    models,
  } = useStore()

  const windSpeed = Math.sqrt((physicsWind.x||0)**2 + (physicsWind.y||0)**2 + (physicsWind.z||0)**2).toFixed(1)

  return (
    <div style={{ padding:12, display:'flex', flexDirection:'column', gap:8, overflowY:'auto' }}>

      {/* Global enable */}
      <div style={{
        padding:'12px 14px', borderRadius:'var(--radius)',
        background: physicsEnabled?'rgba(79,142,255,0.07)':'var(--bg2)',
        border:`1px solid ${physicsEnabled?'rgba(79,142,255,0.3)':'var(--border)'}`,
        transition:'all 0.2s',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: physicsEnabled?12:0 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text0)' }}>Physics Engine</div>
            <div style={{ fontSize:10, color:'var(--text2)', marginTop:2 }}>
              Cannon-es · 120Hz substeps · Baumgarte stabilization
            </div>
          </div>
          <Toggle value={physicsEnabled} onChange={setPhysicsEnabled} />
        </div>

        {physicsEnabled && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <Slider label="Gravity (m/s²)" value={gravity} min={-30} max={5} step={0.1}
              color="var(--accent)" onChange={setGravity}
              fmt={v=>`${v.toFixed(2)}`} unit=" m/s²" />
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {[['🌍 Earth',-9.82],['🌙 Moon',-1.62],['♂ Mars',-3.72],['🪐 Jupiter',-24.8],['🚀 Zero G',0],['🔄 Reverse',9.82]]
                .map(([lbl,g])=>(
                  <button key={lbl} onClick={()=>setGravity(g)} style={{
                    padding:'4px 8px', borderRadius:'var(--radius-sm)', fontSize:10,
                    background: Math.abs(gravity-g)<0.1?'rgba(79,142,255,0.15)':'var(--bg3)',
                    border:`1px solid ${Math.abs(gravity-g)<0.1?'rgba(79,142,255,0.4)':'var(--border)'}`,
                    color: Math.abs(gravity-g)<0.1?'var(--accent)':'var(--text1)', cursor:'pointer',
                  }}>{lbl}</button>
                ))}
            </div>
          </div>
        )}
      </div>

      {physicsEnabled && <>

        {/* Global material */}
        <Sec title="⚙ Global Material Properties" open={false}>
          <Slider label="Global Friction (surfaces)" value={physicsConfig?.globalFriction??0.4}
            min={0} max={2} step={0.01} color="var(--accent)"
            onChange={v=>setPhysicsConfig({globalFriction:v})} />
          <Slider label="Global Restitution (bounciness)" value={physicsConfig?.globalRestitution??0.3}
            min={0} max={1} step={0.01} color="var(--accent)"
            onChange={v=>setPhysicsConfig({globalRestitution:v})} />
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {[['🧊 Ice',{f:0.02,r:0.05}],['🏖 Sand',{f:1.5,r:0.1}],['🏎 Track',{f:0.8,r:0.2}],
              ['🏀 Court',{f:0.6,r:0.6}],['🌊 Wet',{f:0.1,r:0.15}]]
              .map(([lbl,{f,r}])=>(
                <button key={lbl} onClick={()=>setPhysicsConfig({globalFriction:f,globalRestitution:r})} style={{
                  padding:'4px 8px', borderRadius:'var(--radius-sm)', fontSize:10,
                  background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text1)', cursor:'pointer',
                }}>{lbl}</button>
              ))}
          </div>
        </Sec>

        {/* Wind */}
        <Sec title="💨 Wind & Air Force" open={false}>
          <div style={{ fontSize:10, color:'var(--text2)', marginBottom:6 }}>
            Wind speed: <span style={{ color:'var(--accent)', fontFamily:'var(--font-mono)' }}>{windSpeed} N</span>
          </div>
          {['x','y','z'].map((ax,i)=>(
            <Slider key={ax} label={`Wind ${ax.toUpperCase()} (${['East/West','Up/Down','North/South'][i]})`}
              value={physicsWind[ax]||0} min={-50} max={50} step={0.5}
              color={['#ef4444','#22c55e','#3b82f6'][i]}
              onChange={v=>setPhysicsWind({[ax]:v})} fmt={v=>(v>0?'+':'')+v.toFixed(1)} unit=" N" />
          ))}
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {[['Calm',{x:0,y:0,z:0}],['Breeze',{x:5,y:0,z:0}],['Strong',{x:20,y:0,z:0}],['Storm',{x:50,y:0,z:0}]]
              .map(([lbl,w])=>(
                <button key={lbl} onClick={()=>setPhysicsWind(w)} style={{
                  padding:'4px 8px', borderRadius:'var(--radius-sm)', fontSize:10,
                  background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text1)', cursor:'pointer',
                }}>{lbl}</button>
              ))}
          </div>
        </Sec>

        {/* Per-model */}
        <div style={{ display:'flex', alignItems:'center', gap:8, margin:'2px 0' }}>
          <div style={{ flex:1, height:1, background:'var(--border)' }}/>
          <span style={{ fontSize:9, color:'var(--text3)', fontWeight:700 }}>
            {models.length} MODEL{models.length!==1?'S':''}
          </span>
          <div style={{ flex:1, height:1, background:'var(--border)' }}/>
        </div>

        {models.length===0 ? (
          <div style={{ textAlign:'center', color:'var(--text3)', fontSize:11, padding:12 }}>
            Load a model to configure physics
          </div>
        ) : (
          models.map((m,i) => (
            <ModelPhysicsCard key={m.id} model={m} index={i} physicsEnabled={physicsEnabled} />
          ))
        )}

        {/* Info */}
        <div style={{ padding:'10px 12px', borderRadius:'var(--radius-sm)',
          background:'rgba(79,142,255,0.05)', border:'1px solid rgba(79,142,255,0.15)',
          fontSize:10, color:'var(--text2)', lineHeight:1.75 }}>
          💡 <b style={{color:'var(--text1)'}}>Traffic simulation tips:</b><br/>
          • Set road/buildings to <b>Static</b>, vehicles to <b>Dynamic</b><br/>
          • Use <b>Car</b> preset for realistic vehicle mass + COM<br/>
          • Use <b>Constant Force</b> to simulate engine power<br/>
          • Use <b>Set Velocity</b> for scripted traffic movement<br/>
          • Enable <b>CCD</b> on fast-moving vehicles to prevent tunneling<br/>
          • Lower <b>Center of Mass</b> prevents cars from rolling over
        </div>
      </>}
    </div>
  )
}
