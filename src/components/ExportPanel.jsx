import { useState, useRef } from 'react'
import useStore from '../store/useStore'

export default function ExportPanel({ canvasRef }) {
  const {
    totalFrames, fps, setCurrentFrame, setIsPlaying,
    isExporting, setIsExporting, exportProgress, setExportProgress,
    exportedVideoUrl, setExportedVideoUrl,
    clearRecordedFrames,
  } = useStore()

  const [quality, setQuality] = useState(0.92)
  const [outFps, setOutFps] = useState(30)
  const [status, setStatus] = useState('')
  const captureRef = useRef(false)
  const framesRef = useRef([])

  const captureFrame = () => {
    const canvas = canvasRef?.current
    if (!canvas) return null
    // Find the actual canvas element inside the wrapper
    const c = canvas.tagName === 'CANVAS' ? canvas : canvas.querySelector('canvas')
    if (!c) return null
    return c.toDataURL('image/jpeg', quality)
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms))

  const startExport = async () => {
    if (isExporting) return
    setIsExporting(true)
    setExportedVideoUrl(null)
    framesRef.current = []
    captureRef.current = true

    setStatus('Capturing frames...')
    const store = useStore.getState()

    for (let frame = 0; frame < totalFrames; frame++) {
      if (!captureRef.current) break
      store.setCurrentFrame(frame)
      await sleep(1000 / fps + 10) // wait for render

      const dataUrl = captureFrame()
      if (dataUrl) framesRef.current.push(dataUrl)
      setExportProgress(Math.round((frame / totalFrames) * 80))
    }

    if (!captureRef.current) {
      setIsExporting(false)
      setStatus('Cancelled')
      return
    }

    setStatus('Encoding video...')
    setExportProgress(85)

    try {
      // Create video using Canvas + MediaRecorder fallback (FFmpeg.wasm needs SharedArrayBuffer)
      const videoBlob = await encodeFramesToVideo(framesRef.current, outFps)
      const url = URL.createObjectURL(videoBlob)
      setExportedVideoUrl(url)
      setExportProgress(100)
      setStatus('Done! Video ready.')
    } catch (err) {
      setStatus(`Error: ${err.message}`)
      console.error(err)
    }

    setIsExporting(false)
    store.setCurrentFrame(0)
  }

  const encodeFramesToVideo = (frames, fps) => {
    return new Promise((resolve, reject) => {
      if (frames.length === 0) { reject(new Error('No frames captured')); return }

      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')

        const stream = canvas.captureStream(fps)
        const recorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : 'video/webm',
          videoBitsPerSecond: 8_000_000,
        })

        const chunks = []
        recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: 'video/webm' }))
        }

        recorder.start()

        let i = 0
        const interval = setInterval(() => {
          if (i >= frames.length) {
            clearInterval(interval)
            recorder.stop()
            return
          }
          const frame = new Image()
          frame.onload = () => ctx.drawImage(frame, 0, 0)
          frame.src = frames[i++]
          setExportProgress(85 + Math.round((i / frames.length) * 14))
        }, 1000 / fps)
      }
      img.onerror = reject
      img.src = frames[0]
    })
  }

  const cancel = () => {
    captureRef.current = false
    setIsExporting(false)
    setStatus('Cancelled')
    setExportProgress(0)
  }

  const duration = (totalFrames / fps).toFixed(1)
  const estimatedSize = Math.round((totalFrames / fps) * outFps * 0.3)

  return (
    <div style={{ padding: 10, fontFamily: 'Space Mono', overflow: 'auto', maxHeight: '100%' }}>
      <div style={{ fontSize: 10, color: '#666', marginBottom: 10, letterSpacing: '0.1em' }}>EXPORT VIDEO</div>

      <div style={{ background: 'rgba(0,245,255,0.04)', border: '1px solid rgba(0,245,255,0.1)', borderRadius: 6, padding: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>PROJECT INFO</div>
        <div style={{ fontSize: 11, color: '#888', lineHeight: 1.8 }}>
          <div>Frames: <span style={{ color: '#00f5ff' }}>{totalFrames}</span></div>
          <div>Timeline: <span style={{ color: '#00f5ff' }}>{duration}s @ {fps}fps</span></div>
          <div>Output: <span style={{ color: '#00f5ff' }}>WebM (VP9)</span></div>
        </div>
      </div>

      {/* Quality */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>FRAME QUALITY</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="range" min={0.5} max={1} step={0.01}
            value={quality}
            onChange={e => setQuality(parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ color: '#00f5ff', fontSize: 11 }}>{Math.round(quality * 100)}%</span>
        </div>
      </div>

      {/* FPS */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>OUTPUT FPS</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[15, 24, 30, 60].map(f => (
            <button
              key={f}
              onClick={() => setOutFps(f)}
              style={{
                flex: 1, padding: '6px 0',
                background: outFps === f ? 'rgba(0,245,255,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${outFps === f ? '#00f5ff' : 'rgba(255,255,255,0.1)'}`,
                color: outFps === f ? '#00f5ff' : '#666',
                borderRadius: 4, cursor: 'pointer',
                fontSize: 11, fontFamily: 'Space Mono',
              }}
            >{f}</button>
          ))}
        </div>
      </div>

      {/* Progress */}
      {isExporting && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: '#888' }}>{status}</span>
            <span style={{ fontSize: 10, color: '#00f5ff' }}>{exportProgress}%</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
            <div style={{
              height: '100%', width: `${exportProgress}%`,
              background: 'linear-gradient(90deg, #00f5ff, #0080ff)',
              borderRadius: 2, transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      {status && !isExporting && (
        <div style={{
          fontSize: 11, color: status.includes('Error') ? '#ff4060' : '#40ff80',
          marginBottom: 10, padding: '6px 8px',
          background: status.includes('Error') ? 'rgba(255,64,96,0.08)' : 'rgba(64,255,128,0.08)',
          borderRadius: 4, border: `1px solid ${status.includes('Error') ? 'rgba(255,64,96,0.2)' : 'rgba(64,255,128,0.2)'}`,
        }}>
          {status}
        </div>
      )}

      {/* Buttons */}
      {!isExporting ? (
        <button
          onClick={startExport}
          style={{
            width: '100%', padding: '10px 0',
            background: 'linear-gradient(135deg, rgba(0,245,255,0.2), rgba(0,128,255,0.2))',
            border: '1px solid rgba(0,245,255,0.4)',
            color: '#00f5ff', borderRadius: 6,
            cursor: 'pointer', fontSize: 12,
            fontFamily: 'Space Mono', fontWeight: 'bold',
            letterSpacing: '0.1em',
          }}
        >
          ▶ RENDER & EXPORT
        </button>
      ) : (
        <button
          onClick={cancel}
          style={{
            width: '100%', padding: '10px 0',
            background: 'rgba(255,64,96,0.1)',
            border: '1px solid rgba(255,64,96,0.3)',
            color: '#ff4060', borderRadius: 6,
            cursor: 'pointer', fontSize: 12,
            fontFamily: 'Space Mono',
          }}
        >
          ⏹ CANCEL
        </button>
      )}

      {/* Download */}
      {exportedVideoUrl && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, color: '#40ff80', marginBottom: 8 }}>✓ VIDEO READY</div>
          <video
            src={exportedVideoUrl}
            controls
            style={{ width: '100%', borderRadius: 6, marginBottom: 8 }}
          />
          <a
            href={exportedVideoUrl}
            download={`animation_${Date.now()}.webm`}
            style={{
              display: 'block', width: '100%', padding: '8px 0',
              background: 'rgba(64,255,128,0.1)',
              border: '1px solid rgba(64,255,128,0.3)',
              color: '#40ff80', borderRadius: 6,
              textAlign: 'center', textDecoration: 'none',
              fontSize: 11, fontFamily: 'Space Mono',
            }}
          >
            ⬇ DOWNLOAD VIDEO
          </a>
        </div>
      )}
    </div>
  )
}
