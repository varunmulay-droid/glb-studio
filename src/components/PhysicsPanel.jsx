/**
 * PhysicsPanel.jsx
 * UI for the physics engine settings:
 * - Enable/disable physics globally
 * - Gravity control
 * - Per-model: body type, mass, damping, friction, restitution
 * - Apply impulse / reset velocity buttons
 */
import { useState } from 'react'
import useStore from '../store/useStore'
import { applyImpulse, setBodyVelocity } from './PhysicsEngine'

const COLORS = ['#4f8eff','#ef4444','#22c55e','#f59e0b','#8b5cf6','#f97316']

function Slider({ label, value, onChange, min=0, max=1, step=0.01, unit='', color }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:11, color:'var(--text2)' }}>{label}</span>
        <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color: color||'var(--accent)' }}>
          {typeof value === 'number' ? value.toFixed(2) : value}{unit}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))} />
    </div>
  )
}

function ModelPhysicsCard({ model, index }) {
  const { modelPhysics, setModelPhysics, physicsEnabled } = useStore()
  const props = modelPhysics[model.id] || { mass:1, damping:0.4, angularDamping:0.6, type:'dynamic', friction:0.4, restitution:0.2 }
  const c = COLORS[index % COLORS.length]
  const [open, setOpen] = useState(false)

  const update = (key, val) => setModelPhysics(model.id, { [key]: val })

  return (
    <div style={{ marginBottom:6, borderRadius:'var(--radius-sm)',
      border:`1px solid ${open ? `${c}44` : 'var(--border)'}`, overflow:'hidden' }}>
      {/* Header */}
      <button onClick={() => setOpen(!open)} style={{
        width:'100%', padding:'8px 10px', background: open ? `${c}10` : 'var(--bg2)',
        border:'none', color:'var(--text0)', cursor:'pointer',
        display:'flex', alignItems:'center', gap:8, transition:'all 0.12s',
      }}>
        <div style={{ width:8,height:8,borderRadius:1,rotate:'45deg',background:c,flexShrink:0 }} />
        <span style={{ fontSize:12, fontWeight:600, flex:1, textAlign:'left',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{model.name}</span>
        <span style={{ fontSize:10, padding:'2px 6px', borderRadius:3,
          background: props.type==='dynamic' ? 'rgba(79,142,255,0.15)' :
                      props.type==='static'  ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
          color: props.type==='dynamic' ? 'var(--accent)' :
                 props.type==='static'  ? 'var(--danger)' : 'var(--warn)',
          border: `1px solid ${props.type==='dynamic' ? 'rgba(79,142,255,0.3)' :
                  props.type==='static'  ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
        }}>{props.type}</span>
        <span style={{ color:'var(--text3)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding:'10px 12px', background:'var(--bg1)',
          borderTop:`1px solid ${c}22` }}>

          {/* Body type */}
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:10, color:'var(--text2)', fontWeight:600, marginBottom:5,
              letterSpacing:'0.08em', textTransform:'uppercase' }}>Body Type</div>
            <div style={{ display:'flex', gap:4 }}>
              {['dynamic','static','kinematic'].map(t => (
                <button key={t} onClick={() => update('type', t)} style={{
                  flex:1, padding:'5px 0', borderRadius:'var(--radius-sm)',
                  background: props.type===t ? `${c}18` : 'var(--bg3)',
                  border:`1px solid ${props.type===t ? `${c}44` : 'var(--border)'}`,
                  color: props.type===t ? c : 'var(--text1)',
                  fontSize:10, fontWeight: props.type===t ? 700 : 400, cursor:'pointer',
                  textTransform:'capitalize', transition:'all 0.12s',
                }}>{t}</button>
              ))}
            </div>
          </div>

          {props.type !== 'static' && (
            <Slider label="Mass (kg)" value={props.mass||1} min={0.1} max={100} step={0.1}
              onChange={v=>update('mass',v)} unit="kg" color={c} />
          )}
          <Slider label="Linear Damping" value={props.damping||0.4} min={0} max={1}
            onChange={v=>update('damping',v)} color={c} />
          <Slider label="Angular Damping" value={props.angularDamping||0.6} min={0} max={1}
            onChange={v=>update('angularDamping',v)} color={c} />
          <Slider label="Friction" value={props.friction||0.4} min={0} max={1}
            onChange={v=>update('friction',v)} color={c} />
          <Slider label="Restitution (bounce)" value={props.restitution||0.2} min={0} max={1}
            onChange={v=>update('restitution',v)} color={c} />

          {/* Action buttons */}
          {physicsEnabled && props.type === 'dynamic' && (
            <div style={{ display:'flex', gap:5, marginTop:8 }}>
              <button onClick={() => applyImpulse(model.id, { x:0, y:8, z:0 })} style={{
                flex:1, padding:'6px 0', borderRadius:'var(--radius-sm)',
                background:'rgba(79,142,255,0.1)', border:'1px solid rgba(79,142,255,0.3)',
                color:'var(--accent)', fontSize:10, cursor:'pointer',
              }}>⬆ Launch</button>
              <button onClick={() => setBodyVelocity(model.id, { x:0, y:0, z:0 })} style={{
                flex:1, padding:'6px 0', borderRadius:'var(--radius-sm)',
                background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)',
                color:'var(--danger)', fontSize:10, cursor:'pointer',
              }}>⏹ Stop</button>
              <button onClick={() => applyImpulse(model.id, { x:5, y:0, z:0 })} style={{
                flex:1, padding:'6px 0', borderRadius:'var(--radius-sm)',
                background:'rgba(6,214,160,0.08)', border:'1px solid rgba(6,214,160,0.2)',
                color:'var(--accent3)', fontSize:10, cursor:'pointer',
              }}>→ Push</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PhysicsPanel() {
  const { physicsEnabled, setPhysicsEnabled, gravity, setGravity, models } = useStore()

  return (
    <div style={{ padding:12, display:'flex', flexDirection:'column', gap:10 }}>

      {/* Global toggle */}
      <div style={{
        padding:'12px 14px', borderRadius:'var(--radius)',
        background: physicsEnabled ? 'rgba(79,142,255,0.08)' : 'var(--bg2)',
        border:`1px solid ${physicsEnabled ? 'rgba(79,142,255,0.25)' : 'var(--border)'}`,
        transition:'all 0.2s',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: physicsEnabled ? 12 : 0 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text0)' }}>Physics Engine</div>
            <div style={{ fontSize:10, color:'var(--text2)', marginTop:2 }}>
              {physicsEnabled ? 'Cannon-es · Real-time simulation' : 'Disabled — click to enable'}
            </div>
          </div>
          <button onClick={() => setPhysicsEnabled(!physicsEnabled)} style={{
            width:44, height:24, borderRadius:12,
            background: physicsEnabled ? 'var(--accent)' : 'var(--bg4)',
            border:'none', cursor:'pointer', position:'relative', transition:'background 0.2s',
            boxShadow: physicsEnabled ? '0 0 10px rgba(79,142,255,0.4)' : 'none',
          }}>
            <div style={{
              position:'absolute', top:4, width:16, height:16, borderRadius:8,
              background:'#fff', transition:'left 0.2s',
              left: physicsEnabled ? 24 : 4,
              boxShadow:'0 1px 4px rgba(0,0,0,0.4)',
            }}/>
          </button>
        </div>

        {physicsEnabled && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:11, color:'var(--text2)' }}>Gravity (m/s²)</span>
              <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'var(--accent)' }}>
                {gravity.toFixed(2)}
              </span>
            </div>
            <input type="range" min={-30} max={0} step={0.1} value={gravity}
              onChange={e => setGravity(parseFloat(e.target.value))} />
            <div style={{ display:'flex', gap:5, marginTop:8 }}>
              {[
                { label:'Earth', val:-9.82 },
                { label:'Moon', val:-1.62 },
                { label:'Mars', val:-3.72 },
                { label:'Zero', val:0 },
              ].map(p => (
                <button key={p.label} onClick={() => setGravity(p.val)} style={{
                  flex:1, padding:'4px 0', borderRadius:'var(--radius-sm)',
                  background: Math.abs(gravity - p.val) < 0.1 ? 'rgba(79,142,255,0.15)' : 'var(--bg3)',
                  border:`1px solid ${Math.abs(gravity - p.val) < 0.1 ? 'rgba(79,142,255,0.4)' : 'var(--border)'}`,
                  color: Math.abs(gravity - p.val) < 0.1 ? 'var(--accent)' : 'var(--text1)',
                  fontSize:9, fontWeight:600, cursor:'pointer', transition:'all 0.12s',
                }}>{p.label}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Info box */}
      {physicsEnabled && (
        <div style={{ padding:'10px 12px', borderRadius:'var(--radius-sm)',
          background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)',
          fontSize:11, color:'var(--text2)', lineHeight:1.6 }}>
          ⚡ Physics auto-applies to all models. Set each model's type:<br/>
          <span style={{ color:'var(--accent)' }}>Dynamic</span> — affected by gravity & forces<br/>
          <span style={{ color:'var(--danger)' }}>Static</span> — immovable (ground, walls, city)<br/>
          <span style={{ color:'var(--warn)' }}>Kinematic</span> — moved by animation, not gravity
        </div>
      )}

      {/* Per-model cards */}
      {models.length > 0 && (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ flex:1, height:1, background:'var(--border)' }} />
            <span style={{ fontSize:10, color:'var(--text3)', fontWeight:600 }}>
              {models.length} MODEL{models.length>1?'S':''}
            </span>
            <div style={{ flex:1, height:1, background:'var(--border)' }} />
          </div>
          {models.map((m, i) => (
            <ModelPhysicsCard key={m.id} model={m} index={i} />
          ))}
        </>
      )}

      {models.length === 0 && physicsEnabled && (
        <div style={{ textAlign:'center', color:'var(--text3)', fontSize:12, padding:12 }}>
          Load models to configure physics
        </div>
      )}
    </div>
  )
}
