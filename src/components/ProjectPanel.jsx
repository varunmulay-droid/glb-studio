/**
 * ProjectPanel.jsx
 * Complete project import/export/share panel.
 *
 * EXPORT modes:
 *   1. Quick Save (.glbstudio) — JSON with model URLs, instant
 *   2. Full Bundle (.glbstudio) — embeds model blobs as base64,
 *      fully self-contained, shareable without original URLs
 *
 * IMPORT:
 *   - Drag & drop or file picker
 *   - Auto-detects v2 (URL-only) vs v3 (embedded blobs)
 *   - Converts embedded blobs back to object URLs for Three.js
 *   - Restores ALL state: models, keyframes, cameras, physics, lighting
 *
 * SHARE:
 *   - Copy share link (encodes project name + model URLs as URL params)
 *   - Download bundle for sending to others
 */
import { useState, useRef, useCallback } from 'react'
import useStore from '../store/useStore'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtBytes(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1024**2)    return `${(bytes/1024).toFixed(1)} KB`
  return `${(bytes/1024/1024).toFixed(2)} MB`
}

function Badge({ color, children }) {
  return (
    <span style={{
      fontSize:9, padding:'2px 7px', borderRadius:10,
      background:`${color}18`, color, border:`1px solid ${color}33`,
      fontWeight:700, letterSpacing:'0.04em', whiteSpace:'nowrap',
    }}>{children}</span>
  )
}

