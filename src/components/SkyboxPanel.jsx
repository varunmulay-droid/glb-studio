/**
 * SkyboxPanel.jsx
 * Lets users set the scene background / skybox:
 *  - Preset environments (synced with lighting)
 *  - Solid color picker
 *  - Upload an image (JPG/PNG equirectangular)
 *  - Paste an HDR/image URL
 * Drop-in component — no other files changed.
 */
import { useRef, useState } from 'react'
import useStore from '../store/useStore'

const PRESETS = [
  { id: 'studio',   label: 'Studio',   icon: '💡', color: '#223' },
  { id: 'outdoor',  label: 'Outdoor',  icon: '☀️', color: '#135' },
  { id: 'dramatic', label: 'Dramatic', icon: '🎭', color: '#311' },
  { id: 'neon',     label: 'Neon',     icon: '🌀', color: '#031' },
]

const BG_COLORS = [
  '#080810','#000000','#ffffff','#1a0a2e',
  '#0a1a2e','#1a2e0a','#2e0a0a','#2e2a0a',
]

export default function SkyboxPanel() {
  const skybox          = useStore(s => s.skybox)
  const lightingPreset  = useStore(s => s.lightingPreset)
  const { setSkybox, setLightingPreset } = useStore.getState()

  const [urlInput, setUrlInput] = useState('')
  const [urlType,  setUrlType]  = useState('image') // 'image' | 'hdr'
  const fileRef = useRef()

  const applyPreset = (id) => {
    setLightingPreset(id)
    setSkybox({ type: 'preset', value: null, showBg: skybox.showBg })
  }

  const applyColor = (col) => {
    setSkybox({ type: 'color', bgColor: col, showBg: true })
  }

  const applyUrl = () => {
    if (!urlInput.trim()) return
    const isHdr = urlInput.toLowerCase().includes('.hdr') ||
                  urlInput.toLowerCase().includes('.exr')
    setSkybox({ type: isHdr ? 'hdr' : 'image', value: urlInput.trim(), showBg: true })
    setUrlInput('')
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const url  = URL.createObjectURL(file)
    const isHdr = file.name.toLowerCase().endsWith('.hdr') ||
                  file.name.toLowerCase().endsWith('.exr')
    setSkybox({ type: isHdr ? 'hdr' : 'image', value: url, showBg: true })
  }

  const clearSkybox = () => {
    setSkybox({ type: 'preset', value: null, showBg: false, bgColor: '#080810' })
  }

  return (
    <div style={{ padding:'10px', fontFamily:'Space Mono,monospace', overflow:'auto', maxHeight:'100%' }}>

      {/* Show background toggle */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <span style={{ fontSize:10, color:'#555', letterSpacing:'0.1em' }}>SHOW BACKGROUND</span>
        <button
          onClick={() => setSkybox({ showBg: !skybox.showBg })}
          style={{
            padding:'4px 12px',
            background: skybox.showBg ? 'rgba(0,245,255,0.15)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${skybox.showBg ? '#00f5ff' : 'rgba(255,255,255,0.1)'}`,
            color: skybox.showBg ? '#00f5ff' : '#555',
            borderRadius:6, cursor:'pointer', fontSize:11, fontFamily:'Space Mono',
          }}
        >{skybox.showBg ? 'ON' : 'OFF'}</button>
      </div>

      {/* Current skybox status */}
      <div style={{
        padding:'8px 10px', marginBottom:10,
        background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
        borderRadius:6, fontSize:11, color:'#556',
      }}>
        <span style={{ color:'#00f5ff' }}>Active: </span>
        {skybox.type === 'preset'  && `Preset — ${lightingPreset}`}
        {skybox.type === 'color'   && `Color — ${skybox.bgColor}`}
        {skybox.type === 'image'   && `Image — ${(skybox.value||'').split('/').pop().substring(0,24)}...`}
        {skybox.type === 'hdr'     && `HDR — ${(skybox.value||'').split('/').pop().substring(0,24)}...`}
        {(skybox.type === 'image' || skybox.type === 'hdr') && (
          <button onClick={clearSkybox} style={{
            marginLeft:8, background:'none', border:'none',
            color:'#ff4060', cursor:'pointer', fontSize:11,
          }}>✕ clear</button>
        )}
      </div>

      <hr style={{ border:'none', borderTop:'1px solid rgba(255,255,255,0.07)', margin:'0 0 10px' }} />

      {/* ── Preset environments ── */}
      <div style={{ fontSize:10, color:'#555', letterSpacing:'0.1em', marginBottom:6 }}>
        PRESET ENVIRONMENTS
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:12 }}>
        {PRESETS.map(p => (
          <button key={p.id} onClick={() => applyPreset(p.id)} style={{
            padding:'8px 6px',
            background: skybox.type==='preset' && lightingPreset===p.id
              ? `${p.color}88` : 'rgba(255,255,255,0.03)',
            border: `1px solid ${skybox.type==='preset' && lightingPreset===p.id
              ? '#00f5ff55' : 'rgba(255,255,255,0.08)'}`,
            borderRadius:6, cursor:'pointer', fontSize:11,
            color: skybox.type==='preset' && lightingPreset===p.id ? '#fff' : '#666',
            fontFamily:'Space Mono',
            transition:'all 0.15s',
          }}>
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      <hr style={{ border:'none', borderTop:'1px solid rgba(255,255,255,0.07)', margin:'0 0 10px' }} />

      {/* ── Solid color ── */}
      <div style={{ fontSize:10, color:'#555', letterSpacing:'0.1em', marginBottom:6 }}>
        SOLID COLOR
      </div>
      <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:6 }}>
        {BG_COLORS.map(col => (
          <div key={col} onClick={() => applyColor(col)} style={{
            width:28, height:28, borderRadius:5,
            background: col,
            border: `2px solid ${skybox.type==='color' && skybox.bgColor===col
              ? '#00f5ff' : 'rgba(255,255,255,0.15)'}`,
            cursor:'pointer',
            boxShadow: skybox.type==='color' && skybox.bgColor===col
              ? '0 0 8px #00f5ff' : 'none',
            transition:'all 0.15s',
          }} />
        ))}
        {/* Custom color picker */}
        <label style={{ width:28, height:28, borderRadius:5, overflow:'hidden', cursor:'pointer',
          border:'1px dashed rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontSize:16, pointerEvents:'none' }}>+</span>
          <input type="color" defaultValue="#080810"
            onChange={e => applyColor(e.target.value)}
            style={{ position:'absolute', opacity:0, width:0, height:0 }} />
        </label>
      </div>

      <hr style={{ border:'none', borderTop:'1px solid rgba(255,255,255,0.07)', margin:'8px 0 10px' }} />

      {/* ── Upload image / HDR ── */}
      <div style={{ fontSize:10, color:'#555', letterSpacing:'0.1em', marginBottom:6 }}>
        UPLOAD SKYBOX IMAGE / HDR
      </div>
      <div style={{ display:'flex', gap:5, marginBottom:8 }}>
        <button onClick={() => fileRef.current?.click()} style={{
          flex:1, padding:'8px 0',
          background:'rgba(0,245,255,0.08)', border:'1px solid rgba(0,245,255,0.2)',
          color:'#00f5ff', borderRadius:6, cursor:'pointer',
          fontSize:11, fontFamily:'Space Mono',
        }}>
          📁 UPLOAD FILE
        </button>
        <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.hdr,.exr"
          style={{ display:'none' }} onChange={handleFile} />
      </div>
      <div style={{ fontSize:10, color:'#444', marginBottom:4 }}>Accepts: JPG, PNG (equirectangular), HDR, EXR</div>

      <hr style={{ border:'none', borderTop:'1px solid rgba(255,255,255,0.07)', margin:'8px 0 10px' }} />

      {/* ── Paste URL ── */}
      <div style={{ fontSize:10, color:'#555', letterSpacing:'0.1em', marginBottom:6 }}>
        PASTE IMAGE / HDR URL
      </div>
      <div style={{ display:'flex', gap:5, marginBottom:4 }}>
        {['image','hdr'].map(t => (
          <button key={t} onClick={() => setUrlType(t)} style={{
            flex:1, padding:'5px 0',
            background: urlType===t ? 'rgba(255,170,0,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${urlType===t ? 'rgba(255,170,0,0.4)' : 'rgba(255,255,255,0.1)'}`,
            color: urlType===t ? '#ffaa00' : '#555',
            borderRadius:4, cursor:'pointer', fontSize:10, fontFamily:'Space Mono',
          }}>{t.toUpperCase()}</button>
        ))}
      </div>
      <input
        value={urlInput}
        onChange={e => setUrlInput(e.target.value)}
        onKeyDown={e => e.key==='Enter' && applyUrl()}
        placeholder="https://...equirectangular.jpg"
        style={{
          width:'100%', padding:'7px 8px', marginBottom:6,
          background:'rgba(0,10,30,0.7)', border:'1px solid rgba(0,245,255,0.18)',
          borderRadius:6, color:'#d0e8ff', fontSize:11,
          fontFamily:'Space Mono', outline:'none', display:'block',
        }}
      />
      <button onClick={applyUrl} style={{
        width:'100%', padding:'8px 0',
        background:'rgba(255,170,0,0.1)', border:'1px solid rgba(255,170,0,0.3)',
        color:'#ffaa00', borderRadius:6, cursor:'pointer',
        fontSize:11, fontFamily:'Space Mono',
      }}>APPLY URL</button>

      <div style={{ marginTop:10, padding:'8px', background:'rgba(0,245,255,0.03)',
        border:'1px solid rgba(0,245,255,0.07)', borderRadius:6, fontSize:10, color:'#334455', lineHeight:1.7 }}>
        💡 Free equirectangular HDRs:<br/>
        <a href="https://polyhaven.com/hdris" target="_blank"
          style={{ color:'#0077aa', textDecoration:'none' }}>polyhaven.com/hdris ↗</a><br/>
        Right-click → Copy image address → paste above
      </div>
    </div>
  )
}
