import { useState } from 'react'
import useStore from '../store/useStore'

const DEG = 180 / Math.PI

function Section({ title, children, defaultOpen=true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom:'1px solid var(--border)' }}>
      <button onClick={()=>setOpen(v=>!v)}
        style={{ width:'100%',padding:'8px 12px',display:'flex',alignItems:'center',
          justifyContent:'space-between',background:'transparent',border:'none',
          color:'var(--text1)',fontSize:11,fontWeight:600,cursor:'pointer',
          letterSpacing:'0.08em',textTransform:'uppercase' }}>
        {title}
        <span style={{ color:'var(--text3)',transition:'transform 0.15s',display:'inline-block',
          transform:open?'rotate(0deg)':'rotate(-90deg)' }}>▾</span>
      </button>
      {open && <div style={{ padding:'0 12px 12px' }}>{children}</div>}
    </div>
  )
}

function Vec3({ label, value, onChange, step=0.01, scale=1, decimals=3 }) {
  const axes=['X','Y','Z'], colors=['#ef4444','#22c55e','#3b82f6']
  return (
    <div style={{marginBottom:8}}>
      <div style={{fontSize:10,color:'var(--text2)',fontWeight:600,letterSpacing:'0.06em',marginBottom:4}}>{label}</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4}}>
        {axes.map((ax,i)=>(
          <div key={ax} style={{display:'flex',alignItems:'center',background:'var(--bg1)',
            border:`1px solid ${colors[i]}33`,borderRadius:'var(--radius-sm)',overflow:'hidden'}}
            onFocusCapture={e=>e.currentTarget.style.borderColor=colors[i]}
            onBlurCapture={e=>e.currentTarget.style.borderColor=`${colors[i]}33`}>
            <span style={{padding:'0 5px',fontSize:9,fontWeight:700,color:colors[i],
              background:'var(--bg2)',alignSelf:'stretch',display:'flex',alignItems:'center',
              borderRight:`1px solid ${colors[i]}22`}}>{ax}</span>
            <input type="number" step={step}
              value={((value?.[i]||0)*scale).toFixed(decimals)}
              onChange={e=>{
                const v=[...(value||[0,0,0])]; v[i]=(parseFloat(e.target.value)||0)/scale; onChange(v)
              }}
              style={{border:'none',background:'transparent',width:'100%',
                padding:'5px 4px',fontSize:11,fontFamily:'var(--font-mono)',color:'var(--text0)'}}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

const PRESET_COLORS = ['#ffffff','#ff4444','#44ff88','#4488ff','#ffaa00','#ff44aa','#44ffff','#000000']

function MaterialEditor({ model }) {
  const { setModelMaterial, resetModelMaterial } = useStore.getState()
  const mat = model.materialOverride || {}
  const [showPicker, setShowPicker] = useState(false)

  return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      {/* Color override */}
      <div>
        <div style={{fontSize:10,color:'var(--text2)',fontWeight:600,marginBottom:5}}>Color Override</div>
        <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:5}}>
          {PRESET_COLORS.map(c=>(
            <div key={c} onClick={()=>setModelMaterial(model.id,{color:c})}
              style={{width:22,height:22,borderRadius:4,background:c,cursor:'pointer',
                border:`2px solid ${mat.color===c?'var(--accent)':'rgba(255,255,255,0.15)'}`,
                transition:'transform 0.1s'}}
              onMouseEnter={e=>e.currentTarget.style.transform='scale(1.15)'}
              onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
            />
          ))}
          <label style={{width:22,height:22,borderRadius:4,cursor:'pointer',
            border:'1px dashed var(--border-hi)',display:'flex',alignItems:'center',justifyContent:'center',
            color:'var(--text2)',fontSize:14,overflow:'hidden'}}>
            +
            <input type="color" value={mat.color||'#ffffff'}
              onChange={e=>setModelMaterial(model.id,{color:e.target.value})}
              style={{position:'absolute',opacity:0,width:0,height:0}}/>
          </label>
          {mat.color && <button onClick={()=>setModelMaterial(model.id,{color:undefined})}
            style={{width:22,height:22,borderRadius:4,background:'var(--bg3)',border:'1px solid var(--border)',
              color:'var(--text3)',fontSize:10,cursor:'pointer'}}>✕</button>}
        </div>
      </div>

      {/* PBR sliders */}
      {[['Roughness','roughness'],['Metalness','metalness'],['Opacity','opacity']].map(([lbl,key])=>(
        <div key={key}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
            <span style={{fontSize:10,color:'var(--text2)'}}>{lbl}</span>
            <span style={{fontSize:10,fontFamily:'var(--font-mono)',color:'var(--accent)'}}>
              {(mat[key]!==undefined ? mat[key] : (key==='opacity'?1:key==='roughness'?0.5:0)).toFixed(2)}
            </span>
          </div>
          <input type="range" min={0} max={1} step={0.01}
            value={mat[key]!==undefined?mat[key]:(key==='opacity'?1:key==='roughness'?0.5:0)}
            onChange={e=>setModelMaterial(model.id,{[key]:parseFloat(e.target.value)})}/>
        </div>
      ))}

      {/* Toggles */}
      <div style={{display:'flex',gap:6}}>
        <button onClick={()=>setModelMaterial(model.id,{wireframe:!mat.wireframe})} style={{
          flex:1,padding:'5px 0',borderRadius:'var(--radius-sm)',cursor:'pointer',fontSize:10,
          background:mat.wireframe?'rgba(79,142,255,0.12)':'var(--bg2)',
          border:`1px solid ${mat.wireframe?'rgba(79,142,255,0.3)':'var(--border)'}`,
          color:mat.wireframe?'var(--accent)':'var(--text1)',
        }}>◻ Wireframe</button>
        <button onClick={()=>resetModelMaterial(model.id)} style={{
          flex:1,padding:'5px 0',borderRadius:'var(--radius-sm)',cursor:'pointer',fontSize:10,
          background:'var(--bg2)',border:'1px solid var(--border)',color:'var(--text2)',
        }}>↺ Reset</button>
      </div>
    </div>
  )
}

