import { useRef, useState, useCallback } from 'react'
import useStore from '../store/useStore'

const FRAME_WIDTH = 4 // px per frame in timeline
const TRACK_HEIGHT = 32

function KeyframeDot({ frame, modelId, modelColor, timelineWidth, totalFrames, onDragEnd }) {
  const removeKeyframe = useStore(s => s.removeKeyframe)
  const moveKeyframe = useStore(s => s.moveKeyframe)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startFrame = useRef(frame)

  const x = (frame / totalFrames) * timelineWidth

  const handlePointerDown = (e) => {
    e.stopPropagation()
    dragging.current = true
    startX.current = e.clientX
    startFrame.current = frame

    const handleMove = (me) => {
      if (!dragging.current) return
      const dx = me.clientX - startX.current
      const dFrames = Math.round((dx / timelineWidth) * totalFrames)
      const newFrame = Math.max(0, Math.min(totalFrames - 1, startFrame.current + dFrames))
      if (newFrame !== frame) {
        moveKeyframe(frame, newFrame, modelId)
        startX.current = me.clientX
        startFrame.current = newFrame
      }
    }

    const handleUp = () => {
      dragging.current = false
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: x - 5,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 10,
        height: 10,
        background: modelColor,
        border: '1px solid rgba(255,255,255,0.5)',
        borderRadius: '50%',
        cursor: 'grab',
        zIndex: 10,
        boxShadow: `0 0 6px ${modelColor}`,
      }}
      onPointerDown={handlePointerDown}
      onDoubleClick={(e) => { e.stopPropagation(); removeKeyframe(frame, modelId) }}
      title={`Frame ${frame} — double click to delete`}
    />
  )
}

function TimelineTrack({ model, timelineWidth }) {
  const totalFrames = useStore(s => s.totalFrames)
  const keyframes = useStore(s => s.keyframes)
  const selectedModelId = useStore(s => s.selectedModelId)
  const selectModel = useStore(s => s.selectModel)

  const modelKeyframes = Object.entries(keyframes)
    .filter(([, kf]) => kf[model.id])
    .map(([f]) => parseInt(f))

  const colors = ['#00f5ff', '#ff4080', '#40ff80', '#ffaa00', '#aa40ff', '#ff8040']
  const colorIndex = useStore(s => s.models).findIndex(m => m.id === model.id) % colors.length
  const color = colors[colorIndex]

  const isSelected = selectedModelId === model.id

  return (
    <div
      style={{
        position: 'relative',
        height: TRACK_HEIGHT,
        width: timelineWidth,
        background: isSelected ? 'rgba(0,245,255,0.04)' : 'rgba(255,255,255,0.02)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer',
      }}
      onClick={() => selectModel(model.id)}
    >
      {/* Track bar */}
      <div style={{
        position: 'absolute', top: '45%', left: 0, right: 0,
        height: 2, background: 'rgba(255,255,255,0.08)'
      }} />

      {modelKeyframes.map(f => (
        <KeyframeDot
          key={f} frame={f} modelId={model.id}
          modelColor={color} timelineWidth={timelineWidth}
          totalFrames={totalFrames}
        />
      ))}
    </div>
  )
}

