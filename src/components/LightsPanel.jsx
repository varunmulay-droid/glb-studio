/**
 * LightsPanel.jsx — Scene lighting system
 * Add/remove/configure point lights, spot lights, directional lights, rect area lights.
 * All lights rendered in Scene.jsx via sceneLights store array.
 */
import { useState } from 'react'
import useStore from '../store/useStore'

const generateId = () => `light_${Math.random().toString(36).substr(2,7)}`

const LIGHT_TYPES = [
  { type:'point',       icon:'💡', label:'Point Light',       desc:'Radiates in all directions from a point' },
  { type:'spot',        icon:'🔦', label:'Spot Light',         desc:'Cone-shaped beam, like a flashlight' },
  { type:'directional', icon:'☀️', label:'Directional',       desc:'Parallel rays like sunlight, infinite distance' },
  { type:'ambient',     icon:'🌫', label:'Ambient',           desc:'Flat fill light, no shadows, no position' },
  { type:'hemisphere',  icon:'🌅', label:'Hemisphere',         desc:'Sky/ground gradient, natural outdoor fill' },
]

const PRESET_COLORS = [
  '#ffffff','#fffae0','#ffd27a','#ff9a3c','#ff4d4d',
  '#ff88ff','#88aaff','#00e5ff','#00ff88','#ffaa00',
]

function ColorPicker({ value, onChange }) {
  return (
    <div>
      <div style={{ fontSize:10, color:'var(--text2)', fontWeight:500, marginBottom:5 }}>Color</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:5 }}>
        {PRESET_COLORS.map(c=>(
          <div key={c} onClick={()=>onChange(c)}
            style={{ width:22, height:22, borderRadius:4, background:c, cursor:'pointer',
              border:`2px solid ${value===c?'var(--text0)':'rgba(255,255,255,0.12)'}`,
              transition:'transform 0.1s' }}
            onMouseEnter={e=>e.currentTarget.style.transform='scale(1.15)'}
            onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
          />
        ))}
        <label style={{ width:22, height:22, borderRadius:4, cursor:'pointer',
          border:'1px dashed var(--border-hi)', display:'flex', alignItems:'center',
          justifyContent:'center', color:'var(--text2)', fontSize:14, overflow:'hidden' }}>
          +
          <input type="color" value={value} onChange={e=>onChange(e.target.value)}
            style={{ position:'absolute', opacity:0, width:0, height:0 }}/>
        </label>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:20, height:20, borderRadius:3, background:value, flexShrink:0 }}/>
        <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--text1)' }}>{value}</span>
      </div>
    </div>
  )
}

function Vec3Input({ label, value, onChange, step=0.5 }) {
  const axes=['X','Y','Z'], colors=['#ef4444','#22c55e','#3b82f6']
  const val = value || [0,0,0]
  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ fontSize:10, color:'var(--text2)', fontWeight:500, marginBottom:4 }}>{label}</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
        {axes.map((ax,i)=>(
          <div key={ax} style={{ display:'flex', alignItems:'center',
            background:'var(--bg1)', border:`1px solid ${colors[i]}33`, borderRadius:'var(--radius-sm)', overflow:'hidden' }}>
            <span style={{ padding:'0 4px', fontSize:9, fontWeight:700, color:colors[i],
              background:'var(--bg2)', alignSelf:'stretch', display:'flex', alignItems:'center',
              borderRight:`1px solid ${colors[i]}22` }}>{ax}</span>
            <input type="number" step={step} value={(val[i]||0).toFixed(1)}
              onChange={e=>{ const v=[...val]; v[i]=parseFloat(e.target.value)||0; onChange(v) }}
              style={{ border:'none', background:'transparent', width:'100%',
                padding:'5px 4px', fontSize:10, fontFamily:'var(--font-mono)', color:'var(--text0)' }}/>
          </div>
        ))}
      </div>
    </div>
  )
}

