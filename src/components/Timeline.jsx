import { useRef, useState, useCallback, useEffect } from 'react'
import useStore from '../store/useStore'

const TRACK_H  = 28
const COLORS   = ['#4f8eff','#ef4444','#22c55e','#f59e0b','#8b5cf6','#f97316']

function KeyframeDot({ frame, modelId, color, trackW, totalFrames }) {
  const { moveKeyframe, removeKeyframe } = useStore.getState()
  const x = (frame / totalFrames) * trackW

  const onPointerDown = (e) => {
    e.stopPropagation()
    const startX = e.clientX, startF = frame
    const move = me => {
      const dx   = me.clientX - startX
      const newF = Math.max(0, Math.min(totalFrames-1, Math.round(startF + (dx/trackW)*totalFrames)))
      if (newF !== frame) moveKeyframe(frame, newF, modelId)
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup',   up)
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onDoubleClick={e => { e.stopPropagation(); removeKeyframe(frame, modelId) }}
      title={`Frame ${frame} — drag to move, dbl-click to delete`}
      style={{
        position:'absolute', left: x - 5, top:'50%', transform:'translateY(-50%)',
        width:10, height:10, borderRadius:2,
        background: color, cursor:'ew-resize', zIndex:10,
        boxShadow:`0 0 6px ${color}88`,
        border:'1px solid rgba(255,255,255,0.3)',
        rotate:'45deg',
        transition:'transform 0.1s',
      }}
    />
  )
}

export default function Timeline() {
  const {
    models, keyframes, currentFrame, totalFrames, fps, isPlaying,
    setCurrentFrame, setIsPlaying, addKeyframe, selectedModelId,
    showTimeline, setShowTimeline, setTotalFrames, setFps,
    cameras=[], activeCameraId:activeCamId,
  } = useStore()

  const rulerRef  = useRef()
  const [trackW, setTrackW] = useState(600)
  const [settings, setSettings] = useState(false)

  const measuredRef = useCallback(node => {
    if (!node) return
    const ro = new ResizeObserver(e => setTrackW(e[0].contentRect.width))
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  const scrub = useCallback((clientX) => {
    const rect = rulerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = clientX - rect.left
    setCurrentFrame(Math.round(Math.max(0, Math.min(totalFrames-1, (x/trackW)*totalFrames))))
  }, [trackW, totalFrames])

  const handlePointerDown = (e) => {
    scrub(e.touches ? e.touches[0].clientX : e.clientX)
    const move = me => scrub(me.touches ? me.touches[0].clientX : me.clientX)
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup',   up)
  }

  const playheadX = (currentFrame / totalFrames) * trackW
  const duration  = (totalFrames / fps).toFixed(1)

  if (!showTimeline) return (
    <div style={{ position:'absolute', bottom:8, left:'50%', transform:'translateX(-50%)', zIndex:200 }}>
      <button onClick={() => setShowTimeline(true)} style={{
        padding:'5px 16px', borderRadius:20, border:'1px solid var(--border-hi)',
        background:'var(--bg2)', color:'var(--text1)', fontSize:11, cursor:'pointer',
      }}>Show Timeline</button>
    </div>
  )

  return (
    <div style={{
      position:'absolute', bottom:0, left:0, right:0,
      background:'var(--bg1)',
      borderTop:'1px solid var(--border)',
      zIndex:200, userSelect:'none',
    }}>
      {/* Transport bar */}
      <div style={{
        display:'flex', alignItems:'center', gap:6,
        padding:'5px 10px',
        borderBottom:'1px solid var(--border)',
      }}>
        <button onClick={() => setCurrentFrame(0)} style={tbtn} title="First frame">⏮</button>
        <button onClick={() => setCurrentFrame(Math.max(0,currentFrame-1))} style={tbtn}>◀</button>
        <button onClick={() => setIsPlaying(!isPlaying)} style={{
          ...tbtn,
          background: isPlaying ? 'var(--danger)' : 'var(--accent)',
          color:'#fff', minWidth:32,
          boxShadow: isPlaying ? '0 0 8px rgba(239,68,68,0.4)' : '0 0 8px rgba(79,142,255,0.4)',
        }}>{isPlaying ? '⏸' : '▶'}</button>
        <button onClick={() => setCurrentFrame(Math.min(totalFrames-1,currentFrame+1))} style={tbtn}>▶</button>
        <button onClick={() => setCurrentFrame(totalFrames-1)} style={tbtn}>⏭</button>

        <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text1)',
          background:'var(--bg3)', padding:'3px 8px', borderRadius:'var(--radius-sm)',
          border:'1px solid var(--border)', flexShrink:0 }}>
          <span style={{ color:'var(--text0)', fontWeight:600 }}>{String(currentFrame).padStart(4,'0')}</span>
          <span style={{ color:'var(--text3)' }}>/{totalFrames}</span>
        </div>

        <span style={{ fontSize:10, color:'var(--text3)' }}>{duration}s</span>

        <div style={{ width:1, height:16, background:'var(--border)', margin:'0 2px' }} />

        {selectedModelId && (
          <button
            onClick={() => addKeyframe(currentFrame, selectedModelId)}
            style={{
              ...tbtn,
              background:'rgba(245,158,11,0.12)',
              borderColor:'rgba(245,158,11,0.3)',
              color:'var(--warn)', fontWeight:600,
            }}
          >◆ Key</button>
        )}

        <div style={{ flex:1 }} />

        <button onClick={() => setSettings(!settings)} style={{ ...tbtn, opacity: settings ? 1 : 0.5 }} title="Timeline settings">⚙</button>
        <button onClick={() => setShowTimeline(false)} style={tbtn} title="Hide timeline">✕</button>
      </div>

      {/* Settings row */}
      {settings && (
        <div style={{
          display:'flex', gap:12, padding:'6px 12px',
          borderBottom:'1px solid var(--border)',
          background:'var(--bg2)', fontSize:11, color:'var(--text1)',
          alignItems:'center',
        }}>
          <span>Frames:</span>
          {[120,200,300,500].map(f => (
            <button key={f} onClick={() => setTotalFrames(f)} style={{
              ...tbtn, padding:'2px 8px', fontSize:10,
              background: totalFrames===f ? 'rgba(79,142,255,0.15)' : 'var(--bg3)',
              borderColor: totalFrames===f ? 'rgba(79,142,255,0.4)' : 'var(--border)',
              color: totalFrames===f ? 'var(--accent)' : 'var(--text1)',
            }}>{f}</button>
          ))}
          <span style={{ marginLeft:8 }}>FPS:</span>
          {[24,30,60].map(f => (
            <button key={f} onClick={() => setFps(f)} style={{
              ...tbtn, padding:'2px 8px', fontSize:10,
              background: fps===f ? 'rgba(79,142,255,0.15)' : 'var(--bg3)',
              borderColor: fps===f ? 'rgba(79,142,255,0.4)' : 'var(--border)',
              color: fps===f ? 'var(--accent)' : 'var(--text1)',
            }}>{f}</button>
          ))}
        </div>
      )}

      {/* Track area */}
      <div style={{ display:'flex', maxHeight:160, overflow:'hidden' }}>
        {/* Labels */}
        <div style={{ width:100, flexShrink:0, borderRight:'1px solid var(--border)' }}>
          <div style={{ height:20, display:'flex', alignItems:'center', padding:'0 8px',
            borderBottom:'1px solid var(--border)', fontSize:9, color:'var(--text3)', fontWeight:600, letterSpacing:'0.1em' }}>
            LAYERS
          </div>
          {models.map((m,i) => (
            <div key={m.id} style={{
              height:TRACK_H, display:'flex', alignItems:'center',
              padding:'0 8px', gap:6, fontSize:11,
              color: COLORS[i%COLORS.length],
              borderBottom:'1px solid var(--border)',
              overflow:'hidden',
            }}>
              <div style={{ width:6, height:6, borderRadius:1, background:COLORS[i%COLORS.length], flexShrink:0, rotate:'45deg' }} />
              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:10 }}>
                {m.name.substring(0,10)}
              </span>
            </div>
          ))}
        </div>

        {/* Scrollable ruler + tracks */}
        <div style={{ flex:1, overflow:'auto hidden' }}>
          {/* Ruler */}
          <div ref={el => { measuredRef(el); rulerRef.current = el }}
            style={{ position:'relative', height:20, borderBottom:'1px solid var(--border)',
              cursor:'crosshair', background:'var(--bg2)' }}
            onPointerDown={handlePointerDown}
            onTouchStart={e => handlePointerDown(e)}
          >
            {Array.from({ length: Math.ceil(totalFrames/10) }, (_,i) => {
              const f = i*10, x = (f/totalFrames)*trackW
              return (
                <div key={f} style={{ position:'absolute', left:x, top:0, bottom:0,
                  borderLeft:`1px solid ${f%50===0 ? 'var(--border-hi)' : 'var(--border)'}` }}>
                  {f%10===0 && <span style={{ fontSize:8, color:'var(--text3)', paddingLeft:2, lineHeight:'20px', pointerEvents:'none' }}>{f}</span>}
                </div>
              )
            })}
            <div style={{ position:'absolute', left:playheadX, top:0, bottom:0, width:2,
              background:'var(--accent)', boxShadow:'0 0 6px rgba(79,142,255,0.6)', pointerEvents:'none', zIndex:20 }}>
              <div style={{ position:'absolute', top:-1, left:-3, width:8, height:8,
                background:'var(--accent)', borderRadius:'0 0 3px 3px', clipPath:'polygon(50% 0,100% 100%,0 100%)' }} />
            </div>
          </div>

          {/* Tracks */}
          <div style={{ position:'relative' }}>
            {models.map((m,i) => {
              const c    = COLORS[i%COLORS.length]
              const mKfs = Object.entries(keyframes).filter(([,kf])=>kf[m.id]).map(([f])=>parseInt(f))
              return (
                <div key={m.id} style={{
                  position:'relative', height:TRACK_H,
                  background: m.id===selectedModelId ? `${c}08` : 'transparent',
                  borderBottom:'1px solid var(--border)',
                }}>
                  {/* Track line */}
                  <div style={{ position:'absolute', top:'50%', left:0, right:0,
                    height:1, background:'var(--border-hi)', opacity:0.5 }} />
                  {mKfs.map(f => (
                    <KeyframeDot key={f} frame={f} modelId={m.id}
                      color={c} trackW={trackW} totalFrames={totalFrames} />
                  ))}
                </div>
              )
            })}
            {/* Playhead */}
            <div style={{ position:'absolute', left:playheadX, top:0, bottom:0,
              width:1, background:'rgba(79,142,255,0.35)', pointerEvents:'none', zIndex:5 }} />
          </div>
        </div>
      </div>
    </div>
  )
}

const tbtn = {
  padding:'4px 8px', borderRadius:'var(--radius-sm)',
  background:'var(--bg3)', border:'1px solid var(--border)',
  color:'var(--text1)', fontSize:12, cursor:'pointer', flexShrink:0,
  transition:'all 0.12s',
}
