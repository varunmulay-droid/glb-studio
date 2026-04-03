import { useState, useEffect, useRef } from 'react'
import useStore from '../store/useStore'

function Btn({ icon, label, active, onClick, color, title, shortcut, danger }) {
  const [h, setH] = useState(false)
  const acc = color || (active ? 'var(--accent)' : null)
  return (
    <button onClick={onClick} title={`${title||label}${shortcut?' ['+shortcut+']':''}`}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{
        display:'flex', alignItems:'center', gap:5,
        padding:'4px 9px', borderRadius:'var(--radius-sm)', cursor:'pointer',
        border:`1px solid ${active?`${acc}44`:h?'var(--border-hi)':'transparent'}`,
        background: active?`${acc}18`:h?'var(--bg3)':'transparent',
        color: danger&&h?'var(--danger)':active?acc:h?'var(--text0)':'var(--text1)',
        fontSize:12, fontWeight: active?600:400,
        transition:'all 0.1s', whiteSpace:'nowrap', flexShrink:0,
      }}>
      <span style={{fontSize:14,lineHeight:1}}>{icon}</span>
      {label && <span style={{fontSize:11}}>{label}</span>}
    </button>
  )
}

function Divider() {
  return <div style={{ width:1, height:20, background:'var(--border)', margin:'0 3px', flexShrink:0 }} />
}

