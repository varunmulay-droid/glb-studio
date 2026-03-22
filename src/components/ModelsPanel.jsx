import { useState, useRef } from 'react'
import useStore from '../store/useStore'

const SAMPLE_MODELS = [
  { name: 'Fox', url: 'https://threejs.org/examples/models/gltf/Fox/glTF/Fox.gltf' },
  { name: 'Horse', url: 'https://threejs.org/examples/models/gltf/Horse.glb' },
  { name: 'Flamingo', url: 'https://threejs.org/examples/models/gltf/Flamingo.glb' },
  { name: 'Stork', url: 'https://threejs.org/examples/models/gltf/Stork.glb' },
  { name: 'Parrot', url: 'https://threejs.org/examples/models/gltf/Parrot.glb' },
  { name: 'Robot', url: 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb' },
  { name: 'Soldier', url: 'https://threejs.org/examples/models/gltf/Soldier.glb' },
]

export default function ModelsPanel() {
  const { models, selectedModelId, addModel, removeModel, selectModel, toggleModelVisibility } = useStore()
  const [urlInput, setUrlInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [showSamples, setShowSamples] = useState(false)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  const handleAddUrl = () => {
    if (!urlInput.trim()) return
    setLoading(true)
    addModel(urlInput.trim(), nameInput.trim() || null)
    setUrlInput('')
    setNameInput('')
    setTimeout(() => setLoading(false), 1500)
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    addModel(url, file.name.replace(/\.[^.]+$/, ''))
  }

  const colors = ['#00f5ff', '#ff4080', '#40ff80', '#ffaa00', '#aa40ff', '#ff8040']

  return (
    <div style={{ padding: 10, fontFamily: 'Space Mono', overflow: 'auto', maxHeight: '100%' }}>
      {/* Add by URL */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: '#666', marginBottom: 6, letterSpacing: '0.1em' }}>ADD MODEL</div>
        <input
          placeholder="Name (optional)"
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="GLB/GLTF URL..."
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddUrl()}
          style={{ ...inputStyle, marginTop: 4 }}
        />
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button onClick={handleAddUrl} style={primaryBtn} disabled={loading}>
            {loading ? '⏳' : '+ URL'}
          </button>
          <button onClick={() => fileRef.current?.click()} style={secondaryBtn}>
            📁 FILE
          </button>
          <button
            onClick={() => setShowSamples(!showSamples)}
            style={{ ...secondaryBtn, color: showSamples ? '#00f5ff' : '#888' }}
          >
            ◈ DEMO
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".glb,.gltf" style={{ display: 'none' }} onChange={handleFileUpload} />
      </div>

      {/* Sample models */}
      {showSamples && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: '#666', marginBottom: 4, letterSpacing: '0.1em' }}>SAMPLE MODELS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {SAMPLE_MODELS.map(sm => (
              <button
                key={sm.url}
                onClick={() => { addModel(sm.url, sm.name); setShowSamples(false) }}
                style={{
                  background: 'rgba(0,245,255,0.06)',
                  border: '1px solid rgba(0,245,255,0.15)',
                  color: '#9dd', padding: '6px 10px',
                  borderRadius: 4, cursor: 'pointer',
                  fontSize: 11, textAlign: 'left',
                  fontFamily: 'Space Mono',
                }}
              >
                ◈ {sm.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />

      {/* Model list */}
      <div style={{ fontSize: 10, color: '#666', marginBottom: 6, letterSpacing: '0.1em' }}>
        MODELS ({models.length})
      </div>

      {models.length === 0 && (
        <div style={{ color: '#333', fontSize: 11, textAlign: 'center', padding: 16 }}>
          No models loaded.<br />Add a GLB URL or upload a file.
        </div>
      )}

      {models.map((m, i) => {
        const isSelected = m.id === selectedModelId
        const color = colors[i % colors.length]
        return (
          <div
            key={m.id}
            onClick={() => selectModel(m.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 8px',
              marginBottom: 4,
              background: isSelected ? `${color}11` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isSelected ? color + '44' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: 6, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: m.visible ? color : '#333',
              boxShadow: m.visible ? `0 0 6px ${color}` : 'none',
              flexShrink: 0,
            }} />
            <span style={{
              flex: 1, fontSize: 11, color: isSelected ? '#fff' : '#aaa',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {m.name}
            </span>
            {/* Visibility toggle */}
            <button
              onClick={e => { e.stopPropagation(); toggleModelVisibility(m.id) }}
              style={{
                background: 'none', border: 'none',
                color: m.visible ? '#aaa' : '#333',
                cursor: 'pointer', fontSize: 12, padding: 0,
              }}
              title="Toggle visibility"
            >
              {m.visible ? '👁' : '🙈'}
            </button>
            <button
              onClick={e => { e.stopPropagation(); removeModel(m.id) }}
              style={{
                background: 'none', border: 'none',
                color: '#444', cursor: 'pointer', fontSize: 12, padding: 0,
              }}
              title="Remove"
            >✕</button>
          </div>
        )
      })}
    </div>
  )
}

const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#ddd', padding: '7px 9px',
  borderRadius: 5, fontSize: 11,
  fontFamily: 'Space Mono, monospace',
  outline: 'none',
  display: 'block',
}

const primaryBtn = {
  flex: 1, padding: '7px 0',
  background: 'rgba(0,245,255,0.12)',
  border: '1px solid rgba(0,245,255,0.3)',
  color: '#00f5ff', borderRadius: 5,
  cursor: 'pointer', fontSize: 11,
  fontFamily: 'Space Mono',
}

const secondaryBtn = {
  flex: 1, padding: '7px 0',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#888', borderRadius: 5,
  cursor: 'pointer', fontSize: 11,
  fontFamily: 'Space Mono',
}