export default function Timeline() {
  const {
    currentFrame, setCurrentFrame, totalFrames, fps,
    isPlaying, setIsPlaying,
    models, selectedModelId, addKeyframe,
    showTimeline, setShowTimeline,
    keyframes
  } = useStore()

  const timelineRef = useRef()
  const [timelineWidth, setTimelineWidth] = useState(600)
  const containerRef = useRef()

  // Observe container width
  const measuredRef = useCallback(node => {
    if (!node) return
    const ro = new ResizeObserver(entries => {
      setTimelineWidth(entries[0].contentRect.width)
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  const scrub = (e) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
    const frame = Math.round((x / timelineWidth) * totalFrames)
    setCurrentFrame(Math.max(0, Math.min(frame, totalFrames - 1)))
  }

  const handleTimelinePointerDown = (e) => {
    scrub(e)
    const move = (me) => scrub(me)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const allKeyframeFrames = Object.keys(keyframes).map(Number)
  const playheadX = (currentFrame / totalFrames) * timelineWidth

  if (!showTimeline) {
    return (
      <button
        onClick={() => setShowTimeline(true)}
        style={{
          position: 'absolute', bottom: 4, left: '50%',
          transform: 'translateX(-50%)',
          background: '#1a1a2e', border: '1px solid #333',
          color: '#00f5ff', padding: '4px 16px',
          borderRadius: 8, cursor: 'pointer', fontSize: 11,
          fontFamily: 'Space Mono, monospace'
        }}
      >
        SHOW TIMELINE
      </button>
    )
  }

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(8,8,20,0.97)',
      borderTop: '1px solid rgba(0,245,255,0.2)',
      zIndex: 100,
      userSelect: 'none',
    }}>
      {/* Timeline header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,20,0.5)',
      }}>
        {/* Transport */}
        <button onClick={() => setCurrentFrame(0)} style={btnStyle} title="Go to start">⏮</button>
        <button
          onClick={() => setCurrentFrame(Math.max(0, currentFrame - 1))}
          style={btnStyle} title="Previous frame"
        >◀</button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          style={{ ...btnStyle, background: isPlaying ? '#ff4060' : '#00f5ff', color: '#000', minWidth: 40 }}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button
          onClick={() => setCurrentFrame(Math.min(totalFrames - 1, currentFrame + 1))}
          style={btnStyle} title="Next frame"
        >▶</button>
        <button onClick={() => setCurrentFrame(totalFrames - 1)} style={btnStyle} title="Go to end">⏭</button>

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }} />

        {/* Frame counter */}
        <span style={{ color: '#00f5ff', fontSize: 12, fontFamily: 'Space Mono', minWidth: 80 }}>
          {String(currentFrame).padStart(4, '0')} / {totalFrames}
        </span>

        <span style={{ color: '#666', fontSize: 11 }}>{fps}fps</span>

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }} />

        {/* Add keyframe button */}
        {selectedModelId && (
          <button
            onClick={() => addKeyframe(currentFrame, selectedModelId)}
            style={{
              ...btnStyle,
              background: 'rgba(255,170,0,0.15)',
              borderColor: '#ffaa00',
              color: '#ffaa00',
            }}
            title="Add keyframe for selected model at current frame"
          >
            ◆ ADD KF
          </button>
        )}

        <div style={{ flex: 1 }} />
        <button onClick={() => setShowTimeline(false)} style={btnStyle} title="Hide timeline">✕</button>
      </div>

      {/* Track labels + scrubber area */}
      <div style={{ display: 'flex', maxHeight: 120, overflow: 'hidden' }}>
        {/* Track labels */}
        <div style={{ width: 100, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{
            height: 20, borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '2px 6px', fontSize: 10, color: '#444',
          }}>TRACKS</div>
          {models.map((m, i) => {
            const colors = ['#00f5ff', '#ff4080', '#40ff80', '#ffaa00', '#aa40ff', '#ff8040']
            const c = colors[i % colors.length]
            return (
              <div key={m.id} style={{
                height: TRACK_HEIGHT, display: 'flex', alignItems: 'center',
                padding: '0 8px', fontSize: 10, color: c,
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                overflow: 'hidden', whiteSpace: 'nowrap',
              }}>
                <span style={{ marginRight: 4 }}>●</span>
                {m.name.substring(0, 8)}
              </div>
            )
          })}
        </div>

        {/* Scrollable timeline */}
        <div style={{ flex: 1, overflow: 'auto hidden' }}>
          {/* Frame ruler */}
          <div
            ref={el => { measuredRef(el); containerRef.current = el }}
            style={{ position: 'relative', height: 20, borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: 'crosshair' }}
            onPointerDown={handleTimelinePointerDown}
          >
            {Array.from({ length: Math.ceil(totalFrames / 10) }, (_, i) => {
              const f = i * 10
              const x = (f / totalFrames) * timelineWidth
              return (
                <div key={f} style={{
                  position: 'absolute', left: x,
                  top: 0, bottom: 0,
                  borderLeft: '1px solid rgba(255,255,255,0.1)',
                  paddingLeft: 2,
                }}>
                  <span style={{ fontSize: 8, color: '#444', lineHeight: '20px' }}>{f}</span>
                </div>
              )
            })}

            {/* Playhead on ruler */}
            <div style={{
              position: 'absolute', left: playheadX, top: 0, bottom: 0,
              width: 2, background: '#00f5ff',
              boxShadow: '0 0 8px #00f5ff',
              pointerEvents: 'none', zIndex: 20,
            }} />
          </div>

          {/* Tracks */}
          <div
            style={{ position: 'relative' }}
            ref={timelineRef}
          >
            {models.map(m => (
              <TimelineTrack key={m.id} model={m} timelineWidth={timelineWidth} />
            ))}

            {/* Playhead line across tracks */}
            <div style={{
              position: 'absolute', left: playheadX, top: 0, bottom: 0,
              width: 2, background: 'rgba(0,245,255,0.5)',
              pointerEvents: 'none', zIndex: 20,
            }} />
          </div>
        </div>
      </div>
    </div>
  )
}

const btnStyle = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#ccc',
  borderRadius: 4,
  padding: '3px 8px',
  cursor: 'pointer',
  fontSize: 12,
  fontFamily: 'Space Mono, monospace',
}
