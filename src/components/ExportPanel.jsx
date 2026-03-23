import { useState, useRef } from 'react'
import useStore from '../store/useStore'

function Stat({ label, value }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'5px 0', borderBottom:'1px solid var(--border)' }}>
      <span style={{ fontSize:11, color:'var(--text2)' }}>{label}</span>
      <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'var(--text0)', fontWeight:600 }}>{value}</span>
    </div>
  )
}

export default function ExportPanel({ canvasRef }) {
  const { totalFrames, fps, setCurrentFrame, setIsPlaying,
    isExporting, setIsExporting, exportProgress, setExportProgress,
    exportedVideoUrl, setExportedVideoUrl } = useStore()

  const [quality, setQuality] = useState(0.9)
  const [outFps,  setOutFps]  = useState(30)
  const [format,  setFormat]  = useState('webm')
  const [status,  setStatus]  = useState('')
  const cancelRef = useRef(false)
  const framesRef = useRef([])

  const duration  = (totalFrames / fps).toFixed(1)
  const estSize   = Math.round((totalFrames / fps) * outFps * 0.25)

  const captureFrame = () => {
    const c = document.querySelector('canvas')
    return c ? c.toDataURL('image/jpeg', quality) : null
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms))

  const startExport = async () => {
    if (isExporting) return
    setIsExporting(true); setExportedVideoUrl(null)
    cancelRef.current = false; framesRef.current = []
    setStatus('Capturing frames…')
    const store = useStore.getState()

    for (let f = 0; f < totalFrames; f++) {
      if (cancelRef.current) break
      store.setCurrentFrame(f)
      await sleep(1000/fps + 16)
      const d = captureFrame()
      if (d) framesRef.current.push(d)
      setExportProgress(Math.round((f/totalFrames)*78))
    }

    if (!cancelRef.current && framesRef.current.length > 0) {
      setStatus('Encoding video…'); setExportProgress(82)
      try {
        const blob = await encodeVideo(framesRef.current, outFps)
        setExportedVideoUrl(URL.createObjectURL(blob))
        setExportProgress(100); setStatus('Done!')
      } catch(e) { setStatus('Error: ' + e.message) }
    }
    setIsExporting(false); store.setCurrentFrame(0)
  }

  const encodeVideo = (frames, fps) => new Promise((res, rej) => {
    if (!frames.length) { rej(new Error('No frames')); return }
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width; canvas.height = img.height
      const ctx = canvas.getContext('2d')
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
      const rec  = new MediaRecorder(canvas.captureStream(fps), { mimeType:mime, videoBitsPerSecond:8_000_000 })
      const chunks = []
      rec.ondataavailable = e => chunks.push(e.data)
      rec.onstop = () => res(new Blob(chunks, { type:'video/webm' }))
      rec.start()
      let i = 0
      const iv = setInterval(() => {
        if (i >= frames.length) { clearInterval(iv); rec.stop(); return }
        const fi = new Image(); fi.onload = () => ctx.drawImage(fi,0,0); fi.src = frames[i++]
        setExportProgress(82 + Math.round((i/frames.length)*17))
      }, 1000/fps)
    }
    img.onerror = rej; img.src = frames[0]
  })

  return (
    <div style={{ padding:12, display:'flex', flexDirection:'column', gap:12 }}>

      {/* Stats */}
      <div style={{ background:'var(--bg2)', borderRadius:'var(--radius)', padding:'10px 12px',
        border:'1px solid var(--border)' }}>
        <Stat label="Frames"   value={totalFrames} />
        <Stat label="Duration" value={`${duration}s`} />
        <Stat label="Timeline" value={`${fps} fps`} />
        <Stat label="Format"   value="WebM VP9" />
      </div>

      {/* Quality */}
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
          <span style={{ fontSize:11, color:'var(--text2)', fontWeight:500 }}>Frame Quality</span>
          <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'var(--accent)' }}>{Math.round(quality*100)}%</span>
        </div>
        <input type="range" min={0.5} max={1} step={0.01} value={quality}
          onChange={e => setQuality(+e.target.value)} />
      </div>

      {/* FPS */}
      <div>
        <div style={{ fontSize:11, color:'var(--text2)', fontWeight:500, marginBottom:6 }}>Output FPS</div>
        <div style={{ display:'flex', gap:5 }}>
          {[15,24,30,60].map(f => (
            <button key={f} onClick={() => setOutFps(f)} style={{
              flex:1, padding:'6px 0', borderRadius:'var(--radius-sm)',
              background: outFps===f ? 'rgba(79,142,255,0.15)' : 'var(--bg2)',
              border:`1px solid ${outFps===f ? 'rgba(79,142,255,0.4)' : 'var(--border)'}`,
              color: outFps===f ? 'var(--accent)' : 'var(--text1)',
              fontSize:11, fontWeight: outFps===f ? 700 : 400, cursor:'pointer',
              transition:'all 0.12s',
            }}>{f}</button>
          ))}
        </div>
      </div>

      {/* Progress */}
      {isExporting && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
            <span style={{ fontSize:11, color:'var(--text2)' }}>{status}</span>
            <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'var(--accent)' }}>{exportProgress}%</span>
          </div>
          <div style={{ height:4, background:'var(--bg3)', borderRadius:2 }}>
            <div style={{ height:'100%', borderRadius:2, transition:'width 0.3s',
              width:`${exportProgress}%`, background:'linear-gradient(90deg,var(--accent),var(--accent2))' }} />
          </div>
        </div>
      )}

      {/* Status message */}
      {status && !isExporting && (
        <div style={{
          padding:'8px 10px', borderRadius:'var(--radius-sm)',
          background: status.includes('Error') ? 'rgba(239,68,68,0.08)' : 'rgba(6,214,160,0.08)',
          border:`1px solid ${status.includes('Error') ? 'rgba(239,68,68,0.2)' : 'rgba(6,214,160,0.2)'}`,
          color: status.includes('Error') ? 'var(--danger)' : 'var(--accent3)',
          fontSize:11,
        }}>{status}</div>
      )}

      {/* Buttons */}
      {!isExporting ? (
        <button onClick={startExport} style={{
          padding:'11px 0', borderRadius:'var(--radius)',
          background:'linear-gradient(135deg,var(--accent),var(--accent2))',
          border:'none', color:'#fff', fontSize:13, fontWeight:700,
          cursor:'pointer', letterSpacing:'0.04em',
          boxShadow:'0 4px 20px rgba(79,142,255,0.35)',
          transition:'opacity 0.15s',
        }}>▶ Render & Export</button>
      ) : (
        <button onClick={() => { cancelRef.current = true }} style={{
          padding:'10px 0', borderRadius:'var(--radius)',
          background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)',
          color:'var(--danger)', fontSize:12, fontWeight:600, cursor:'pointer',
        }}>⏹ Cancel</button>
      )}

      {/* Result */}
      {exportedVideoUrl && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <video src={exportedVideoUrl} controls style={{ width:'100%', borderRadius:'var(--radius)', border:'1px solid var(--border)' }} />
          <a href={exportedVideoUrl} download={`animation_${Date.now()}.webm`} style={{
            display:'block', padding:'9px 0', borderRadius:'var(--radius)',
            background:'rgba(6,214,160,0.1)', border:'1px solid rgba(6,214,160,0.3)',
            color:'var(--accent3)', textAlign:'center', textDecoration:'none',
            fontSize:12, fontWeight:600,
          }}>⬇ Download Video</a>
        </div>
      )}
    </div>
  )
}
