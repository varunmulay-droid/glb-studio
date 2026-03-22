import useStore from '../store/useStore'

export default function Toolbar() {
  const {
    transformMode, setTransformMode,
    lightingPreset, setLightingPreset,
    selectedModelId, addKeyframe, currentFrame,
    isPlaying, setIsPlaying,
  } = useStore()

  const modes = [
    { id: 'translate', icon: '✛', label: 'Move' },
    { id: 'rotate', icon: '↻', label: 'Rotate' },
    { id: 'scale', icon: '⤡', label: 'Scale' },
  ]

  const lights = [
    { id: 'studio', icon: '💡' },
    { id: 'outdoor', icon: '☀️' },
    { id: 'dramatic', icon: '🎭' },
    { id: 'neon', icon: '🌀' },
  ]

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 10px',
      background: 'rgba(8,8,20,0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(0,245,255,0.12)',
      zIndex: 200,
      overflowX: 'auto',
    }}>
      {/* App title */}
      <div style={{
        fontFamily: 'Orbitron, monospace',
        fontSize: 13, fontWeight: 900,
        color: '#00f5ff',
        letterSpacing: '0.08em',
        whiteSpace: 'nowrap',
        textShadow: '0 0 20px rgba(0,245,255,0.5)',
        marginRight: 6,
      }}>
        GLB<span style={{ color: '#ff4080' }}>STUDIO</span>
      </div>

      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)' }} />

      {/* Transform mode */}
      {modes.map(m => (
        <button
          key={m.id}
          onClick={() => setTransformMode(m.id)}
          title={m.label}
          style={{
            padding: '5px 10px',
            background: transformMode === m.id ? 'rgba(0,245,255,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${transformMode === m.id ? '#00f5ff' : 'rgba(255,255,255,0.1)'}`,
            color: transformMode === m.id ? '#00f5ff' : '#888',
            borderRadius: 5, cursor: 'pointer',
            fontSize: 14, fontWeight: 'bold',
            lineHeight: 1,
            transition: 'all 0.15s',
            minWidth: 36,
            textAlign: 'center',
          }}
        >
          {m.icon}
        </button>
      ))}

      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)' }} />

      {/* Playback */}
      <button
        onClick={() => setIsPlaying(!isPlaying)}
        style={{
          padding: '5px 12px',
          background: isPlaying ? 'rgba(255,64,96,0.15)' : 'rgba(64,255,128,0.12)',
          border: `1px solid ${isPlaying ? '#ff4060' : '#40ff80'}`,
          color: isPlaying ? '#ff4060' : '#40ff80',
          borderRadius: 5, cursor: 'pointer',
          fontSize: 13,
        }}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)' }} />

      {/* Lighting */}
      {lights.map(l => (
        <button
          key={l.id}
          onClick={() => setLightingPreset(l.id)}
          title={l.id}
          style={{
            padding: '5px 8px',
            background: lightingPreset === l.id ? 'rgba(255,170,0,0.12)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${lightingPreset === l.id ? '#ffaa00' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 5, cursor: 'pointer',
            fontSize: 14, opacity: lightingPreset === l.id ? 1 : 0.5,
          }}
        >
          {l.icon}
        </button>
      ))}

      <div style={{ flex: 1 }} />

      {/* Quick add keyframe */}
      {selectedModelId && (
        <button
          onClick={() => addKeyframe(currentFrame, selectedModelId)}
          style={{
            padding: '5px 12px',
            background: 'rgba(255,170,0,0.12)',
            border: '1px solid rgba(255,170,0,0.4)',
            color: '#ffaa00', borderRadius: 5,
            cursor: 'pointer', fontSize: 11,
            fontFamily: 'Space Mono', whiteSpace: 'nowrap',
          }}
        >
          ◆ KEY
        </button>
      )}
    </div>
  )
}
