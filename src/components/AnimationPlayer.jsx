/**
 * AnimationPlayer.jsx
 * Per-model animation controls with working play/pause/loop/speed/switch.
 * Connects to ModelManager's mixer via the store.
 */
import { useState } from 'react'
import useStore from '../store/useStore'

const COLORS = ['#4f8eff','#ef4444','#22c55e','#f59e0b','#8b5cf6','#f97316']

function AnimBlock({ model, colorIdx }) {
  const { setModelActiveAnimation, setModelAnimSpeed, setModelAnimPlaying } = useStore.getState()
  const c = COLORS[colorIdx % COLORS.length]

  const playing = model.animationPlaying

  const switchTo = (name) => {
    setModelActiveAnimation(model.id, name)
    setModelAnimPlaying(model.id, true)
  }

  const togglePlay = () => {
    setModelAnimPlaying(model.id, !playing)
  }

  if (!model.animations.length) return null

  return (
    <div style={{ borderBottom:'1px solid var(--border)' }}>
      {/* Header */}
      <div style={{
        padding:'10px 12px 6px',
        display:'flex', alignItems:'center', gap:8,
      }}>
        <div style={{ width:7, height:7, borderRadius:1, rotate:'45deg',
          background: c, boxShadow:`0 0 8px ${c}88`, flexShrink:0 }} />
        <span style={{ fontSize:12, fontWeight:700, color:'var(--text0)', flex:1,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {model.name}
        </span>
        <span style={{
          fontSize:9, padding:'2px 7px', borderRadius:3, fontWeight:700,
          background:`${c}15`, color:c, border:`1px solid ${c}33`,
        }}>{model.animations.length} clip{model.animations.length>1?'s':''}</span>
      </div>

      {/* Now playing indicator */}
      {model.activeAnimation && (
        <div style={{
          margin:'0 12px 6px',
          padding:'5px 9px',
          background:'rgba(255,255,255,0.04)',
          border:`1px solid ${c}22`,
          borderRadius:'var(--radius-sm)',
          display:'flex', alignItems:'center', gap:7,
        }}>
          <div style={{
            width:6, height:6, borderRadius:'50%', flexShrink:0,
            background: playing ? c : 'var(--text3)',
            boxShadow: playing ? `0 0 6px ${c}` : 'none',
            animation: playing ? 'pulse 1.5s ease infinite' : 'none',
          }}/>
          <span style={{ fontSize:10, color:'var(--text1)', flex:1,
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            fontWeight:600 }}>
            {model.activeAnimation}
          </span>
          <span style={{ fontSize:9, color:'var(--text3)' }}>
            {playing ? 'PLAYING' : 'PAUSED'}
          </span>
        </div>
      )}

      {/* Clip list */}
      <div style={{ padding:'0 12px', display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
        {model.animations.map(anim => {
          const isActive = model.activeAnimation === anim
          return (
            <button key={anim}
              onClick={() => switchTo(anim)}
              style={{
                padding:'5px 10px', borderRadius:'var(--radius-sm)',
                background: isActive ? `${c}18` : 'var(--bg3)',
                border:`1px solid ${isActive ? `${c}55` : 'var(--border)'}`,
                color: isActive ? c : 'var(--text1)',
                fontSize:11, fontWeight: isActive ? 700 : 400,
                cursor:'pointer', transition:'all 0.12s',
                maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
              }}
              title={anim}
            >
              {isActive && playing ? '▶ ' : isActive ? '⏸ ' : ''}{anim}
            </button>
          )
        })}
      </div>

      {/* Controls row */}
      <div style={{ padding:'0 12px 12px', display:'flex', gap:6, alignItems:'center' }}>
        {/* Play/Pause */}
        <button onClick={togglePlay} style={{
          padding:'5px 12px', borderRadius:'var(--radius-sm)',
          background: playing ? 'rgba(239,68,68,0.12)' : `${c}18`,
          border:`1px solid ${playing ? 'rgba(239,68,68,0.35)' : `${c}44`}`,
          color: playing ? 'var(--danger)' : c,
          fontSize:13, cursor:'pointer', flexShrink:0, fontWeight:700,
          transition:'all 0.15s',
        }}>{playing ? '⏸' : '▶'}</button>

        {/* Stop */}
        <button onClick={() => { setModelAnimPlaying(model.id, false) }}
          title="Stop"
          style={{
            width:30, height:30, borderRadius:'var(--radius-sm)',
            background:'var(--bg3)', border:'1px solid var(--border)',
            color:'var(--text2)', fontSize:12, cursor:'pointer', flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>⏹</button>

        {/* Speed slider */}
        <div style={{ display:'flex', alignItems:'center', gap:6, flex:1 }}>
          <span style={{ fontSize:9, color:'var(--text3)', flexShrink:0 }}>SPD</span>
          <input type="range" min={0.1} max={3} step={0.05}
            value={model.animationSpeed}
            onChange={e => setModelAnimSpeed(model.id, +e.target.value)}
            style={{ flex:1 }} />
          <span style={{
            fontSize:10, fontFamily:'var(--font-mono)',
            color:c, minWidth:30, textAlign:'right',
          }}>{model.animationSpeed.toFixed(1)}×</span>
        </div>
      </div>
    </div>
  )
}

export default function AnimationPlayer() {
  const models = useStore(s => s.models)
  const animated = models.filter(m => (m.animations?.length??0)>0)

  if (!animated.length) {
    return (
      <div style={{ padding:24, textAlign:'center' }}>
        <div style={{ fontSize:36, opacity:0.12, marginBottom:12 }}>🎞</div>
        <div style={{ fontSize:13, fontWeight:600, color:'var(--text1)' }}>
          No animations detected
        </div>
        <div style={{ fontSize:11, color:'var(--text3)', marginTop:6, lineHeight:1.7 }}>
          Load a GLB with built-in animation clips.<br/>
          Try: <span style={{ color:'var(--accent)' }}>Fox, Robot, Soldier, Flamingo</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{
        padding:'8px 12px', borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <span style={{ fontSize:11, color:'var(--text2)' }}>
          {animated.length} animated model{animated.length>1?'s':''}
        </span>
        <button
          onClick={() => {
            const { models, setModelAnimPlaying } = useStore.getState()
            const allPlaying = animated.every(m => m.animationPlaying)
            animated.forEach(m => setModelAnimPlaying(m.id, !allPlaying))
          }}
          style={{
            padding:'4px 10px', borderRadius:'var(--radius-sm)',
            background:'var(--bg3)', border:'1px solid var(--border)',
            color:'var(--text1)', fontSize:10, cursor:'pointer',
          }}
        >
          {animated.every(m => m.animationPlaying) ? '⏸ Pause All' : '▶ Play All'}
        </button>
      </div>

      {animated.map(m => (
        <AnimBlock key={m.id} model={m} colorIdx={models.indexOf(m)} />
      ))}
    </div>
  )
}
