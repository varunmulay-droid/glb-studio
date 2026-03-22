import useStore from '../store/useStore'

const DEG = 180 / Math.PI

function VecInput({ label, value, onChange, step = 0.01, decimals = 3, scale = 1 }) {
  const axes = ['X', 'Y', 'Z']
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: '#666', marginBottom: 4, letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {axes.map((axis, i) => (
          <div key={axis} style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: ['#ff5060', '#60ff80', '#4080ff'][i], marginBottom: 2 }}>{axis}</div>
            <input
              type="number"
              value={(value[i] * scale).toFixed(decimals)}
              step={step}
              onChange={e => {
                const v = parseFloat(e.target.value) || 0
                const arr = [...value]
                arr[i] = v / scale
                onChange(arr)
              }}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${['rgba(255,80,96,0.3)', 'rgba(96,255,128,0.3)', 'rgba(64,128,255,0.3)'][i]}`,
                color: '#ddd', padding: '4px 6px',
                borderRadius: 4, fontSize: 11,
                fontFamily: 'Space Mono, monospace',
                outline: 'none',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PropertiesPanel() {
  const {
    models, selectedModelId, updateModelTransform,
    setModelActiveAnimation, setModelAnimSpeed,
    currentFrame, addKeyframe, removeKeyframe,
    keyframes, getKeyframesForModel,
    selectModel, removeModel
  } = useStore()

  const model = models.find(m => m.id === selectedModelId)

  if (!model) {
    return (
      <div style={{
        padding: 16, color: '#444', fontSize: 12,
        fontFamily: 'Space Mono', textAlign: 'center',
        lineHeight: 1.8,
      }}>
        <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.3 }}>◎</div>
        <div>Tap a model in the scene</div>
        <div>to select it</div>
      </div>
    )
  }

  const modelKeyframes = getKeyframesForModel(model.id)
  const hasKfAtFrame = keyframes[currentFrame]?.[model.id]

  return (
    <div style={{ padding: '10px', fontFamily: 'Space Mono, monospace', overflow: 'auto', maxHeight: '100%' }}>
      {/* Model name */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: '#00f5ff', letterSpacing: '0.15em', marginBottom: 4 }}>SELECTED</div>
        <div style={{
          fontSize: 12, color: '#fff', fontWeight: 'bold',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
          {model.name}
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />

      {/* Transform */}
      <VecInput
        label="POSITION"
        value={model.position}
        step={0.1}
        decimals={2}
        onChange={v => updateModelTransform(model.id, 'position', v)}
      />
      <VecInput
        label="ROTATION (deg)"
        value={model.rotation}
        step={1}
        decimals={1}
        scale={DEG}
        onChange={v => updateModelTransform(model.id, 'rotation', v)}
      />
      <VecInput
        label="SCALE"
        value={model.scale}
        step={0.05}
        decimals={2}
        onChange={v => updateModelTransform(model.id, 'scale', v)}
      />

      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />

      {/* Animation */}
      {model.animations.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: '#666', marginBottom: 6, letterSpacing: '0.1em' }}>ANIMATIONS</div>
          <select
            value={model.activeAnimation || ''}
            onChange={e => setModelActiveAnimation(model.id, e.target.value)}
            style={{
              width: '100%', background: '#0d0d1a',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#ddd', padding: '6px 8px',
              borderRadius: 4, fontSize: 11,
              fontFamily: 'Space Mono', marginBottom: 6,
              cursor: 'pointer',
            }}
          >
            {model.animations.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>SPEED</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="range" min={0.1} max={3} step={0.1}
              value={model.animationSpeed}
              onChange={e => setModelAnimSpeed(model.id, parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ color: '#00f5ff', fontSize: 11, minWidth: 30 }}>
              {model.animationSpeed.toFixed(1)}x
            </span>
          </div>
        </div>
      )}

      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />

      {/* Keyframe at current frame */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: '#666', marginBottom: 6, letterSpacing: '0.1em' }}>
          KEYFRAME @ FRAME {currentFrame}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => addKeyframe(currentFrame, model.id)}
            style={{
              flex: 1, padding: '7px 0',
              background: hasKfAtFrame ? 'rgba(255,170,0,0.2)' : 'rgba(0,245,255,0.1)',
              border: `1px solid ${hasKfAtFrame ? '#ffaa00' : '#00f5ff'}`,
              color: hasKfAtFrame ? '#ffaa00' : '#00f5ff',
              borderRadius: 6, cursor: 'pointer',
              fontSize: 11, fontFamily: 'Space Mono',
            }}
          >
            {hasKfAtFrame ? '◆ UPDATE' : '◆ ADD KF'}
          </button>
          {hasKfAtFrame && (
            <button
              onClick={() => removeKeyframe(currentFrame, model.id)}
              style={{
                padding: '7px 10px',
                background: 'rgba(255,64,96,0.1)',
                border: '1px solid rgba(255,64,96,0.4)',
                color: '#ff4060', borderRadius: 6,
                cursor: 'pointer', fontSize: 11,
              }}
            >✕</button>
          )}
        </div>
      </div>

      {/* Keyframe list */}
      {modelKeyframes.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: '#666', marginBottom: 6, letterSpacing: '0.1em' }}>
            ALL KEYFRAMES ({modelKeyframes.length})
          </div>
          <div style={{ maxHeight: 120, overflow: 'auto' }}>
            {modelKeyframes.map(({ frame }) => (
              <div
                key={frame}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '4px 6px', marginBottom: 2,
                  background: frame === currentFrame ? 'rgba(255,170,0,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${frame === currentFrame ? 'rgba(255,170,0,0.3)' : 'transparent'}`,
                  borderRadius: 4, cursor: 'pointer',
                }}
                onClick={() => useStore.getState().setCurrentFrame(frame)}
              >
                <span style={{ fontSize: 11, color: '#aaa' }}>Frame {frame}</span>
                <button
                  onClick={e => { e.stopPropagation(); removeKeyframe(frame, model.id) }}
                  style={{
                    background: 'none', border: 'none',
                    color: '#555', cursor: 'pointer', fontSize: 11,
                  }}
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />

      {/* Delete model */}
      <button
        onClick={() => { removeModel(model.id); selectModel(null) }}
        style={{
          width: '100%', padding: '8px 0',
          background: 'rgba(255,64,96,0.08)',
          border: '1px solid rgba(255,64,96,0.3)',
          color: '#ff4060', borderRadius: 6,
          cursor: 'pointer', fontSize: 11,
          fontFamily: 'Space Mono',
        }}
      >
        🗑 REMOVE MODEL
      </button>
    </div>
  )
}