export default function PropertiesPanel() {
  const {
    models, selectedModelId, updateModelTransform, setModelActiveAnimation,
    setModelAnimSpeed, currentFrame, addKeyframe, removeKeyframe,
    getKeyframesForModel, keyframes, removeModel, selectModel, duplicateModel,
    snapEnabled, snapTranslate, snapRotate, setSnapTranslate, setSnapRotate,
    pushUndo,
  } = useStore()

  const model = models.find(m => m.id === selectedModelId)

  const snap = (val, grid) => {
    if (!snapEnabled || !grid) return val
    return val.map(v => Math.round(v / grid) * grid)
  }

  if (!model) return (
    <div style={{padding:24,textAlign:'center'}}>
      <div style={{fontSize:32,opacity:0.12,marginBottom:10}}>◎</div>
      <div style={{fontSize:13,fontWeight:600,color:'var(--text1)'}}>Nothing selected</div>
      <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>Click a model in the scene</div>
    </div>
  )

  const kfList   = getKeyframesForModel(model.id)
  const hasKfNow = keyframes[currentFrame]?.[model.id]

  return (
    <div>
      {/* Header */}
      <div style={{padding:'10px 12px 8px',borderBottom:'1px solid var(--border)',
        display:'flex',alignItems:'center',gap:8}}>
        <div style={{width:10,height:10,borderRadius:'50%',background:'var(--accent)',
          boxShadow:'0 0 8px rgba(79,142,255,0.5)'}}/>
        <span style={{fontSize:13,fontWeight:600,flex:1,overflow:'hidden',
          textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{model.name}</span>
        <button onClick={()=>duplicateModel(model.id)} title="Duplicate [D]"
          style={{background:'none',border:'none',color:'var(--text2)',cursor:'pointer',fontSize:14}}>⧉</button>
        <button onClick={()=>{removeModel(model.id);selectModel(null)}} title="Delete"
          style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:14,transition:'color 0.12s'}}
          onMouseEnter={e=>e.currentTarget.style.color='var(--danger)'}
          onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}
        >🗑</button>
      </div>

      {/* Transform */}
      <Section title="Transform">
        {snapEnabled && (
          <div style={{marginBottom:8,padding:'6px 8px',background:'rgba(245,158,11,0.06)',
            border:'1px solid rgba(245,158,11,0.15)',borderRadius:'var(--radius-sm)',
            fontSize:10,color:'var(--warn)',display:'flex',gap:8,alignItems:'center'}}>
            🧲 Snap ON — Translate: {snapTranslate}u · Rotate: {snapRotate}°
          </div>
        )}
        <Vec3 label="Position" value={model.position} step={snapEnabled?snapTranslate:0.1} decimals={2}
          onChange={v=>{ pushUndo(); updateModelTransform(model.id,'position',snap(v,snapEnabled?snapTranslate:null)) }} />
        <Vec3 label="Rotation °" value={model.rotation} step={snapEnabled?snapRotate/DEG:0.01} decimals={2} scale={DEG}
          onChange={v=>{ pushUndo(); updateModelTransform(model.id,'rotation',v) }} />
        <Vec3 label="Scale" value={model.scale} step={snapEnabled?snapTranslate:0.05} decimals={3}
          onChange={v=>{ pushUndo(); updateModelTransform(model.id,'scale',v) }} />
        <div style={{display:'flex',gap:5,marginTop:4}}>
          <button onClick={()=>{pushUndo();updateModelTransform(model.id,'position',[0,0,0]);updateModelTransform(model.id,'rotation',[0,0,0]);updateModelTransform(model.id,'scale',[1,1,1])}}
            style={{flex:1,padding:'5px 0',borderRadius:'var(--radius-sm)',background:'var(--bg2)',
              border:'1px solid var(--border)',color:'var(--text2)',fontSize:11,cursor:'pointer'}}>↺ Reset</button>
          <button onClick={()=>{updateModelTransform(model.id,'scale',[...model.scale].map(v=>v*2))}}
            style={{flex:1,padding:'5px 0',borderRadius:'var(--radius-sm)',background:'var(--bg2)',
              border:'1px solid var(--border)',color:'var(--text2)',fontSize:11,cursor:'pointer'}}>2× Scale</button>
          <button onClick={()=>{updateModelTransform(model.id,'scale',[...model.scale].map(v=>v*0.5))}}
            style={{flex:1,padding:'5px 0',borderRadius:'var(--radius-sm)',background:'var(--bg2)',
              border:'1px solid var(--border)',color:'var(--text2)',fontSize:11,cursor:'pointer'}}>½ Scale</button>
        </div>
      </Section>

      {/* Material */}
      <Section title="Material" defaultOpen={false}>
        <MaterialEditor model={model} />
      </Section>

      {/* Animations */}
      {model.animations.length > 0 && (
        <Section title="Animations">
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {model.animations.map(anim=>(
              <button key={anim} onClick={()=>setModelActiveAnimation(model.id,anim)} style={{
                padding:'7px 10px',borderRadius:'var(--radius-sm)',
                background:model.activeAnimation===anim?'rgba(6,214,160,0.1)':'var(--bg2)',
                border:`1px solid ${model.activeAnimation===anim?'rgba(6,214,160,0.3)':'var(--border)'}`,
                color:model.activeAnimation===anim?'var(--accent3)':'var(--text1)',
                fontSize:11,textAlign:'left',cursor:'pointer',transition:'all 0.12s',
                display:'flex',alignItems:'center',gap:6,
              }}>
                <span>{model.activeAnimation===anim?'▶':'○'}</span>{anim}
              </button>
            ))}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:8}}>
            <span style={{fontSize:10,color:'var(--text2)'}}>Speed</span>
            <input type="range" min={0.1} max={3} step={0.05} value={model.animationSpeed}
              onChange={e=>setModelAnimSpeed(model.id,+e.target.value)} style={{flex:1}}/>
            <span style={{fontSize:11,fontFamily:'var(--font-mono)',color:'var(--accent)',minWidth:32}}>
              {model.animationSpeed.toFixed(1)}×
            </span>
          </div>
        </Section>
      )}

      {/* Keyframes */}
      <Section title="Keyframes">
        {/* Easing selector */}
        <div style={{marginBottom:8}}>
          <div style={{fontSize:10,color:'var(--text2)',marginBottom:4}}>Easing for next keyframe</div>
          <div style={{display:'flex',gap:3}}>
            {['linear','ease-in','ease-out','ease-in-out'].map(e=>(
              <button key={e}
                onClick={()=>useStore.setState(s=>({_nextEasing:e}))}
                style={{
                  flex:1,padding:'4px 0',borderRadius:'var(--radius-sm)',fontSize:9,cursor:'pointer',
                  background:'var(--bg2)',border:'1px solid var(--border)',
                  color:'var(--text1)',transition:'all 0.1s',
                }}>{e.replace('ease-','')}</button>
            ))}
          </div>
        </div>

        <div style={{display:'flex',gap:5,marginBottom:8}}>
          <button onClick={()=>{ pushUndo(); addKeyframe(currentFrame,model.id) }} style={{
            flex:1,padding:'7px 0',borderRadius:'var(--radius-sm)',
            background:hasKfNow?'rgba(245,158,11,0.15)':'rgba(79,142,255,0.1)',
            border:`1px solid ${hasKfNow?'rgba(245,158,11,0.4)':'rgba(79,142,255,0.3)'}`,
            color:hasKfNow?'var(--warn)':'var(--accent)',
            fontSize:11,fontWeight:600,cursor:'pointer',
          }}>{hasKfNow?'◆ Update':'◆ Add @ '+currentFrame}</button>
          {hasKfNow&&<button onClick={()=>{pushUndo();removeKeyframe(currentFrame,model.id)}} style={{
            padding:'7px 10px',borderRadius:'var(--radius-sm)',background:'rgba(239,68,68,0.08)',
            border:'1px solid rgba(239,68,68,0.2)',color:'var(--danger)',cursor:'pointer',fontSize:12,
          }}>✕</button>}
        </div>

        <div style={{fontSize:11,color:'var(--text2)',marginBottom:5}}>
          Frame {currentFrame} {hasKfNow?'— ◆ keyframe set':'— no keyframe'}
        </div>

        {kfList.length>0&&(
          <div style={{maxHeight:130,overflow:'auto',display:'flex',flexDirection:'column',gap:2}}>
            {kfList.map(({frame,data})=>(
              <div key={frame} onClick={()=>useStore.getState().setCurrentFrame(frame)}
                style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'4px 8px',borderRadius:'var(--radius-sm)',cursor:'pointer',
                  background:frame===currentFrame?'rgba(245,158,11,0.1)':'var(--bg2)',
                  border:`1px solid ${frame===currentFrame?'rgba(245,158,11,0.25)':'var(--border)'}`}}>
                <span style={{fontSize:10,color:frame===currentFrame?'var(--warn)':'var(--text1)'}}>
                  ◆ Frame {frame}
                  {data.easing&&data.easing!=='linear'&&<span style={{fontSize:9,color:'var(--text3)',marginLeft:4}}>({data.easing})</span>}
                </span>
                <button onClick={e=>{e.stopPropagation();pushUndo();removeKeyframe(frame,model.id)}}
                  style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:11}}>✕</button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Shadow / Visibility */}
      <Section title="Object Settings" defaultOpen={false}>
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {[['Cast Shadow','castShadow'],['Receive Shadow','receiveShadow']].map(([lbl,key])=>(
            <div key={key} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:11,color:'var(--text1)'}}>{lbl}</span>
              <button onClick={()=>updateModelTransform(model.id,key,!(model[key]??true))} style={{
                width:36,height:20,borderRadius:10,cursor:'pointer',position:'relative',
                background:(model[key]??true)?'var(--accent)':'var(--bg4)',border:'none',
                transition:'background 0.2s',
              }}>
                <div style={{position:'absolute',top:2,width:16,height:16,borderRadius:8,
                  background:'#fff',transition:'left 0.2s',
                  left:(model[key]??true)?18:2,boxShadow:'0 1px 3px rgba(0,0,0,0.4)'}}/>
              </button>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
