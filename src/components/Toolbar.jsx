import { useState } from 'react'
import useStore from '../store/useStore'

const S = {
  bar: {
    position: 'relative', zIndex: 300,
    display: 'flex', alignItems: 'center', gap: 2,
    padding: '0 10px',
    height: 46,
    background: 'var(--bg1)',
    borderBottom: '1px solid var(--border)',
    boxShadow: '0 1px 0 rgba(255,255,255,0.04)',
    overflowX: 'auto', overflowY: 'hidden',
    flexShrink: 0,
  },
  brand: {
    fontFamily: 'var(--font-brand)',
    fontSize: 15, fontWeight: 800,
    letterSpacing: '-0.01em',
    color: 'var(--text0)',
    marginRight: 8,
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },
  div: {
    width: 1, height: 20,
    background: 'var(--border)',
    margin: '0 6px', flexShrink: 0,
  },
}

function ToolBtn({ icon, label, active, onClick, color, shortcut }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={shortcut ? `${label} [${shortcut}]` : label}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 10px',
        borderRadius: 'var(--radius-sm)',
        border: active
          ? `1px solid ${color || 'var(--accent)'}44`
          : `1px solid ${hover ? 'var(--border-hi)' : 'transparent'}`,
        background: active
          ? `${color || 'var(--accent)'}18`
          : hover ? 'var(--bg3)' : 'transparent',
        color: active ? (color || 'var(--accent)') : hover ? 'var(--text0)' : 'var(--text1)',
        fontSize: 12, fontWeight: 500,
        transition: 'all 0.12s',
        whiteSpace: 'nowrap', flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 11 }}>{label}</span>
    </button>
  )
}

function IconBtn({ icon, active, onClick, title, color }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width: 32, height: 32, borderRadius: 'var(--radius-sm)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: active ? `1px solid ${color||'var(--accent)'}44` : `1px solid ${h?'var(--border-hi)':'transparent'}`,
        background: active ? `${color||'var(--accent)'}18` : h ? 'var(--bg3)' : 'transparent',
        color: active ? (color||'var(--accent)') : h ? 'var(--text0)' : 'var(--text1)',
        fontSize: 15, transition: 'all 0.12s', flexShrink: 0,
      }}
    >{icon}</button>
  )
}

export default function Toolbar() {
  const {
    transformMode, setTransformMode,
    lightingPreset, setLightingPreset,
    isPlaying, setIsPlaying,
    selectedModelId, addKeyframe, currentFrame,
    currentFrame: cf, setCurrentFrame, totalFrames,
  } = useStore()

  const tools = [
    { id: 'translate', icon: '⊹',  label: 'Move',   short: 'G' },
    { id: 'rotate',    icon: '↻',  label: 'Rotate', short: 'R' },
    { id: 'scale',     icon: '⤡',  label: 'Scale',  short: 'S' },
  ]

  const lights = [
    { id: 'studio',   icon: '◎', label: 'Studio'   },
    { id: 'outdoor',  icon: '◉', label: 'Outdoor'  },
    { id: 'dramatic', icon: '◈', label: 'Dramatic' },
    { id: 'neon',     icon: '◆', label: 'Neon'     },
  ]

  return (
    <div style={S.bar}>
      {/* Brand */}
      <div style={S.brand}>
        <span style={{ color: 'var(--accent)' }}>GLB</span>
        <span style={{ color: 'var(--text1)', fontWeight: 400 }}>Studio</span>
      </div>

      <div style={S.div} />

      {/* Transform tools */}
      <div style={{ display:'flex', gap:2, flexShrink:0 }}>
        {tools.map(t => (
          <ToolBtn key={t.id}
            icon={t.icon} label={t.label} shortcut={t.short}
            active={transformMode === t.id}
            onClick={() => setTransformMode(t.id)}
          />
        ))}
      </div>

      <div style={S.div} />

      {/* Playback */}
      <div style={{ display:'flex', gap:2, alignItems:'center', flexShrink:0 }}>
        <IconBtn icon="⏮" title="First frame" onClick={() => setCurrentFrame(0)} />
        <IconBtn icon="◀" title="Prev frame"  onClick={() => setCurrentFrame(Math.max(0, cf-1))} />
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          style={{
            width: 34, height: 34, borderRadius: 'var(--radius-sm)',
            background: isPlaying ? 'var(--danger)' : 'var(--accent)',
            border: 'none', color: '#fff', fontSize: 14,
            display:'flex', alignItems:'center', justifyContent:'center',
            flexShrink: 0, cursor: 'pointer',
            boxShadow: isPlaying ? '0 0 12px rgba(239,68,68,0.4)' : '0 0 12px rgba(79,142,255,0.4)',
            transition: 'all 0.15s',
          }}
        >{isPlaying ? '⏸' : '▶'}</button>
        <IconBtn icon="▶" title="Next frame" onClick={() => setCurrentFrame(Math.min(totalFrames-1,cf+1))} />
        <IconBtn icon="⏭" title="Last frame" onClick={() => setCurrentFrame(totalFrames-1)} />

        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--text1)', marginLeft: 6, flexShrink: 0,
          background: 'var(--bg3)', padding: '4px 8px',
          borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
        }}>
          <span style={{ color: 'var(--text0)' }}>{String(cf).padStart(4,'0')}</span>
          <span style={{ color: 'var(--text3)' }}>/{totalFrames}</span>
        </div>
      </div>

      <div style={S.div} />

      {/* Lighting */}
      <div style={{ display:'flex', gap:2, flexShrink:0 }}>
        {lights.map(l => (
          <button key={l.id}
            onClick={() => setLightingPreset(l.id)}
            title={l.label}
            style={{
              padding: '4px 7px', borderRadius: 'var(--radius-sm)',
              background: lightingPreset===l.id ? 'var(--bg4)' : 'transparent',
              border: `1px solid ${lightingPreset===l.id ? 'var(--border-hi)' : 'transparent'}`,
              color: lightingPreset===l.id ? 'var(--warn)' : 'var(--text2)',
              fontSize: 13, cursor:'pointer', transition:'all 0.12s',
            }}
          >{l.icon}</button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Keyframe shortcut */}
      {selectedModelId && (
        <button
          onClick={() => addKeyframe(currentFrame, selectedModelId)}
          style={{
            padding: '5px 12px', borderRadius: 'var(--radius-sm)',
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.3)',
            color: 'var(--warn)', fontSize: 11, fontWeight: 600,
            cursor: 'pointer', flexShrink: 0, transition: 'all 0.12s',
          }}
        >◆ Keyframe</button>
      )}
    </div>
  )
}
