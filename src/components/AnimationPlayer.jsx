import { useState } from 'react'
import useStore from '../store/useStore'

const COLORS = ['#4f8eff','#ef4444','#22c55e','#f59e0b','#8b5cf6','#f97316']

function AnimBlock({ model, colorIdx }) {
  const [playing, setPlaying] = useState(true)
  const [loop,    setLoop]    = useState(true)
  const { setModelActiveAnimation, setModelAnimSpeed } = useStore.getState()
  const c = COLORS[colorIdx % COLORS.length]

  if (!model.animations.length) return null

  return (
    <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)' }}>
      {/* Model name */}
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8 }}>
        <div style={{ width:7, height:7, borderRadius:2, rotate:'45deg',
          background:c, boxShadow:`0 0 6px ${c}` }} />
        <span style={{ fontSize:12, fontWeight:600, color:'var(--text0)', flex:1,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{model.name}</span>
        <span style={{ fontSize:10, color:'var(--text3)', background:'var(--bg3)',
          padding:'2px 6px', borderRadius:3 }}>{model.animations.length} clips</span>
      </div>

      {/* Clip buttons */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
        {model.animations.map(anim => (
          <button key={anim} onClick={() => { setModelActiveAnimation(model.id, anim); setPlaying(true) }}
            style={{
              padding:'4px 9px', borderRadius:4, cursor:'pointer', fontSize:10, fontWeight:500,
              background: model.activeAnimation===anim ? `${c}18` : 'var(--bg3)',
              border:`1px solid ${model.activeAnimation===anim ? `${c}44` : 'var(--border)'}`,
              color: model.activeAnimation===anim ? c : 'var(--text1)',
              transition:'all 0.12s', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            }}
          >{model.activeAnimation===anim && playing ? '▶ ' : ''}{anim}</button>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
        <button onClick={() => setPlaying(!playing)} style={{
          padding:'4px 10px', borderRadius:4, fontSize:12, cursor:'pointer',
          background: playing ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
          border:`1px solid ${playing ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
          color: playing ? 'var(--danger)' : '#22c55e',
        }}>{playing ? '⏸' : '▶'}</button>

        <button onClick={() => setLoop(!loop)} style={{
          padding:'4px 10px', borderRadius:4, fontSize:10, cursor:'pointer',
          background: loop ? 'rgba(79,142,255,0.1)' : 'var(--bg3)',
          border:`1px solid ${loop ? 'rgba(79,142,255,0.3)' : 'var(--border)'}`,
          color: loop ? 'var(--accent)' : 'var(--text2)',
        }}>⟳ Loop</button>

        <div style={{ display:'flex', alignItems:'center', gap:6, flex:1 }}>
          <input type="range" min={0.1} max={3} step={0.05} value={model.animationSpeed}
            onChange={e => setModelAnimSpeed(model.id, +e.target.value)} />
          <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:c, minWidth:30 }}>
            {model.animationSpeed.toFixed(1)}×
          </span>
        </div>
      </div>
    </div>
  )
}

export default function AnimationPlayer() {
  const models = useStore(s => s.models)
  const animated = models.filter(m => m.animations.length > 0)

  if (!animated.length) return (
    <div style={{ padding:24, textAlign:'center' }}>
      <div style={{ fontSize:32, opacity:0.15, marginBottom:10 }}>🎞</div>
      <div style={{ fontSize:12, color:'var(--text2)' }}>No animations detected</div>
      <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>
        Load a GLB with built-in animation clips
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)',
        fontSize:11, color:'var(--text2)' }}>
        {animated.length} animated model{animated.length>1?'s':''} · click a clip to switch
      </div>
      {animated.map((m) => (
        <AnimBlock key={m.id} model={m} colorIdx={models.indexOf(m)} />
      ))}
    </div>
  )
}
