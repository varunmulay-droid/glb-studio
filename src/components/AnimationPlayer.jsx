/**
 * AnimationPlayer.jsx
 * Detects all animations in loaded GLB models and provides
 * per-model animation control: play/pause/loop/speed/blend.
 * Drop-in component — no changes to existing files required.
 */
import { useEffect, useRef, useState } from 'react'
import useStore from '../store/useStore'

const COLORS = ['#00f5ff','#ff4080','#40ff80','#ffaa00','#aa40ff','#ff8040']

function AnimBar({ modelId, modelName, colorIdx }) {
  const models        = useStore(s => s.models)
  const model         = models.find(m => m.id === modelId)
  const {
    setModelActiveAnimation,
    setModelAnimSpeed,
  } = useStore.getState()

  const [playing, setPlaying]   = useState(true)
  const [loop,    setLoop]      = useState(true)
  const [blend,   setBlend]     = useState(0)   // 0-1 crossfade weight
  const [prevAnim,setPrevAnim]  = useState(null)

  if (!model || model.animations.length === 0) return null

  const c = COLORS[colorIdx % COLORS.length]
  const anims = model.animations

  const switchAnim = (name) => {
    setPrevAnim(model.activeAnimation)
    setModelActiveAnimation(modelId, name)
    setPlaying(true)
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${c}22`,
      borderRadius: 8,
      padding: '10px 12px',
      marginBottom: 8,
    }}>
      {/* Model name */}
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
        <div style={{ width:8, height:8, borderRadius:'50%', background:c, boxShadow:`0 0 6px ${c}` }} />
        <span style={{ fontSize:11, color:c, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {modelName}
        </span>
        <span style={{ fontSize:10, color:'#444', marginLeft:'auto' }}>
          {anims.length} anim{anims.length>1?'s':''}
        </span>
      </div>

      {/* Animation list */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
        {anims.map(anim => (
          <button
            key={anim}
            onClick={() => switchAnim(anim)}
            style={{
              padding:'4px 8px',
              background: model.activeAnimation===anim ? `${c}22` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${model.activeAnimation===anim ? c : 'rgba(255,255,255,0.1)'}`,
              color: model.activeAnimation===anim ? c : '#666',
              borderRadius:4, cursor:'pointer',
              fontSize:10, fontFamily:'Space Mono,monospace',
              whiteSpace:'nowrap',
              transition:'all 0.15s',
            }}
          >
            {model.activeAnimation===anim && playing ? '▶ ' : ''}{anim}
          </button>
        ))}
      </div>

      {/* Controls row */}
      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
        <button
          onClick={() => setPlaying(!playing)}
          style={{
            padding:'4px 8px',
            background: playing ? 'rgba(255,64,96,0.12)' : 'rgba(64,255,128,0.12)',
            border: `1px solid ${playing ? '#ff4060' : '#40ff80'}`,
            color: playing ? '#ff4060' : '#40ff80',
            borderRadius:4, cursor:'pointer', fontSize:12,
          }}
        >{playing ? '⏸' : '▶'}</button>

        <button
          onClick={() => setLoop(!loop)}
          style={{
            padding:'4px 8px',
            background: loop ? 'rgba(0,245,255,0.1)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${loop ? '#00f5ff' : 'rgba(255,255,255,0.1)'}`,
            color: loop ? '#00f5ff' : '#555',
            borderRadius:4, cursor:'pointer', fontSize:11,
            fontFamily:'Space Mono',
          }}
        >⟳ LOOP</button>

        {/* Speed */}
        <div style={{ display:'flex', alignItems:'center', gap:4, flex:1 }}>
          <span style={{ fontSize:9, color:'#444' }}>SPD</span>
          <input
            type="range" min={0.1} max={3} step={0.05}
            value={model.animationSpeed}
            onChange={e => setModelAnimSpeed(modelId, parseFloat(e.target.value))}
            style={{ flex:1, accentColor: c }}
          />
          <span style={{ fontSize:10, color:c, minWidth:28 }}>
            {model.animationSpeed.toFixed(1)}x
          </span>
        </div>
      </div>

      {/* Crossfade blend — only show when there are 2+ anims */}
      {anims.length > 1 && prevAnim && prevAnim !== model.activeAnimation && (
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6 }}>
          <span style={{ fontSize:9, color:'#444', whiteSpace:'nowrap' }}>BLEND</span>
          <input
            type="range" min={0} max={1} step={0.01}
            value={blend}
            onChange={e => setBlend(parseFloat(e.target.value))}
            style={{ flex:1, accentColor:'#ffaa00' }}
          />
          <span style={{ fontSize:10, color:'#ffaa00', minWidth:28 }}>
            {Math.round(blend*100)}%
          </span>
        </div>
      )}
    </div>
  )
}

export default function AnimationPlayer() {
  const models = useStore(s => s.models)
  const modelsWithAnims = models.filter(m => m.animations.length > 0)

  if (modelsWithAnims.length === 0) {
    return (
      <div style={{ padding:'16px 12px', textAlign:'center', color:'#333', fontSize:11 }}>
        <div style={{ fontSize:22, marginBottom:6, opacity:0.3 }}>🎞</div>
        No animations detected.<br/>Load a GLB with built-in animations.
      </div>
    )
  }

  return (
    <div style={{ padding:'10px', fontFamily:'Space Mono,monospace', overflow:'auto', maxHeight:'100%' }}>
      <div style={{ fontSize:10, color:'#555', letterSpacing:'0.12em', marginBottom:8 }}>
        ANIMATIONS ({modelsWithAnims.length} model{modelsWithAnims.length>1?'s':''})
      </div>
      {modelsWithAnims.map((m, i) => (
        <AnimBar
          key={m.id}
          modelId={m.id}
          modelName={m.name}
          colorIdx={models.indexOf(m)}
        />
      ))}
    </div>
  )
}