function LightCard({ light }) {
  const { updateSceneLight, removeSceneLight } = useStore()
  const [open, setOpen] = useState(false)
  const upd = (props) => updateSceneLight(light.id, props)

  const hasPosition = !['ambient','hemisphere'].includes(light.type)
  const hasTarget   = ['spot','directional'].includes(light.type)
  const hasAngle    = light.type === 'spot'
  const hasDist     = ['point','spot'].includes(light.type)

  const typeInfo = LIGHT_TYPES.find(t=>t.type===light.type)

  return (
    <div style={{ border:`1px solid ${open?'var(--border-hi)':'var(--border)'}`,
      borderRadius:'var(--radius)', overflow:'hidden', marginBottom:6 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', padding:'8px 10px',
        background: open?'var(--bg3)':'var(--bg2)', gap:8 }}>
        <span style={{ fontSize:16, flexShrink:0 }}>{typeInfo?.icon}</span>
        <div style={{ flex:1, minWidth:0 }}>
          <input value={light.name} onChange={e=>upd({name:e.target.value})}
            onClick={e=>e.stopPropagation()}
            style={{ border:'none', background:'transparent', color:'var(--text0)',
              fontSize:12, fontWeight:700, width:'100%', padding:0, cursor:'text' }}/>
          <div style={{ fontSize:9, color:'var(--text3)' }}>{typeInfo?.label}</div>
        </div>

        {/* Intensity display */}
        <span style={{ fontSize:10, fontFamily:'var(--font-mono)',
          color:'var(--warn)', minWidth:30, textAlign:'right' }}>
          {(light.intensity||1).toFixed(1)}×
        </span>

        {/* Visible toggle */}
        <button onClick={e=>{e.stopPropagation();upd({visible:!light.visible})}}
          style={{ background:'none', border:'none', cursor:'pointer', fontSize:14,
            color: light.visible?'var(--accent3)':'var(--text3)', padding:'0 2px' }}>
          {light.visible?'👁':'🙈'}
        </button>

        {/* Shadow toggle */}
        {hasPosition && (
          <button onClick={e=>{e.stopPropagation();upd({castShadow:!light.castShadow})}}
            title="Cast shadows"
            style={{ background:'none', border:'none', cursor:'pointer', fontSize:12,
              color: light.castShadow?'var(--warn)':'var(--text3)', padding:'0 2px' }}>
            🌑
          </button>
        )}

        <button onClick={()=>setOpen(v=>!v)}
          style={{ background:'none', border:'none', color:'var(--text2)', cursor:'pointer', fontSize:12 }}>
          {open?'▲':'▼'}
        </button>

        <button onClick={()=>removeSceneLight(light.id)}
          style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:13,
            transition:'color 0.12s' }}
          onMouseEnter={e=>e.currentTarget.style.color='var(--danger)'}
          onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}
          title="Delete light">✕</button>
      </div>

      {open && (
        <div style={{ padding:'10px 12px', display:'flex', flexDirection:'column', gap:10 }}>

          <ColorPicker value={light.color||'#ffffff'} onChange={c=>upd({color:c})} />

          {/* Intensity */}
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:10, color:'var(--text2)', fontWeight:500 }}>Intensity</span>
              <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--warn)' }}>
                {(light.intensity||1).toFixed(2)}
              </span>
            </div>
            <input type="range" min={0} max={20} step={0.05} value={light.intensity||1}
              onChange={e=>upd({intensity:+e.target.value})} />
          </div>

          {/* Position */}
          {hasPosition && (
            <Vec3Input label="Position" value={light.position} onChange={v=>upd({position:v})} />
          )}

          {/* Target/direction */}
          {hasTarget && (
            <Vec3Input label="Target" value={light.target||[0,0,0]} onChange={v=>upd({target:v})} />
          )}

          {/* Hemisphere sky/ground colors */}
          {light.type==='hemisphere' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div>
                <div style={{ fontSize:10, color:'var(--text2)', marginBottom:4 }}>Sky Color</div>
                <input type="color" value={light.skyColor||'#88aaff'}
                  onChange={e=>upd({skyColor:e.target.value})}
                  style={{ width:'100%', height:32, borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', cursor:'pointer' }}/>
              </div>
              <div>
                <div style={{ fontSize:10, color:'var(--text2)', marginBottom:4 }}>Ground Color</div>
                <input type="color" value={light.groundColor||'#443322'}
                  onChange={e=>upd({groundColor:e.target.value})}
                  style={{ width:'100%', height:32, borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', cursor:'pointer' }}/>
              </div>
            </div>
          )}

          {/* Spot angle */}
          {hasAngle && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:10, color:'var(--text2)' }}>Spot Angle</span>
                <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--accent)' }}>
                  {Math.round((light.angle||0.3)*(180/Math.PI))}°
                </span>
              </div>
              <input type="range" min={0.05} max={1.5} step={0.01} value={light.angle||0.3}
                onChange={e=>upd({angle:+e.target.value})} />
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, marginTop:8 }}>
                <span style={{ fontSize:10, color:'var(--text2)' }}>Penumbra (soft edge)</span>
                <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--accent)' }}>
                  {(light.penumbra||0).toFixed(2)}
                </span>
              </div>
              <input type="range" min={0} max={1} step={0.01} value={light.penumbra||0}
                onChange={e=>upd({penumbra:+e.target.value})} />
            </div>
          )}

          {/* Distance */}
          {hasDist && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:10, color:'var(--text2)' }}>Distance (0 = infinite)</span>
                <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--accent)' }}>
                  {light.distance||0}
                </span>
              </div>
              <input type="range" min={0} max={100} step={0.5} value={light.distance||0}
                onChange={e=>upd({distance:+e.target.value})} />
            </div>
          )}

          {/* Shadow map size */}
          {light.castShadow && hasPosition && (
            <div>
              <div style={{ fontSize:10, color:'var(--text2)', marginBottom:5 }}>Shadow Map Size</div>
              <div style={{ display:'flex', gap:4 }}>
                {[512,1024,2048,4096].map(sz=>(
                  <button key={sz} onClick={()=>upd({shadowMapSize:sz})} style={{
                    flex:1, padding:'4px 0', fontSize:9, borderRadius:'var(--radius-sm)',
                    background:(light.shadowMapSize||1024)===sz?'rgba(245,158,11,0.15)':'var(--bg3)',
                    border:`1px solid ${(light.shadowMapSize||1024)===sz?'rgba(245,158,11,0.4)':'var(--border)'}`,
                    color:(light.shadowMapSize||1024)===sz?'var(--warn)':'var(--text1)', cursor:'pointer',
                  }}>{sz}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main LightsPanel ──────────────────────────────────────────────────────────
export default function LightsPanel() {
  const { sceneLights, addSceneLight } = useStore()

  const addLight = (type) => {
    const defaults = {
      ambient:     { intensity:0.4, color:'#ffffff', position:[0,10,0] },
      point:       { intensity:2, color:'#ffffff', position:[3,5,3], distance:20, castShadow:true, shadowMapSize:1024 },
      spot:        { intensity:3, color:'#ffffff', position:[5,10,0], target:[0,0,0], angle:0.4, penumbra:0.2, distance:30, castShadow:true, shadowMapSize:1024 },
      directional: { intensity:2, color:'#fff5e0', position:[5,10,3], target:[0,0,0], castShadow:true, shadowMapSize:2048 },
      hemisphere:  { intensity:0.6, skyColor:'#88aaff', groundColor:'#443322', position:[0,10,0] },
    }
    addSceneLight({
      id:      generateId(),
      type,
      name:    LIGHT_TYPES.find(t=>t.type===type)?.label || type,
      visible: true,
      castShadow: false,
      ...defaults[type],
    })
  }

  // Scene presets
  const applyPreset = (name) => {
    const { clearAndSet } = (() => {
      // build preset light sets
      const presets = {
        studio: [
          { id:generateId(), type:'ambient',     name:'Studio Ambient',  color:'#fff8f0', intensity:0.4, visible:true, castShadow:false },
          { id:generateId(), type:'directional', name:'Key Light',       color:'#fff5e0', intensity:2,   visible:true, castShadow:true,  position:[5,8,3],   target:[0,0,0], shadowMapSize:2048 },
          { id:generateId(), type:'directional', name:'Fill Light',      color:'#c0d8ff', intensity:0.6, visible:true, castShadow:false, position:[-4,4,-2], target:[0,0,0] },
          { id:generateId(), type:'directional', name:'Rim Light',       color:'#ffefcc', intensity:0.8, visible:true, castShadow:false, position:[0,6,-6],  target:[0,0,0] },
        ],
        day: [
          { id:generateId(), type:'hemisphere',  name:'Sky',   skyColor:'#87ceeb', groundColor:'#556b2f', intensity:0.7, visible:true, castShadow:false },
          { id:generateId(), type:'directional', name:'Sun',   color:'#fff8e1', intensity:3, visible:true, castShadow:true, position:[10,20,5], target:[0,0,0], shadowMapSize:2048 },
        ],
        night: [
          { id:generateId(), type:'ambient',     name:'Night Ambient', color:'#0a0a2e', intensity:0.15, visible:true, castShadow:false },
          { id:generateId(), type:'point',       name:'Street Lamp 1', color:'#ffa040', intensity:4, visible:true, castShadow:true, position:[5,5,0],  distance:15, shadowMapSize:512 },
          { id:generateId(), type:'point',       name:'Street Lamp 2', color:'#ffa040', intensity:4, visible:true, castShadow:true, position:[-5,5,0], distance:15, shadowMapSize:512 },
          { id:generateId(), type:'point',       name:'Street Lamp 3', color:'#ffa040', intensity:4, visible:true, castShadow:true, position:[0,5,8],  distance:15, shadowMapSize:512 },
        ],
        traffic: [
          { id:generateId(), type:'hemisphere',  name:'Sky',           skyColor:'#87ceeb', groundColor:'#333333', intensity:0.6, visible:true, castShadow:false },
          { id:generateId(), type:'directional', name:'Sun',           color:'#fff5e0', intensity:2, visible:true, castShadow:true, position:[8,15,3], target:[0,0,0], shadowMapSize:2048 },
          { id:generateId(), type:'point',       name:'Traffic Red',   color:'#ff2020', intensity:3, visible:true, castShadow:false, position:[0,5,0],  distance:8 },
          { id:generateId(), type:'point',       name:'Traffic Green', color:'#20ff20', intensity:3, visible:true, castShadow:false, position:[3,5,0],  distance:8 },
          { id:generateId(), type:'point',       name:'Traffic Amber', color:'#ffaa00', intensity:3, visible:true, castShadow:false, position:[-3,5,0], distance:8 },
        ],
        neon: [
          { id:generateId(), type:'ambient', name:'Dark Ambient', color:'#0a0020', intensity:0.1, visible:true, castShadow:false },
          { id:generateId(), type:'point',   name:'Neon Cyan',   color:'#00ffff', intensity:5, visible:true, castShadow:false, position:[5,3,0],  distance:20 },
          { id:generateId(), type:'point',   name:'Neon Pink',   color:'#ff00aa', intensity:5, visible:true, castShadow:false, position:[-5,3,0], distance:20 },
          { id:generateId(), type:'point',   name:'Neon Green',  color:'#00ff88', intensity:5, visible:true, castShadow:false, position:[0,3,8],  distance:20 },
        ],
      }
      return { clearAndSet: presets[name] || [] }
    })()
    useStore.setState({ sceneLights: clearAndSet })
  }

  return (
    <div style={{ padding:12, display:'flex', flexDirection:'column', gap:10, overflowY:'auto' }}>

      {/* Presets */}
      <div>
        <div style={{ fontSize:10, color:'var(--text3)', fontWeight:700,
          letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:7 }}>Scene Presets</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
          {[['🎬 Studio','studio'],['☀️ Daytime','day'],['🌙 Night','night'],['🚦 Traffic','traffic'],['🌆 Neon','neon']]
            .map(([lbl,id])=>(
              <button key={id} onClick={()=>applyPreset(id)} style={{
                padding:'8px 0', borderRadius:'var(--radius-sm)', cursor:'pointer', fontSize:11,
                background:'var(--bg2)', border:'1px solid var(--border)', color:'var(--text1)',
                transition:'all 0.12s',
              }}
                onMouseEnter={e=>{e.currentTarget.style.background='var(--bg3)';e.currentTarget.style.color='var(--text0)'}}
                onMouseLeave={e=>{e.currentTarget.style.background='var(--bg2)';e.currentTarget.style.color='var(--text1)'}}
              >{lbl}</button>
            ))}
        </div>
      </div>

      {/* Add light */}
      <div>
        <div style={{ fontSize:10, color:'var(--text3)', fontWeight:700,
          letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:7 }}>Add Light</div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {LIGHT_TYPES.map(t=>(
            <button key={t.type} onClick={()=>addLight(t.type)} style={{
              padding:'8px 12px', borderRadius:'var(--radius-sm)', cursor:'pointer',
              background:'var(--bg2)', border:'1px solid var(--border)', color:'var(--text1)',
              textAlign:'left', transition:'all 0.12s', display:'flex', alignItems:'center', gap:10,
            }}
              onMouseEnter={e=>{e.currentTarget.style.background='var(--bg3)';e.currentTarget.style.borderColor='var(--border-hi)'}}
              onMouseLeave={e=>{e.currentTarget.style.background='var(--bg2)';e.currentTarget.style.borderColor='var(--border)'}}
            >
              <span style={{ fontSize:18 }}>{t.icon}</span>
              <div>
                <div style={{ fontSize:11, fontWeight:600 }}>{t.label}</div>
                <div style={{ fontSize:9, color:'var(--text3)', marginTop:1 }}>{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Light list */}
      {sceneLights.length > 0 && (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <div style={{ flex:1, height:1, background:'var(--border)' }}/>
            <span style={{ fontSize:9, color:'var(--text3)', fontWeight:700 }}>
              {sceneLights.length} LIGHT{sceneLights.length!==1?'S':''}
            </span>
            <div style={{ flex:1, height:1, background:'var(--border)' }}/>
          </div>
          {sceneLights.map(l=><LightCard key={l.id} light={l} />)}
        </div>
      )}
    </div>
  )
}
