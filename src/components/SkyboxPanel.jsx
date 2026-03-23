import { useRef, useState } from 'react'
import useStore from '../store/useStore'

const PRESETS = [
  { id:'studio',   label:'Studio',   icon:'◎' },
  { id:'outdoor',  label:'Outdoor',  icon:'◉' },
  { id:'dramatic', label:'Dramatic', icon:'◈' },
  { id:'neon',     label:'Neon',     icon:'◆' },
]

const COLORS = ['#0c0c10','#000000','#0a0a1a','#0d1a0a','#1a0a0a','#ffffff','#87ceeb','#1a0a2e']

export default function SkyboxPanel() {
  const skybox         = useStore(s => s.skybox)
  const lightingPreset = useStore(s => s.lightingPreset)
  const { setSkybox, setLightingPreset } = useStore.getState()
  const [url,     setUrl]     = useState('')
  const [urlType, setUrlType] = useState('image')
  const fileRef = useRef()

  const handleFile = (e) => {
    const f = e.target.files[0]; if(!f) return
    const isHdr = /\.(hdr|exr)$/i.test(f.name)
    setSkybox({ type: isHdr?'hdr':'image', value: URL.createObjectURL(f), showBg:true })
  }

  const applyUrl = () => {
    if(!url.trim()) return
    const isHdr = /\.(hdr|exr)/i.test(url)
    setSkybox({ type:isHdr?'hdr':'image', value:url.trim(), showBg:true })
    setUrl('')
  }

  return (
    <div style={{ padding:12, display:'flex', flexDirection:'column', gap:12 }}>

      {/* Show background toggle */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'8px 10px', background:'var(--bg2)', borderRadius:'var(--radius)',
        border:'1px solid var(--border)' }}>
        <div>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--text0)' }}>Show Background</div>
          <div style={{ fontSize:10, color:'var(--text2)', marginTop:2 }}>
            {skybox.type==='preset' ? `Preset — ${lightingPreset}` :
             skybox.type==='color'  ? `Color — ${skybox.bgColor}` :
             skybox.type==='image'  ? 'Custom Image' : 'HDR'}
          </div>
        </div>
        <button onClick={() => setSkybox({ showBg:!skybox.showBg })} style={{
          width:40, height:22, borderRadius:11,
          background: skybox.showBg ? 'var(--accent)' : 'var(--bg4)',
          border:'none', cursor:'pointer', position:'relative', transition:'background 0.2s',
          boxShadow: skybox.showBg ? '0 0 8px rgba(79,142,255,0.4)' : 'none',
        }}>
          <div style={{
            position:'absolute', top:3, left: skybox.showBg ? 20 : 3,
            width:16, height:16, borderRadius:8, background:'#fff',
            transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.4)',
          }}/>
        </button>
      </div>

      {/* Preset environments */}
      <div>
        <div style={{ fontSize:10, color:'var(--text2)', fontWeight:600, letterSpacing:'0.08em',
          marginBottom:6, textTransform:'uppercase' }}>Preset Environments</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
          {PRESETS.map(p => (
            <button key={p.id}
              onClick={() => { setLightingPreset(p.id); setSkybox({ type:'preset', value:null }) }}
              style={{
                padding:'9px 8px', borderRadius:'var(--radius-sm)',
                background: skybox.type==='preset' && lightingPreset===p.id ? 'rgba(79,142,255,0.12)' : 'var(--bg2)',
                border:`1px solid ${skybox.type==='preset' && lightingPreset===p.id ? 'rgba(79,142,255,0.3)' : 'var(--border)'}`,
                color: skybox.type==='preset' && lightingPreset===p.id ? 'var(--accent)' : 'var(--text1)',
                fontSize:12, cursor:'pointer', textAlign:'left', transition:'all 0.12s',
                display:'flex', alignItems:'center', gap:6,
              }}
            ><span style={{ opacity:0.7 }}>{p.icon}</span> {p.label}</button>
          ))}
        </div>
      </div>

      {/* Solid color */}
      <div>
        <div style={{ fontSize:10, color:'var(--text2)', fontWeight:600, letterSpacing:'0.08em',
          marginBottom:6, textTransform:'uppercase' }}>Solid Color</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {COLORS.map(col => (
            <div key={col} onClick={() => setSkybox({ type:'color', bgColor:col, showBg:true })}
              style={{
                width:30, height:30, borderRadius:'var(--radius-sm)',
                background:col, cursor:'pointer', transition:'transform 0.1s',
                border:`2px solid ${skybox.type==='color'&&skybox.bgColor===col ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`,
                boxShadow: skybox.type==='color'&&skybox.bgColor===col ? '0 0 8px rgba(79,142,255,0.5)' : 'none',
              }}
              onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1)'}
              onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
            />
          ))}
          {/* Color picker */}
          <label style={{ width:30, height:30, borderRadius:'var(--radius-sm)', cursor:'pointer',
            border:'1px dashed var(--border-hi)', display:'flex', alignItems:'center', justifyContent:'center',
            color:'var(--text2)', fontSize:18, overflow:'hidden' }}>
            +
            <input type="color" onChange={e=>setSkybox({type:'color',bgColor:e.target.value,showBg:true})}
              style={{ position:'absolute', opacity:0, width:0, height:0 }} />
          </label>
        </div>
      </div>

      {/* Upload */}
      <div>
        <div style={{ fontSize:10, color:'var(--text2)', fontWeight:600, letterSpacing:'0.08em',
          marginBottom:6, textTransform:'uppercase' }}>Upload Skybox</div>
        <button onClick={() => fileRef.current?.click()} style={{
          width:'100%', padding:'10px', borderRadius:'var(--radius)',
          background:'var(--bg2)', border:'2px dashed var(--border-hi)',
          color:'var(--text1)', fontSize:12, cursor:'pointer', transition:'all 0.15s',
        }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--text0)'}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-hi)';e.currentTarget.style.color='var(--text1)'}}
        >📁 Upload Image / HDR / EXR</button>
        <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.hdr,.exr" style={{display:'none'}} onChange={handleFile} />
        <div style={{ fontSize:10, color:'var(--text3)', marginTop:4 }}>
          JPG/PNG equirectangular · HDR · EXR
        </div>
      </div>

      {/* URL */}
      <div>
        <div style={{ fontSize:10, color:'var(--text2)', fontWeight:600, letterSpacing:'0.08em',
          marginBottom:6, textTransform:'uppercase' }}>Paste URL</div>
        <div style={{ display:'flex', gap:5, marginBottom:4 }}>
          {['image','hdr'].map(t=>(
            <button key={t} onClick={()=>setUrlType(t)} style={{
              flex:1, padding:'4px 0', borderRadius:'var(--radius-sm)',
              background:urlType===t?'rgba(79,142,255,0.12)':'var(--bg2)',
              border:`1px solid ${urlType===t?'rgba(79,142,255,0.3)':'var(--border)'}`,
              color:urlType===t?'var(--accent)':'var(--text1)',
              fontSize:10, fontWeight:600, cursor:'pointer',
            }}>{t.toUpperCase()}</button>
          ))}
        </div>
        <div style={{ display:'flex', gap:5 }}>
          <input value={url} onChange={e=>setUrl(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&applyUrl()}
            placeholder="https://…equirectangular.jpg" style={{ flex:1 }} />
          <button onClick={applyUrl} style={{
            padding:'5px 10px', borderRadius:'var(--radius-sm)',
            background:'var(--accent)', border:'none', color:'#fff',
            fontSize:11, fontWeight:600, cursor:'pointer', flexShrink:0,
          }}>Apply</button>
        </div>
      </div>

      {/* Free HDR link */}
      <div style={{ padding:'10px', background:'var(--bg2)', borderRadius:'var(--radius)',
        border:'1px solid var(--border)', fontSize:11, color:'var(--text2)', lineHeight:1.6 }}>
        💡 Free HDRIs at{' '}
        <a href="https://polyhaven.com/hdris" target="_blank"
          style={{ color:'var(--accent)', textDecoration:'none' }}>polyhaven.com ↗</a>
        <br/>Right-click 1K JPEG → Copy image address → paste above
      </div>

      {/* Clear */}
      {(skybox.type==='image'||skybox.type==='hdr') && (
        <button onClick={() => setSkybox({type:'preset',value:null,showBg:false,bgColor:'#0c0c10'})} style={{
          padding:'7px 0', borderRadius:'var(--radius-sm)',
          background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)',
          color:'var(--danger)', fontSize:11, cursor:'pointer',
        }}>✕ Clear Custom Skybox</button>
      )}
    </div>
  )
}
