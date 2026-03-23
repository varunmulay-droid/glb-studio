import { useState } from 'react'
import useStore from '../store/useStore'

const DEG = 180 / Math.PI

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width:'100%', padding:'8px 12px',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          background:'transparent', border:'none', color:'var(--text1)',
          fontSize:11, fontWeight:600, cursor:'pointer', letterSpacing:'0.08em',
          textTransform:'uppercase',
        }}
      >
        {title}
        <span style={{ color:'var(--text3)', transition:'transform 0.15s',
          display:'inline-block', transform: open?'rotate(0deg)':'rotate(-90deg)' }}>▾</span>
      </button>
      {open && <div style={{ padding:'0 12px 12px' }}>{children}</div>}
    </div>
  )
}

function Vec3({ label, value, onChange, step=0.01, scale=1, decimals=3, min, max }) {
  const axes = [
    { k:'X', color:'#ef4444' },
    { k:'Y', color:'#22c55e' },
    { k:'Z', color:'#3b82f6' },
  ]
  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ fontSize:10, color:'var(--text2)', marginBottom:5, fontWeight:500, letterSpacing:'0.06em' }}>
        {label}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
        {axes.map((ax, i) => (
          <div key={ax.k}>
            <div style={{
              display:'flex', alignItems:'center',
              background:'var(--bg1)', border:'1px solid var(--border)',
              borderRadius:'var(--radius-sm)', overflow:'hidden',
              transition:'border-color 0.15s',
            }}
              onFocusCapture={e => e.currentTarget.style.borderColor='var(--accent)'}
              onBlurCapture={e => e.currentTarget.style.borderColor='var(--border)'}
            >
              <span style={{
                padding:'0 5px', fontSize:10, fontWeight:700,
                color: ax.color, background:'var(--bg2)',
                borderRight:'1px solid var(--border)', alignSelf:'stretch',
                display:'flex', alignItems:'center',
              }}>{ax.k}</span>
              <input
                type="number" step={step} min={min} max={max}
                value={(value[i] * scale).toFixed(decimals)}
                onChange={e => {
                  const v = parseFloat(e.target.value) || 0
                  const arr = [...value]; arr[i] = v / scale; onChange(arr)
                }}
                style={{ border:'none', borderRadius:0, width:'100%', background:'transparent',
                  padding:'5px 5px', fontSize:11, fontFamily:'var(--font-mono)' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PropertiesPanel() {
  const {
    models, selectedModelId,
    updateModelTransform, setModelActiveAnimation, setModelAnimSpeed,
    currentFrame, addKeyframe, removeKeyframe, getKeyframesForModel, keyframes,
    removeModel, selectModel,
  } = useStore()

  const model = models.find(m => m.id === selectedModelId)

  if (!model) return (
    <div style={{ padding:24, textAlign:'center' }}>
      <div style={{ fontSize:32, opacity:0.15, marginBottom:10 }}>◎</div>
      <div style={{ fontSize:12, color:'var(--text2)' }}>Select a model in the scene</div>
      <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>
        Click any object to inspect its properties
      </div>
    </div>
  )

  const kfList   = getKeyframesForModel(model.id)
  const hasKfNow = keyframes[currentFrame]?.[model.id]

  return (
    <div>
      {/* Header */}
      <div style={{
        padding:'10px 12px 8px',
        borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', gap:8,
      }}>
        <div style={{ width:10, height:10, borderRadius:'50%', background:'var(--accent)', boxShadow:'0 0 8px rgba(79,142,255,0.5)' }} />
        <span style={{ fontSize:13, fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {model.name}
        </span>
        <button
          onClick={() => { removeModel(model.id); selectModel(null) }}
          style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:14, transition:'color 0.12s' }}
          onMouseEnter={e => e.currentTarget.style.color='var(--danger)'}
          onMouseLeave={e => e.currentTarget.style.color='var(--text3)'}
          title="Remove model"
        >🗑</button>
      </div>

      {/* Transform */}
      <Section title="Transform">
        <Vec3 label="Position" value={model.position} step={0.1} decimals={2}
          onChange={v => updateModelTransform(model.id, 'position', v)} />
        <Vec3 label="Rotation (deg)" value={model.rotation} step={1} decimals={1} scale={DEG}
          onChange={v => updateModelTransform(model.id, 'rotation', v)} />
        <Vec3 label="Scale" value={model.scale} step={0.05} decimals={2}
          onChange={v => updateModelTransform(model.id, 'scale', v)} />
        <button
          onClick={() => {
            updateModelTransform(model.id, 'position', [0,0,0])
            updateModelTransform(model.id, 'rotation', [0,0,0])
            updateModelTransform(model.id, 'scale', [1,1,1])
          }}
          style={{
            width:'100%', marginTop:4, padding:'5px 0',
            background:'var(--bg2)', border:'1px solid var(--border)',
            borderRadius:'var(--radius-sm)', color:'var(--text2)',
            fontSize:11, cursor:'pointer', transition:'all 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background='var(--bg3)'; e.currentTarget.style.color='var(--text0)' }}
          onMouseLeave={e => { e.currentTarget.style.background='var(--bg2)'; e.currentTarget.style.color='var(--text2)' }}
        >↺ Reset Transform</button>
      </Section>

      {/* Animations */}
      {model.animations.length > 0 && (
        <Section title="Animations">
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {model.animations.map(anim => (
              <button key={anim}
                onClick={() => setModelActiveAnimation(model.id, anim)}
                style={{
                  padding:'7px 10px', borderRadius:'var(--radius-sm)',
                  background: model.activeAnimation===anim ? 'rgba(6,214,160,0.1)' : 'var(--bg2)',
                  border:`1px solid ${model.activeAnimation===anim ? 'rgba(6,214,160,0.3)' : 'var(--border)'}`,
                  color: model.activeAnimation===anim ? 'var(--accent3)' : 'var(--text1)',
                  fontSize:11, textAlign:'left', cursor:'pointer', transition:'all 0.12s',
                  display:'flex', alignItems:'center', gap:6,
                }}
              >
                <span>{model.activeAnimation===anim ? '▶' : '○'}</span>
                {anim}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
            <span style={{ fontSize:10, color:'var(--text2)' }}>Speed</span>
            <input type="range" min={0.1} max={3} step={0.05}
              value={model.animationSpeed}
              onChange={e => setModelAnimSpeed(model.id, parseFloat(e.target.value))} />
            <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'var(--accent)', minWidth:32 }}>
              {model.animationSpeed.toFixed(1)}×
            </span>
          </div>
        </Section>
      )}

      {/* Keyframes */}
      <Section title="Keyframes">
        <div style={{ display:'flex', gap:5, marginBottom:8 }}>
          <button
            onClick={() => addKeyframe(currentFrame, model.id)}
            style={{
              flex:1, padding:'7px 0',
              background: hasKfNow ? 'rgba(245,158,11,0.15)' : 'rgba(79,142,255,0.12)',
              border:`1px solid ${hasKfNow ? 'rgba(245,158,11,0.4)' : 'rgba(79,142,255,0.3)'}`,
              color: hasKfNow ? 'var(--warn)' : 'var(--accent)',
              borderRadius:'var(--radius-sm)', cursor:'pointer', fontSize:11, fontWeight:600,
            }}
          >{hasKfNow ? '◆ Update' : '◆ Add Keyframe'}</button>
          {hasKfNow && (
            <button onClick={() => removeKeyframe(currentFrame, model.id)}
              style={{
                padding:'7px 10px', background:'rgba(239,68,68,0.1)',
                border:'1px solid rgba(239,68,68,0.3)', color:'var(--danger)',
                borderRadius:'var(--radius-sm)', cursor:'pointer', fontSize:12,
              }}>✕</button>
          )}
        </div>

        <div style={{ fontSize:11, color:'var(--text2)', marginBottom:5 }}>
          Frame {currentFrame} {hasKfNow ? '— keyframe set ◆' : '— no keyframe'}
        </div>

        {kfList.length > 0 && (
          <div style={{ maxHeight:120, overflow:'auto', display:'flex', flexDirection:'column', gap:2 }}>
            {kfList.map(({ frame }) => (
              <div key={frame}
                onClick={() => useStore.getState().setCurrentFrame(frame)}
                style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'4px 8px', borderRadius:'var(--radius-sm)',
                  background: frame===currentFrame ? 'rgba(245,158,11,0.1)' : 'var(--bg2)',
                  border:`1px solid ${frame===currentFrame ? 'rgba(245,158,11,0.25)' : 'var(--border)'}`,
                  cursor:'pointer',
                }}
              >
                <span style={{ fontSize:11, color: frame===currentFrame ? 'var(--warn)' : 'var(--text1)' }}>
                  Frame {frame}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); removeKeyframe(frame, model.id) }}
                  style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:11 }}
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
