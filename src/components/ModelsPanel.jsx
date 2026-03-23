import { useState, useRef } from 'react'
import useStore from '../store/useStore'

const SAMPLES = [
  { name: 'Fox',      url: 'https://threejs.org/examples/models/gltf/Fox/glTF/Fox.gltf' },
  { name: 'Robot',    url: 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb' },
  { name: 'Soldier',  url: 'https://threejs.org/examples/models/gltf/Soldier.glb' },
  { name: 'Flamingo', url: 'https://threejs.org/examples/models/gltf/Flamingo.glb' },
  { name: 'Horse',    url: 'https://threejs.org/examples/models/gltf/Horse.glb' },
  { name: 'Parrot',   url: 'https://threejs.org/examples/models/gltf/Parrot.glb' },
]

const COLORS = ['#4f8eff','#ef4444','#06d6a0','#f59e0b','#8b5cf6','#f97316']

export default function ModelsPanel() {
  const { models, selectedModelId, addModel, removeModel, selectModel, toggleModelVisibility } = useStore()
  const [url, setUrl]     = useState('')
  const [name, setName]   = useState('')
  const [samples, setSamples] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  const handleAdd = () => {
    if (!url.trim()) return
    addModel(url.trim(), name.trim() || null)
    setUrl(''); setName('')
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    addModel(URL.createObjectURL(file), file.name.replace(/\.[^.]+$/, ''))
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.glb') || file.name.endsWith('.gltf'))) {
      addModel(URL.createObjectURL(file), file.name.replace(/\.[^.]+$/, ''))
    }
  }

  return (
    <div style={{ padding: 12, display:'flex', flexDirection:'column', gap:10 }}>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border-hi)'}`,
          borderRadius: 'var(--radius)',
          padding: '20px 12px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? 'rgba(79,142,255,0.06)' : 'var(--bg2)',
          transition: 'all 0.15s',
          animation: dragging ? 'pulse 1s ease infinite' : 'none',
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 6 }}>📦</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)' }}>
          {dragging ? 'Drop to load' : 'Drop GLB / GLTF here'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3 }}>or click to browse</div>
        <input ref={fileRef} type="file" accept=".glb,.gltf" style={{ display:'none' }} onChange={handleFile} />
      </div>

      {/* URL input */}
      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        <input value={name} onChange={e=>setName(e.target.value)}
          placeholder="Name (optional)" style={{}} />
        <div style={{ display:'flex', gap:5 }}>
          <input value={url} onChange={e=>setUrl(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&handleAdd()}
            placeholder="Paste GLB / GLTF URL…" style={{ flex:1 }} />
          <button onClick={handleAdd} style={{
            padding:'5px 12px', borderRadius:'var(--radius-sm)',
            background:'var(--accent)', border:'none', color:'#fff',
            fontSize:11, fontWeight:600, cursor:'pointer', flexShrink:0,
            transition:'opacity 0.15s',
          }}>Add</button>
        </div>
      </div>

      {/* Sample models */}
      <button onClick={() => setSamples(!samples)} style={{
        padding:'6px 10px', borderRadius:'var(--radius-sm)',
        background: samples ? 'var(--bg4)' : 'var(--bg2)',
        border:'1px solid var(--border-hi)',
        color:'var(--text1)', fontSize:11, cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <span>⚡ Demo models</span>
        <span style={{ color:'var(--text2)' }}>{samples ? '▲' : '▼'}</span>
      </button>

      {samples && (
        <div style={{
          display:'grid', gridTemplateColumns:'1fr 1fr',
          gap:5, animation:'fadeUp 0.15s ease',
        }}>
          {SAMPLES.map(s => (
            <button key={s.url}
              onClick={() => { addModel(s.url, s.name); setSamples(false) }}
              style={{
                padding:'8px 10px', borderRadius:'var(--radius-sm)',
                background:'var(--bg3)', border:'1px solid var(--border)',
                color:'var(--text1)', fontSize:11, cursor:'pointer',
                textAlign:'left', transition:'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background='var(--bg4)'; e.currentTarget.style.color='var(--text0)' }}
              onMouseLeave={e => { e.currentTarget.style.background='var(--bg3)'; e.currentTarget.style.color='var(--text1)' }}
            >
              📦 {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Divider + count */}
      {models.length > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ flex:1, height:1, background:'var(--border)' }} />
          <span style={{ fontSize:10, color:'var(--text3)', fontWeight:600 }}>
            {models.length} MODEL{models.length>1?'S':''}
          </span>
          <div style={{ flex:1, height:1, background:'var(--border)' }} />
        </div>
      )}

      {/* Model list */}
      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
        {models.map((m, i) => {
          const sel = m.id === selectedModelId
          const c   = COLORS[i % COLORS.length]
          return (
            <div
              key={m.id}
              onClick={() => selectModel(m.id)}
              style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'8px 10px',
                borderRadius:'var(--radius-sm)',
                background: sel ? 'rgba(79,142,255,0.1)' : 'var(--bg2)',
                border:`1px solid ${sel ? 'rgba(79,142,255,0.3)' : 'var(--border)'}`,
                cursor:'pointer', transition:'all 0.12s',
              }}
              onMouseEnter={e => { if (!sel) e.currentTarget.style.background='var(--bg3)' }}
              onMouseLeave={e => { if (!sel) e.currentTarget.style.background='var(--bg2)' }}
            >
              {/* Color dot */}
              <div style={{
                width:8, height:8, borderRadius:'50%', flexShrink:0,
                background: m.visible ? c : 'var(--text3)',
                boxShadow: m.visible ? `0 0 6px ${c}88` : 'none',
                transition:'all 0.15s',
              }} />

              {/* Name */}
              <span style={{
                flex:1, fontSize:12, fontWeight: sel ? 600 : 400,
                color: sel ? 'var(--text0)' : 'var(--text1)',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
              }}>{m.name}</span>

              {/* Anims badge */}
              {m.animations.length > 0 && (
                <span style={{
                  fontSize:9, padding:'2px 5px', borderRadius:3,
                  background:'rgba(6,214,160,0.12)', color:'var(--accent3)',
                  border:'1px solid rgba(6,214,160,0.2)', flexShrink:0,
                }}>{m.animations.length}</span>
              )}

              {/* Actions */}
              <button
                onClick={e => { e.stopPropagation(); toggleModelVisibility(m.id) }}
                title="Toggle visibility"
                style={{ background:'none', border:'none', color: m.visible ? 'var(--text2)' : 'var(--text3)', fontSize:13, cursor:'pointer', flexShrink:0, padding:2 }}
              >{m.visible ? '👁' : '🙈'}</button>

              <button
                onClick={e => { e.stopPropagation(); removeModel(m.id) }}
                title="Remove model"
                style={{ background:'none', border:'none', color:'var(--text3)', fontSize:12, cursor:'pointer', flexShrink:0, padding:2, transition:'color 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.color='var(--danger)'}
                onMouseLeave={e => e.currentTarget.style.color='var(--text3)'}
              >✕</button>
            </div>
          )
        })}

        {models.length === 0 && (
          <div style={{ textAlign:'center', color:'var(--text3)', fontSize:12, padding:'12px 0' }}>
            No models loaded yet
          </div>
        )}
      </div>
    </div>
  )
}