function ActionBtn({ icon, label, sublabel, onClick, color='var(--accent)', disabled, loading }) {
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick} disabled={disabled||loading}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{
        width:'100%', padding:'12px 14px',
        borderRadius:'var(--radius)',
        background: disabled ? 'var(--bg2)' : h ? `${color}18` : 'var(--bg2)',
        border:`1px solid ${disabled?'var(--border)':h?`${color}55`:`${color}22`}`,
        cursor: disabled||loading ? 'not-allowed' : 'pointer',
        transition:'all 0.15s',
        display:'flex', alignItems:'center', gap:12, textAlign:'left',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{ fontSize:22, flexShrink:0, lineHeight:1 }}>
        {loading ? '⏳' : icon}
      </span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color: disabled?'var(--text2)':h?color:'var(--text0)' }}>
          {label}
        </div>
        {sublabel && (
          <div style={{ fontSize:10, color:'var(--text3)', marginTop:2, lineHeight:1.4 }}>
            {sublabel}
          </div>
        )}
      </div>
    </button>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ProjectPanel() {
  const {
    projectName, setProjectName,
    models, keyframes, cameras,
    saveProject, loadProject,
    exportProjectJSON, exportProjectBundle,
    importProjectJSON,
    totalFrames, fps, lightingPreset,
  } = useStore()

  const [status,    setStatus]    = useState(null)  // {type:'ok'|'err'|'info', msg}
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress,  setProgress]  = useState({ msg:'', pct:0 })
  const [dragging,  setDragging]  = useState(false)
  const [editName,  setEditName]  = useState(false)
  const [nameVal,   setNameVal]   = useState(projectName)
  const [lastSaved, setLastSaved] = useState(null)
  const fileRef = useRef()

  const kfCount   = Object.keys(keyframes).length
  const hasModels = models.length > 0
  const duration  = (totalFrames / fps).toFixed(1)

  const showStatus = (type, msg, ms=4000) => {
    setStatus({ type, msg })
    if (ms) setTimeout(() => setStatus(null), ms)
  }

  // ── Export: Quick Save (URL refs only) ────────────────────────────────────
  const handleQuickExport = () => {
    try {
      exportProjectJSON()
      showStatus('ok', `Saved "${projectName}.glbstudio" — contains model URLs, not model data`)
    } catch(e) { showStatus('err', `Export failed: ${e.message}`) }
  }

  // ── Export: Full Bundle (embeds model blobs) ──────────────────────────────
  const handleBundleExport = async () => {
    if (exporting || !hasModels) return
    setExporting(true)
    setProgress({ msg:'Starting…', pct:0 })
    try {
      const result = await exportProjectBundle((msg, pct) => {
        setProgress({ msg, pct })
      })
      const size = result?.size || 0
      showStatus('ok', `Bundle saved! ${result?.models} model${result?.models>1?'s':''} embedded · ${fmtBytes(size)}`, 6000)
    } catch(e) {
      showStatus('err', `Bundle export failed: ${e.message}`)
    } finally {
      setExporting(false)
      setProgress({ msg:'', pct:0 })
    }
  }

  // ── Save to browser localStorage ──────────────────────────────────────────
  const handleLocalSave = () => {
    const ok = saveProject()
    if (ok) {
      setLastSaved(new Date().toLocaleTimeString())
      showStatus('ok', 'Saved to browser storage (survives page refresh)')
    } else {
      showStatus('err', 'Browser storage save failed')
    }
  }

  // ── Load from localStorage ─────────────────────────────────────────────────
  const handleLocalLoad = () => {
    const ok = loadProject()
    if (ok) showStatus('ok', 'Project loaded from browser storage')
    else    showStatus('err', 'No saved project found in browser storage')
  }

  // ── Import file ────────────────────────────────────────────────────────────
  const handleImport = useCallback(async (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['glbstudio','json'].includes(ext)) {
      showStatus('err', 'Only .glbstudio or .json files supported')
      return
    }
    setImporting(true)
    showStatus('info', `Loading "${file.name}"…`, 0)
    try {
      const result = await importProjectJSON(file)
      if (result?.ok) {
        const blobs = result.hasBlobs ? ' (models embedded ✓)' : ' (model URLs restored)'
        showStatus('ok', `Imported ${result.modelCount} model${result.modelCount!==1?'s':''}${blobs}`, 6000)
      } else {
        showStatus('err', `Import failed: ${result?.error || 'invalid file'}`)
      }
    } catch(e) {
      showStatus('err', `Import error: ${e.message}`)
    } finally {
      setImporting(false)
    }
  }, [importProjectJSON])

  const onFileChange = (e) => { handleImport(e.target.files[0]); e.target.value = '' }

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    handleImport(e.dataTransfer.files[0])
  }

  // ── Share link (copies URL with model list encoded) ────────────────────────
  const handleShareLink = () => {
    const urls  = models.map(m => m.url).filter(u => u && !u.startsWith('blob:'))
    const names = models.map(m => m.name)
    if (!urls.length) { showStatus('err', 'No shareable models (local files cannot be shared via link)'); return }
    const base  = window.location.href.split('?')[0]
    const param = encodeURIComponent(JSON.stringify({ n: projectName, u: urls, m: names }))
    const link  = `${base}?project=${param}`
    navigator.clipboard?.writeText(link).then(() => {
      showStatus('ok', 'Share link copied to clipboard!')
    }).catch(() => {
      showStatus('info', 'Clipboard unavailable — copy the URL from the address bar', 8000)
    })
  }

  return (
    <div style={{ padding:14, display:'flex', flexDirection:'column', gap:12, overflowY:'auto' }}>

      {/* Project name */}
      <div style={{ padding:'12px 14px', borderRadius:'var(--radius)',
        background:'var(--bg2)', border:'1px solid var(--border)' }}>
        <div style={{ fontSize:10, color:'var(--text3)', fontWeight:600,
          letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>
          Project
        </div>
        {editName ? (
          <input value={nameVal}
            onChange={e=>setNameVal(e.target.value)}
            onBlur={()=>{ setProjectName(nameVal); setEditName(false) }}
            onKeyDown={e=>{ if(e.key==='Enter'||e.key==='Escape'){ setProjectName(nameVal); setEditName(false) }}}
            autoFocus
            style={{ fontSize:16, fontWeight:700, width:'100%', padding:'4px 8px' }}
          />
        ) : (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
            <span style={{ fontSize:16, fontWeight:700, color:'var(--text0)',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {projectName}
            </span>
            <button onClick={()=>{ setNameVal(projectName); setEditName(true) }}
              style={{ background:'none', border:'none', color:'var(--text2)', cursor:'pointer',
                fontSize:12, flexShrink:0, padding:'2px 6px' }}>✏️</button>
          </div>
        )}

        {/* Stats */}
        <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
          <Badge color="var(--accent)">{models.length} model{models.length!==1?'s':''}</Badge>
          <Badge color="var(--warn)">{kfCount} keyframe{kfCount!==1?'s':''}</Badge>
          <Badge color="var(--accent2)">{cameras.length} camera{cameras.length!==1?'s':''}</Badge>
          <Badge color="var(--accent3)">{duration}s · {fps}fps</Badge>
          {lastSaved && <Badge color="var(--text2)">Saved {lastSaved}</Badge>}
        </div>
      </div>

      {/* Status message */}
      {status && (
        <div style={{
          padding:'10px 12px', borderRadius:'var(--radius-sm)',
          background: status.type==='ok'  ? 'rgba(6,214,160,0.08)' :
                      status.type==='err' ? 'rgba(239,68,68,0.08)' : 'rgba(79,142,255,0.08)',
          border:`1px solid ${status.type==='ok'?'rgba(6,214,160,0.25)':status.type==='err'?'rgba(239,68,68,0.25)':'rgba(79,142,255,0.25)'}`,
          color: status.type==='ok'?'var(--accent3)':status.type==='err'?'var(--danger)':'var(--accent)',
          fontSize:11, lineHeight:1.5, display:'flex', alignItems:'flex-start', gap:8,
        }}>
          <span style={{flexShrink:0}}>
            {status.type==='ok'?'✅':status.type==='err'?'❌':'ℹ️'}
          </span>
          {status.msg}
        </div>
      )}

      {/* ── EXPORT section ──────────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize:10, color:'var(--text3)', fontWeight:700,
          letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>
          Export
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>

          {/* Browser save */}
          <ActionBtn
            icon="💾" color="var(--accent)"
            label="Save to Browser"
            sublabel="Instant save — survives page refresh but not clearing browser data"
            onClick={handleLocalSave}
          />

          {/* Quick export */}
          <ActionBtn
            icon="📄" color="var(--accent)"
            label="Quick Export (.glbstudio)"
            sublabel="JSON file with model URLs + all keyframes, cameras, settings. Recipients need internet access to re-load models."
            onClick={handleQuickExport}
            disabled={!hasModels}
          />

          {/* Full bundle */}
          <ActionBtn
            icon="📦" color="var(--accent2)"
            label="Export Full Bundle (.glbstudio)"
            sublabel="Embeds model data (GLB bytes) inside the file — fully self-contained. File will be larger. Perfect for sharing."
            onClick={handleBundleExport}
            disabled={!hasModels || exporting}
            loading={exporting}
          />

          {/* Bundle progress */}
          {exporting && (
            <div style={{ padding:'10px 12px', borderRadius:'var(--radius-sm)',
              background:'var(--bg2)', border:'1px solid var(--border)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:11 }}>
                <span style={{ color:'var(--text2)' }}>{progress.msg}</span>
                <span style={{ color:'var(--accent)', fontFamily:'var(--font-mono)' }}>{progress.pct}%</span>
              </div>
              <div style={{ height:5, background:'var(--bg3)', borderRadius:3 }}>
                <div style={{ height:'100%', borderRadius:3, transition:'width 0.3s',
                  width:`${progress.pct}%`,
                  background:'linear-gradient(90deg,var(--accent2),var(--accent))' }}/>
              </div>
            </div>
          )}

          {/* Share link */}
          <ActionBtn
            icon="🔗" color="var(--accent3)"
            label="Copy Share Link"
            sublabel="Generates a URL that re-opens this project. Only works for models from public URLs (not local file uploads)."
            onClick={handleShareLink}
            disabled={!hasModels}
          />
        </div>
      </div>

      {/* Divider */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ flex:1, height:1, background:'var(--border)' }}/>
        <span style={{ fontSize:9, color:'var(--text3)', fontWeight:700, letterSpacing:'0.1em' }}>IMPORT</span>
        <div style={{ flex:1, height:1, background:'var(--border)' }}/>
      </div>

      {/* ── IMPORT section ──────────────────────────────────────────────── */}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>

        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={e=>{ e.preventDefault(); setDragging(true) }}
          onDragLeave={()=>setDragging(false)}
          onClick={()=>fileRef.current?.click()}
          style={{
            border:`2px dashed ${dragging?'var(--accent)':'var(--border-hi)'}`,
            borderRadius:'var(--radius)',
            padding:'24px 16px',
            textAlign:'center',
            cursor:'pointer',
            background: dragging?'rgba(79,142,255,0.06)':'var(--bg2)',
            transition:'all 0.15s',
          }}
        >
          <div style={{ fontSize:32, marginBottom:8, opacity: dragging?1:0.6 }}>
            {importing ? '⏳' : dragging ? '📂' : '📂'}
          </div>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text1)', marginBottom:4 }}>
            {importing ? 'Importing…' : dragging ? 'Drop to import' : 'Drop .glbstudio file here'}
          </div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>
            or click to browse · supports URL-ref and embedded-blob projects
          </div>
          <input ref={fileRef} type="file" accept=".glbstudio,.json"
            style={{ display:'none' }} onChange={onFileChange} />
        </div>

        {/* Load from browser */}
        <ActionBtn
          icon="📂" color="var(--warn)"
          label="Load from Browser Storage"
          sublabel="Loads the last project saved with 'Save to Browser'"
          onClick={handleLocalLoad}
        />
      </div>

      {/* Info box */}
      <div style={{ padding:'12px 14px', borderRadius:'var(--radius)',
        background:'var(--bg2)', border:'1px solid var(--border)',
        fontSize:11, color:'var(--text2)', lineHeight:1.8 }}>
        <div style={{ fontWeight:700, color:'var(--text1)', marginBottom:6 }}>
          📋 Format Guide
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {[
            ['📄 Quick Export', 'Small file, needs internet to reload models'],
            ['📦 Full Bundle',  'Large file, works offline, best for sharing'],
            ['🔗 Share Link',   'No file needed, URL only, public models only'],
            ['💾 Browser Save', 'Fastest, same device only'],
          ].map(([k,v]) => (
            <div key={k} style={{ display:'flex', gap:8 }}>
              <span style={{ color:'var(--text0)', fontWeight:600, flexShrink:0 }}>{k}</span>
              <span style={{ color:'var(--text3)' }}>— {v}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