export default function Toolbar() {
  const {
    transformMode, setTransformMode,
    snapEnabled, setSnapEnabled,
    lightingPreset, setLightingPreset,
    isPlaying, setIsPlaying,
    loopPlayback, setLoopPlayback,
    selectedModelId, addKeyframe, currentFrame,
    currentFrame: cf, setCurrentFrame, totalFrames,
    undo, redo, undoStack, redoStack,
    showGrid, setShowGrid, showGizmo, setShowGizmo,
    showCameraObjects, setShowCameraObjects,
    projectName, setProjectName, saveProject, loadProject, exportProjectJSON,
    duplicateModel, removeModel,
    models,
  } = useStore()

  const [editName, setEditName] = useState(false)
  const [nameVal,  setNameVal]  = useState(projectName)
  const importRef = useRef()

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      // Skip if typing in an input
      if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return
      const k = e.code
      if (k==='KeyG' && !e.ctrlKey) { setTransformMode('translate'); return }
      if (k==='KeyR' && !e.ctrlKey) { setTransformMode('rotate');    return }
      if (k==='KeyS' && !e.ctrlKey) { setTransformMode('scale');     return }
      if (k==='Space') { e.preventDefault(); setIsPlaying(!useStore.getState().isPlaying); return }
      if (k==='KeyZ' && (e.ctrlKey||e.metaKey) && !e.shiftKey) { e.preventDefault(); undo(); return }
      if ((k==='KeyZ' && e.shiftKey && (e.ctrlKey||e.metaKey)) || (k==='KeyY' && (e.ctrlKey||e.metaKey))) { e.preventDefault(); redo(); return }
      if (k==='KeyD' && !e.ctrlKey) { e.preventDefault(); const sel=useStore.getState().selectedModelId; if(sel) duplicateModel(sel); return }
      if (k==='Delete'||k==='Backspace') { const sel=useStore.getState().selectedModelId; if(sel){ removeModel(sel) }; return }
      if (k==='KeyL') { setLoopPlayback(!useStore.getState().loopPlayback); return }
      if (k==='Tab')  { e.preventDefault(); setSnapEnabled(!useStore.getState().snapEnabled); return }
      // Screenshot
      if (k==='F12') { e.preventDefault(); takeScreenshot(); return }
      // Save
      if ((e.ctrlKey||e.metaKey) && k==='KeyS') { e.preventDefault(); const ok=saveProject(); console.log(ok?'Saved':'Save failed'); return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const takeScreenshot = () => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    const url  = canvas.toDataURL('image/png')
    const a    = document.createElement('a')
    a.href=url; a.download=`screenshot_${Date.now()}.png`; a.click()
  }

  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    useStore.getState().importProjectJSON(file).then(result => {
      if (!result?.ok) console.warn('Import failed:', result?.error)
    })
    e.target.value = ''
  }

  const tools = [
    { id:'translate', icon:'⊹', label:'Move',   short:'G' },
    { id:'rotate',    icon:'↻', label:'Rotate', short:'R' },
    { id:'scale',     icon:'⤡', label:'Scale',  short:'S' },
  ]

  const lights = [
    { id:'studio',   icon:'◎' },
    { id:'outdoor',  icon:'◉' },
    { id:'dramatic', icon:'◈' },
    { id:'neon',     icon:'◆' },
  ]

  const canUndo = undoStack?.length > 0
  const canRedo = redoStack?.length > 0

  return (
    <div style={{
      position:'relative', zIndex:300, flexShrink:0,
      display:'flex', alignItems:'center', gap:2,
      padding:'0 8px', height:44,
      background:'var(--bg1)', borderBottom:'1px solid var(--border)',
      overflowX:'auto', overflowY:'hidden',
    }}>
      {/* Brand / Project name */}
      <div style={{ display:'flex', alignItems:'center', gap:6, marginRight:4, flexShrink:0 }}>
        <span style={{ fontFamily:'var(--font-brand)', fontSize:14, fontWeight:800, color:'var(--accent)', letterSpacing:'-0.01em' }}>GLB</span>
        {editName ? (
          <input value={nameVal}
            onChange={e=>setNameVal(e.target.value)}
            onBlur={()=>{ setProjectName(nameVal); setEditName(false) }}
            onKeyDown={e=>{ if(e.key==='Enter'||e.key==='Escape'){ setProjectName(nameVal); setEditName(false) }}}
            autoFocus
            style={{ fontSize:12, fontWeight:600, width:120, padding:'2px 5px' }}
          />
        ) : (
          <span onDoubleClick={()=>{ setNameVal(projectName); setEditName(true) }}
            style={{ fontSize:12, fontWeight:600, color:'var(--text1)', cursor:'text',
              maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
            title="Double-click to rename"
          >{projectName}</span>
        )}
      </div>

      <Divider />

      {/* Project actions */}
      <Btn icon="💾" title="Save project" shortcut="Ctrl+S" onClick={()=>{ const ok=saveProject(); if(ok) console.log('Saved') }} />
      <Btn icon="📂" title="Load last saved" onClick={()=>loadProject()} />
      <Btn icon="⬇" title="Export .glbstudio" onClick={exportProjectJSON} />
      <Btn icon="⬆" title="Import .glbstudio" onClick={()=>importRef.current?.click()} />
      <input ref={importRef} type="file" accept=".glbstudio,.json" style={{display:'none'}} onChange={handleImport} />

      <Divider />

      {/* Undo / Redo */}
      <Btn icon="↩" title="Undo" shortcut="Ctrl+Z" onClick={undo} color={canUndo?'var(--text0)':null} />
      <Btn icon="↪" title="Redo" shortcut="Ctrl+Y" onClick={redo} color={canRedo?'var(--text0)':null} />

      <Divider />

      {/* Transform */}
      {tools.map(t => (
        <Btn key={t.id} icon={t.icon} label={t.label} shortcut={t.short}
          active={transformMode===t.id} onClick={()=>setTransformMode(t.id)} />
      ))}

      {/* Snap toggle */}
      <Btn icon="🧲" title="Grid snap" shortcut="Tab"
        active={snapEnabled} onClick={()=>setSnapEnabled(!snapEnabled)}
        color="var(--warn)" />

      <Divider />

      {/* Playback */}
      <Btn icon="⏮" title="First frame" onClick={()=>setCurrentFrame(0)} />
      <Btn icon="◀" title="Prev frame"  onClick={()=>setCurrentFrame(Math.max(0,cf-1))} />
      <button onClick={()=>setIsPlaying(!isPlaying)} title={`${isPlaying?'Pause':'Play'} [Space]`}
        style={{
          width:34,height:34,borderRadius:'var(--radius-sm)',flexShrink:0,
          background:isPlaying?'var(--danger)':'var(--accent)',border:'none',color:'#fff',
          fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
          boxShadow:isPlaying?'0 0 12px rgba(239,68,68,0.4)':'0 0 12px rgba(79,142,255,0.4)',
          transition:'all 0.15s',
        }}>{isPlaying?'⏸':'▶'}</button>
      <Btn icon="◀" title="Next frame"  onClick={()=>setCurrentFrame(Math.min(totalFrames-1,cf+1))} />
      <Btn icon="⏭" title="Last frame"  onClick={()=>setCurrentFrame(totalFrames-1)} />
      <Btn icon="🔁" title="Loop" shortcut="L" active={loopPlayback} onClick={()=>setLoopPlayback(!loopPlayback)} color="var(--accent3)" />

      {/* Frame counter */}
      <div style={{ fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text1)',
        background:'var(--bg3)',padding:'3px 8px',borderRadius:'var(--radius-sm)',
        border:'1px solid var(--border)',flexShrink:0,userSelect:'none' }}>
        <span style={{color:'var(--text0)',fontWeight:600}}>{String(cf).padStart(4,'0')}</span>
        <span style={{color:'var(--text3)'}}>/{totalFrames}</span>
      </div>

      <Divider />

      {/* Lighting */}
      {lights.map(l => (
        <button key={l.id} onClick={()=>setLightingPreset(l.id)} title={l.id}
          style={{
            padding:'3px 7px',borderRadius:'var(--radius-sm)',cursor:'pointer',fontSize:14,
            background:lightingPreset===l.id?'var(--bg4)':'transparent',
            border:`1px solid ${lightingPreset===l.id?'var(--border-hi)':'transparent'}`,
            color:lightingPreset===l.id?'var(--warn)':'var(--text2)',transition:'all 0.1s',
            flexShrink:0,
          }}>{l.icon}</button>
      ))}

      <div style={{flex:1}}/>

      {/* Selected model actions */}
      {selectedModelId && <>
        <Btn icon="⧉" title="Duplicate [D]" shortcut="D" onClick={()=>duplicateModel(selectedModelId)} />
        <Btn icon="◆" title="Add Keyframe" onClick={()=>addKeyframe(currentFrame,selectedModelId)}
          color="var(--warn)" active={!!useStore.getState().keyframes[currentFrame]?.[selectedModelId]} />
        <Btn icon="🗑" danger title="Delete model [Del]" onClick={()=>{ removeModel(selectedModelId) }} />
      </>}

      <Divider />
      {/* Scene visibility toggles */}
      <Btn icon="⊞" title="Toggle grid" active={showGrid} onClick={()=>setShowGrid(!showGrid)} />
      <Btn icon="⊕" title="Toggle orientation gizmo" active={showGizmo} onClick={()=>setShowGizmo(!showGizmo)} />
      <Btn icon="🎥" title="Toggle camera objects" active={showCameraObjects} onClick={()=>setShowCameraObjects(!showCameraObjects)} />

      {/* Screenshot */}
      <Btn icon="📷" title="Screenshot [F12]" onClick={takeScreenshot} />
    </div>
  )
}
