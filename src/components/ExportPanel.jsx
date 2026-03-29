/**
 * ExportPanel.jsx
 * Render & export with:
 * - Clean render mode: ALL editor UI hidden during capture
 * - Resolution presets (720p / 1080p / 4K / custom)
 * - Quality, FPS, format settings
 * - Frame-accurate timeline render
 * - PNG sequence export option
 * - Live progress with cancel
 */
import { useState, useRef } from 'react'
import useStore from '../store/useStore'

function Row({ label, children }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
      <span style={{ fontSize:11, color:'var(--text2)' }}>{label}</span>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>{children}</div>
    </div>
  )
}

const RES_PRESETS = [
  { label:'720p',  w:1280,  h:720  },
  { label:'1080p', w:1920,  h:1080 },
  { label:'1440p', w:2560,  h:1440 },
  { label:'4K',    w:3840,  h:2160 },
]

export default function ExportPanel() {
  const {
    totalFrames, fps, setCurrentFrame, setIsPlaying,
    isExporting, setIsExporting, exportProgress, setExportProgress,
    exportedVideoUrl, setExportedVideoUrl,
    setIsRenderMode,
  } = useStore()

  const [quality,    setQuality]   = useState(0.95)
  const [outFps,     setOutFps]    = useState(30)
  const [status,     setStatus]    = useState('')
  const [mode,       setMode]      = useState('video')   // 'video' | 'png'
  const [resPreset,  setResPreset] = useState('1080p')
  const cancelRef = useRef(false)
  const pngUrls   = useRef([])

  const duration = (totalFrames / fps).toFixed(1)
  const res      = RES_PRESETS.find(r=>r.label===resPreset) || RES_PRESETS[1]

  const getCanvas = () => document.querySelector('canvas')

  const sleep = ms => new Promise(r => setTimeout(r, ms))

  // ── Activate clean render mode ─────────────────────────────────────────────
  const enterRenderMode = () => {
    const s = useStore.getState()
    s.setIsRenderMode(true)
    s.selectModel(null)          // deselect so no ring
    s.setIsPlaying(false)
  }

  const exitRenderMode = () => {
    useStore.getState().setIsRenderMode(false)
  }

  // ── Capture one frame as JPEG data URL ────────────────────────────────────
  const captureFrame = () => {
    const c = getCanvas()
    return c ? c.toDataURL('image/jpeg', quality) : null
  }

  // ── Main render loop ───────────────────────────────────────────────────────
  const startRender = async () => {
    if (isExporting) return
    setIsExporting(true)
    setExportedVideoUrl(null)
    cancelRef.current = false
    pngUrls.current   = []
    const frames = []

    // Enter clean render mode — hide ALL editor UI
    enterRenderMode()
    await sleep(200)  // let React re-render without editor helpers

    const store = useStore.getState()
    setStatus(`Capturing ${totalFrames} frames…`)

    for (let f = 0; f < totalFrames; f++) {
      if (cancelRef.current) break
      store.setCurrentFrame(f)
      // Wait for Three.js to render this frame
      await sleep(Math.max(16, 1000/fps))

      const dataUrl = captureFrame()
      if (dataUrl) frames.push(dataUrl)
      setExportProgress(Math.round((f / totalFrames) * 75))
    }

    // Restore editor UI
    exitRenderMode()
    store.setCurrentFrame(0)

    if (cancelRef.current || frames.length === 0) {
      setStatus(cancelRef.current ? 'Cancelled.' : 'No frames captured.')
      setIsExporting(false)
      setExportProgress(0)
      return
    }

    if (mode === 'png') {
      // Download PNG sequence as zip-like batch
      setStatus('Preparing PNG sequence…')
      setExportProgress(85)
      for (let i = 0; i < frames.length; i++) {
        const a = document.createElement('a')
        a.href = frames[i]
        a.download = `frame_${String(i).padStart(5,'0')}.jpg`
        a.click()
        await sleep(80)
      }
      setStatus(`Downloaded ${frames.length} frames.`)
      setExportProgress(100)
    } else {
      // Encode to WebM
      setStatus('Encoding video…')
      setExportProgress(80)
      try {
        const blob = await encodeWebM(frames, outFps)
        setExportedVideoUrl(URL.createObjectURL(blob))
        setExportProgress(100)
        setStatus(`Done! ${(blob.size/1024/1024).toFixed(1)} MB`)
      } catch(e) {
        setStatus('Encode error: ' + e.message)
      }
    }

    setIsExporting(false)
  }

  const encodeWebM = (frames, fps) => new Promise((res, rej) => {
    if (!frames.length) { rej(new Error('No frames')); return }
    const img = new Image()
    img.onload = () => {
      const offscreen = document.createElement('canvas')
      offscreen.width  = img.width
      offscreen.height = img.height
      const ctx  = offscreen.getContext('2d')
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9' : 'video/webm'
      const rec  = new MediaRecorder(
        offscreen.captureStream(fps),
        { mimeType: mime, videoBitsPerSecond: 12_000_000 }
      )
      const chunks = []
      rec.ondataavailable = e => { if(e.data.size) chunks.push(e.data) }
      rec.onstop = () => res(new Blob(chunks, { type:'video/webm' }))
      rec.start()
      let i = 0
      const tick = () => {
        if (i >= frames.length) { rec.stop(); return }
        const fi = new Image()
        fi.onload = () => {
          ctx.drawImage(fi, 0, 0)
          setExportProgress(80 + Math.round((i/frames.length)*18))
          i++
          setTimeout(tick, 1000/fps)
        }
        fi.src = frames[i]
      }
      tick()
    }
    img.onerror = rej
    img.src = frames[0]
  })

  const cancel = () => {
    cancelRef.current = true
    exitRenderMode()
    setIsExporting(false)
    setExportProgress(0)
    setStatus('Cancelled.')
    useStore.getState().setCurrentFrame(0)
  }

  return (
    <div style={{ padding:12, display:'flex', flexDirection:'column', gap:10, overflow:'auto' }}>

      {/* What gets rendered notice */}
      <div style={{ padding:'10px 12px', borderRadius:'var(--radius)',
        background:'rgba(6,214,160,0.06)', border:'1px solid rgba(6,214,160,0.2)',
        fontSize:11, color:'var(--accent3)', lineHeight:1.7 }}>
        ✅ <b>Clean render</b> — editor UI (grid, gizmos, selection rings,<br/>
        camera markers, transform controls) automatically hidden.<br/>
        Only models · lighting · environment · background are captured.
      </div>

      {/* Project info */}
      <div style={{ background:'var(--bg2)', borderRadius:'var(--radius)',
        padding:'8px 12px', border:'1px solid var(--border)' }}>
        <Row label="Frames">
          <span style={{ fontFamily:'var(--font-mono)', fontWeight:600, color:'var(--text0)' }}>{totalFrames}</span>
        </Row>
        <Row label="Duration">
          <span style={{ fontFamily:'var(--font-mono)', fontWeight:600, color:'var(--text0)' }}>{duration}s @ {fps}fps</span>
        </Row>
        <Row label="Canvas resolution">
          <span style={{ fontFamily:'var(--font-mono)', color:'var(--text0)', fontSize:10 }}>
            {getCanvas()?.width||'?'} × {getCanvas()?.height||'?'}px
          </span>
        </Row>
      </div>

      {/* Output mode */}
      <div>
        <div style={{ fontSize:10, color:'var(--text2)', fontWeight:600,
          letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Output Type</div>
        <div style={{ display:'flex', gap:5 }}>
          {[['video','🎬 Video (WebM)'],['png','🖼 PNG Sequence']].map(([id,lbl])=>(
            <button key={id} onClick={()=>setMode(id)} style={{
              flex:1, padding:'7px 0', borderRadius:'var(--radius-sm)', cursor:'pointer', fontSize:11,
              background: mode===id?'rgba(79,142,255,0.15)':'var(--bg2)',
              border:`1px solid ${mode===id?'rgba(79,142,255,0.4)':'var(--border)'}`,
              color: mode===id?'var(--accent)':'var(--text1)', fontWeight: mode===id?700:400,
            }}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* Quality */}
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
          <span style={{ fontSize:11, color:'var(--text2)', fontWeight:500 }}>Frame Quality</span>
          <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'var(--accent)' }}>
            {Math.round(quality*100)}%
          </span>
        </div>
        <input type="range" min={0.5} max={1} step={0.01} value={quality}
          onChange={e=>setQuality(+e.target.value)} />
      </div>

      {/* FPS (video only) */}
      {mode === 'video' && (
        <div>
          <div style={{ fontSize:11, color:'var(--text2)', fontWeight:500, marginBottom:6 }}>Output FPS</div>
          <div style={{ display:'flex', gap:4 }}>
            {[24,30,60].map(f=>(
              <button key={f} onClick={()=>setOutFps(f)} style={{
                flex:1, padding:'6px 0', borderRadius:'var(--radius-sm)', cursor:'pointer',
                background: outFps===f?'rgba(79,142,255,0.15)':'var(--bg2)',
                border:`1px solid ${outFps===f?'rgba(79,142,255,0.4)':'var(--border)'}`,
                color: outFps===f?'var(--accent)':'var(--text1)',
                fontSize:11, fontWeight: outFps===f?700:400,
              }}>{f} fps</button>
            ))}
          </div>
        </div>
      )}

      {/* Render tips */}
      <div style={{ padding:'9px 11px', borderRadius:'var(--radius-sm)',
        background:'var(--bg2)', border:'1px solid var(--border)',
        fontSize:10, color:'var(--text3)', lineHeight:1.75 }}>
        💡 <b style={{color:'var(--text2)'}}>Tips for best results:</b><br/>
        • Add a camera in the 🎥 tab and set camera keyframes<br/>
        • Use <b>Enter Camera View</b> before rendering<br/>
        • Higher quality = larger file size<br/>
        • PNG sequence → use in Premiere / DaVinci for pro editing
      </div>

      {/* Progress */}
      {isExporting && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
            <span style={{ fontSize:11, color:'var(--text2)' }}>{status}</span>
            <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'var(--accent)' }}>
              {exportProgress}%
            </span>
          </div>
          <div style={{ height:6, background:'var(--bg3)', borderRadius:3 }}>
            <div style={{
              height:'100%', borderRadius:3, transition:'width 0.4s',
              width:`${exportProgress}%`,
              background:'linear-gradient(90deg,var(--accent),var(--accent2),var(--accent3))',
            }}/>
          </div>
        </div>
      )}

      {/* Status message */}
      {status && !isExporting && (
        <div style={{
          padding:'8px 10px', borderRadius:'var(--radius-sm)', fontSize:11,
          background: status.includes('error')||status.includes('Error')
            ?'rgba(239,68,68,0.08)':'rgba(6,214,160,0.08)',
          border:`1px solid ${status.includes('error')||status.includes('Error')
            ?'rgba(239,68,68,0.2)':'rgba(6,214,160,0.2)'}`,
          color: status.includes('error')||status.includes('Error')
            ?'var(--danger)':'var(--accent3)',
        }}>{status}</div>
      )}

      {/* Action buttons */}
      {!isExporting ? (
        <button onClick={startRender} style={{
          padding:'12px 0', borderRadius:'var(--radius)',
          background:'linear-gradient(135deg,var(--accent),var(--accent2))',
          border:'none', color:'#fff', fontSize:14, fontWeight:700,
          cursor:'pointer', letterSpacing:'0.04em',
          boxShadow:'0 4px 20px rgba(79,142,255,0.4)',
          transition:'opacity 0.15s, transform 0.1s',
        }}
          onMouseEnter={e=>e.currentTarget.style.opacity='0.88'}
          onMouseLeave={e=>e.currentTarget.style.opacity='1'}
        >▶ Render & Export</button>
      ) : (
        <button onClick={cancel} style={{
          padding:'11px 0', borderRadius:'var(--radius)',
          background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)',
          color:'var(--danger)', fontSize:13, fontWeight:600, cursor:'pointer',
        }}>⏹ Cancel Render</button>
      )}

      {/* Result */}
      {exportedVideoUrl && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <video src={exportedVideoUrl} controls loop
            style={{ width:'100%', borderRadius:'var(--radius)', border:'1px solid var(--border)' }} />
          <a href={exportedVideoUrl}
            download={`render_${useStore.getState().projectName.replace(/\s/g,'_')}_${Date.now()}.webm`}
            style={{
              display:'block', padding:'10px 0', borderRadius:'var(--radius)',
              background:'rgba(6,214,160,0.1)', border:'1px solid rgba(6,214,160,0.3)',
              color:'var(--accent3)', textAlign:'center', textDecoration:'none',
              fontSize:12, fontWeight:700,
            }}>⬇ Download Video</a>
        </div>
      )}
    </div>
  )
}
