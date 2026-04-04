/**
 * ProjectPanel.jsx — Complete project share/import/export system
 *
 * Features:
 * - Import preview: shows project contents BEFORE loading
 * - Full bundle export: safely encodes large GLBs (no stack overflow)
 * - Per-model embed toggle: choose which models to embed
 * - Recent projects list from localStorage
 * - Auto-save with configurable interval
 * - Share link with URL param parsing on startup
 * - File size estimation before export
 * - Import validation with error details
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import useStore from '../store/useStore'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtBytes(b) {
  if (!b || b === 0) return '0 B'
  if (b < 1024)       return `${b} B`
  if (b < 1024**2)    return `${(b/1024).toFixed(1)} KB`
  return `${(b/1024/1024).toFixed(2)} MB`
}

function fmtDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle:'short', timeStyle:'short' })
  } catch { return iso }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Divider({ label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, margin:'4px 0' }}>
      <div style={{ flex:1, height:1, background:'var(--border)' }}/>
      {label && <span style={{ fontSize:9, color:'var(--text3)', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}>{label}</span>}
      <div style={{ flex:1, height:1, background:'var(--border)' }}/>
    </div>
  )
}

function Chip({ color='var(--accent)', children }) {
  return (
    <span style={{ fontSize:9, padding:'2px 7px', borderRadius:10, whiteSpace:'nowrap',
      background:`${color}18`, color, border:`1px solid ${color}33`, fontWeight:700 }}>
      {children}
    </span>
  )
}

function StatusBox({ status }) {
  if (!status) return null
  const cfg = {
    ok:   { bg:'rgba(6,214,160,0.08)', border:'rgba(6,214,160,0.25)', color:'var(--accent3)', icon:'✅' },
    err:  { bg:'rgba(239,68,68,0.08)',  border:'rgba(239,68,68,0.25)',  color:'var(--danger)',  icon:'❌' },
    warn: { bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.25)', color:'var(--warn)',    icon:'⚠️' },
    info: { bg:'rgba(79,142,255,0.08)', border:'rgba(79,142,255,0.25)', color:'var(--accent)',  icon:'ℹ️' },
  }[status.type] || {}
  return (
    <div style={{ padding:'9px 12px', borderRadius:'var(--radius-sm)', fontSize:11, lineHeight:1.55,
      background:cfg.bg, border:`1px solid ${cfg.border}`, color:cfg.color,
      display:'flex', alignItems:'flex-start', gap:8, animation:'fadeUp 0.15s ease' }}>
      <span style={{flexShrink:0}}>{cfg.icon}</span>
      <span>{status.msg}</span>
    </div>
  )
}

function BigBtn({ icon, label, sub, onClick, color='var(--accent)', disabled, loading, badge }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} disabled={disabled||loading}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{
        width:'100%', padding:'11px 14px', borderRadius:'var(--radius)',
        background: disabled ? 'var(--bg2)' : h ? `${color}15` : 'var(--bg2)',
        border:`1px solid ${disabled?'var(--border)':h?`${color}55`:`${color}22`}`,
        cursor: disabled||loading ? 'not-allowed' : 'pointer',
        display:'flex', alignItems:'center', gap:12, textAlign:'left',
        opacity: disabled ? 0.45 : 1, transition:'all 0.12s',
      }}>
      <span style={{ fontSize:22, lineHeight:1, flexShrink:0 }}>{loading?'⏳':icon}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:h&&!disabled?color:'var(--text0)',
          display:'flex', alignItems:'center', gap:6 }}>
          {label}
          {badge && <Chip color={color}>{badge}</Chip>}
        </div>
        {sub && <div style={{ fontSize:10, color:'var(--text3)', marginTop:2, lineHeight:1.4 }}>{sub}</div>}
      </div>
    </button>
  )
}

// ── Import Preview Modal ───────────────────────────────────────────────────────
function ImportPreview({ preview, onLoad, onCancel }) {
  const dur = preview.totalFrames && preview.fps
    ? `${(preview.totalFrames/preview.fps).toFixed(1)}s`
    : '?'

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9999,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16,
      animation:'fadeUp 0.15s ease' }}>
      <div style={{ background:'var(--bg1)', border:'1px solid var(--border-hi)',
        borderRadius:'var(--radius-lg)', padding:20, maxWidth:360, width:'100%',
        boxShadow:'var(--shadow-lg)', maxHeight:'80vh', overflow:'auto' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <span style={{ fontSize:28 }}>📦</span>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--text0)' }}>
              {preview.projectName}
            </div>
            <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>
              {preview.bundleDate ? fmtDate(preview.bundleDate) : `v${preview.version}`}
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:14 }}>
          {[
            ['📦 Models',     preview.modelCount],
            ['◆ Keyframes',   preview.keyframeCount],
            ['🎥 Cameras',    preview.cameraCount],
            ['⏱ Duration',   dur],
            ['🎬 FPS',        preview.fps],
            ['💡 Lighting',   preview.lightingPreset],
          ].map(([k,v]) => (
            <div key={k} style={{ padding:'7px 10px', background:'var(--bg2)',
              borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' }}>
              <div style={{ fontSize:9, color:'var(--text3)', marginBottom:2 }}>{k}</div>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text0)' }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Model list */}
        {preview.models?.length > 0 && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:10, color:'var(--text2)', fontWeight:600,
              marginBottom:6, letterSpacing:'0.06em', textTransform:'uppercase' }}>Models</div>
            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
              {preview.models.map(m => (
                <div key={m.id} style={{ display:'flex', alignItems:'center', gap:8,
                  padding:'5px 8px', background:'var(--bg2)', borderRadius:'var(--radius-sm)',
                  border:'1px solid var(--border)' }}>
                  <span style={{ fontSize:12 }}>{m.hasBlob ? '✅' : '🔗'}</span>
                  <span style={{ fontSize:11, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text1)' }}>
                    {m.name}
                  </span>
                  <span style={{ fontSize:9, color: m.hasBlob ? 'var(--accent3)' : 'var(--text3)' }}>
                    {m.hasBlob ? 'embedded' : 'URL ref'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warning if URL-only */}
        {preview.embeddedModels < preview.modelCount && (
          <div style={{ padding:'8px 10px', borderRadius:'var(--radius-sm)',
            background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)',
            fontSize:10, color:'var(--warn)', marginBottom:12 }}>
            ⚠️ {preview.modelCount - preview.embeddedModels} model{preview.modelCount-preview.embeddedModels>1?'s':''} use URL references — internet required to load them.
          </div>
        )}

        {/* Actions */}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onCancel} style={{
            flex:1, padding:'9px 0', borderRadius:'var(--radius-sm)',
            background:'var(--bg3)', border:'1px solid var(--border)',
            color:'var(--text1)', fontSize:12, cursor:'pointer',
          }}>Cancel</button>
          <button onClick={onLoad} style={{
            flex:2, padding:'9px 0', borderRadius:'var(--radius-sm)',
            background:'var(--accent)', border:'none',
            color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer',
            boxShadow:'0 0 14px rgba(79,142,255,0.3)',
          }}>Load Project</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Panel ─────────────────────────────────────────────────────────────────
export default function ProjectPanel() {
  const {
    projectName, setProjectName,
    models, keyframes, cameras, fps, totalFrames, lightingPreset,
    saveProject, loadProject,
    exportProjectJSON, exportProjectBundle,
    previewBundle, loadBundle,
    getRecentProjects, clearRecentProjects,
  } = useStore()

  const [status,      setStatus]     = useState(null)
  const [exporting,   setExporting]  = useState(false)
  const [progress,    setProgress]   = useState({ msg:'', pct:0 })
  const [dragging,    setDragging]   = useState(false)
  const [editName,    setEditName]   = useState(false)
  const [nameVal,     setNameVal]    = useState(projectName)
  const [preview,     setPreview]    = useState(null)    // import preview
  const [skipModels,  setSkipModels] = useState(new Set()) // models to NOT embed
  const [showSkipUI,  setShowSkipUI] = useState(false)
  const [autoSave,    setAutoSave]   = useState(false)
  const [lastSaved,   setLastSaved]  = useState(null)
  const [recent,      setRecent]     = useState([])
  const [showRecent,  setShowRecent] = useState(false)
  const fileRef  = useRef()
  const autoRef  = useRef()

  const kfCount  = Object.keys(keyframes).length
  const hasModels= models.length > 0
  const duration = totalFrames && fps ? `${(totalFrames/fps).toFixed(1)}s` : '0s'

  // Load recent on mount
  useEffect(() => {
    setRecent(getRecentProjects?.() || [])
  }, [])

  // Auto-save
  useEffect(() => {
    if (autoSave) {
      autoRef.current = setInterval(() => {
        const ok = saveProject()
        if (ok) setLastSaved(new Date().toLocaleTimeString())
      }, 60_000) // every 60s
    }
    return () => clearInterval(autoRef.current)
  }, [autoSave])

  const showMsg = (type, msg, ms=5000) => {
    setStatus({ type, msg })
    if (ms > 0) setTimeout(() => setStatus(null), ms)
  }

  // ── Quick export ───────────────────────────────────────────────────────────
  const handleQuickExport = () => {
    try {
      exportProjectJSON()
      showMsg('ok', 'Exported! Models saved as URLs — recipients need internet to reload them.')
    } catch(e) { showMsg('err', `Export failed: ${e.message}`) }
  }

  // ── Bundle export ──────────────────────────────────────────────────────────
  const handleBundle = async () => {
    if (exporting || !hasModels) return
    setExporting(true)
    setProgress({ msg:'Starting…', pct:0 })
    try {
      const result = await exportProjectBundle(
        (msg, pct) => setProgress({ msg, pct }),
        { skip: [...skipModels] }
      )
      const parts = []
      if (result.embeddedCount > 0) parts.push(`${result.embeddedCount} model${result.embeddedCount>1?'s':''} embedded`)
      if (result.failedCount   > 0) parts.push(`${result.failedCount} failed to fetch`)
      const sizeStr = fmtBytes(result.size)
      showMsg('ok', `Bundle saved! ${parts.join(' · ')} · ${sizeStr}`, 8000)
      setRecent(getRecentProjects?.() || [])
    } catch(e) {
      showMsg('err', `Bundle export failed: ${e.message}`)
    } finally {
      setExporting(false)
      setProgress({ msg:'', pct:0 })
    }
  }

  // ── Save to browser ────────────────────────────────────────────────────────
  const handleSave = () => {
    const ok = saveProject()
    if (ok) { setLastSaved(new Date().toLocaleTimeString()); showMsg('ok', 'Saved to browser storage ✓') }
    else      showMsg('err', 'Browser storage save failed (storage may be full)')
  }

  // ── Load from browser ──────────────────────────────────────────────────────
  const handleLoad = () => {
    const ok = loadProject()
    if (ok) { showMsg('ok', 'Project loaded from browser storage'); setRecent(getRecentProjects?.() || []) }
    else      showMsg('warn', 'No saved project found in browser storage')
  }

  // ── Import: preview first ──────────────────────────────────────────────────
  const handleFile = useCallback(async (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['glbstudio','json'].includes(ext)) { showMsg('err','Only .glbstudio files supported'); return }
    showMsg('info', `Reading "${file.name}"…`, 0)
    const p = await previewBundle(file)
    setStatus(null)
    if (!p.ok) { showMsg('err', `Cannot read file: ${p.error}`); return }
    setPreview(p)
  }, [previewBundle])

  const handleLoadPreview = () => {
    if (!preview) return
    const result = loadBundle(preview)
    setPreview(null)
    if (result.ok) {
      setRecent(getRecentProjects?.() || [])
      showMsg('ok', `Loaded "${preview.projectName}" — ${result.modelCount} model${result.modelCount>1?'s':''}${result.embeddedCount?' (models embedded ✓)':''}`)
    } else {
      showMsg('err', 'Failed to load project')
    }
  }

  // ── Share link ────────────────────────────────────────────────────────────
  const handleShare = () => {
    const shareable = models.filter(m => m.url && !m.url.startsWith('blob:') && !m.url.startsWith('data:'))
    if (!shareable.length) { showMsg('warn','No shareable models — local uploads cannot be shared via link'); return }
    const payload = {
      n: projectName,
      u: shareable.map(m => m.url),
      m: shareable.map(m => m.name),
      f: fps, t: totalFrames, l: lightingPreset,
    }
    const base  = window.location.href.split('?')[0]
    const link  = `${base}?project=${encodeURIComponent(JSON.stringify(payload))}`
    navigator.clipboard?.writeText(link)
      .then(()  => showMsg('ok', `Share link copied! (${shareable.length} model${shareable.length>1?'s':''} included)`))
      .catch(()  => showMsg('info', link, 0))
  }

  // Estimate bundle size
  const estimatedSize = models.reduce((acc, m) => {
    if (skipModels.has(m.id)) return acc
    // rough: each KB of URL ~= the actual file is fetched; use 500KB as avg GLB estimate
    return acc + 500_000
  }, 0)

  return (
    <div style={{ padding:14, display:'flex', flexDirection:'column', gap:10, overflowY:'auto', height:'100%' }}>

      {/* Import preview modal */}
      {preview && (
        <ImportPreview
          preview={preview}
          onLoad={handleLoadPreview}
          onCancel={() => setPreview(null)}
        />
      )}

      {/* Project header */}
      <div style={{ padding:'12px 14px', borderRadius:'var(--radius)',
        background:'var(--bg2)', border:'1px solid var(--border)' }}>
        <div style={{ fontSize:9, color:'var(--text3)', fontWeight:700,
          letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6 }}>Project Name</div>
        {editName ? (
          <input value={nameVal}
            onChange={e=>setNameVal(e.target.value)}
            onBlur={()=>{ setProjectName(nameVal); setEditName(false) }}
            onKeyDown={e=>{ if(e.key==='Enter'||e.key==='Escape'){ setProjectName(nameVal); setEditName(false) }}}
            autoFocus style={{ fontSize:15, fontWeight:700, width:'100%' }}/>
        ) : (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:15, fontWeight:700, color:'var(--text0)',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {projectName}
            </span>
            <button onClick={()=>{ setNameVal(projectName); setEditName(true) }}
              style={{ background:'none', border:'none', color:'var(--text2)', cursor:'pointer', fontSize:14, padding:'2px 4px' }}>
              ✏️
            </button>
          </div>
        )}
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:8 }}>
          <Chip color="var(--accent)">{models.length} model{models.length!==1?'s':''}</Chip>
          <Chip color="var(--warn)">{kfCount} keyframe{kfCount!==1?'s':''}</Chip>
          <Chip color="var(--accent2)">{cameras.length} cam{cameras.length!==1?'s':''}</Chip>
          <Chip color="var(--accent3)">{duration} · {fps}fps</Chip>
        </div>
      </div>

      <StatusBox status={status} />

      {/* ── Auto-save ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'9px 12px', borderRadius:'var(--radius-sm)',
        background: autoSave ? 'rgba(6,214,160,0.06)' : 'var(--bg2)',
        border:`1px solid ${autoSave ? 'rgba(6,214,160,0.2)' : 'var(--border)'}`,
        transition:'all 0.2s' }}>
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--text0)' }}>Auto-save</div>
          <div style={{ fontSize:10, color:'var(--text3)' }}>
            {autoSave ? `Saves every 60s · Last: ${lastSaved||'not yet'}` : 'Saves to browser every 60 seconds'}
          </div>
        </div>
        <button onClick={()=>setAutoSave(v=>!v)} style={{
          width:40, height:22, borderRadius:11, border:'none', cursor:'pointer',
          background: autoSave ? 'var(--accent3)' : 'var(--bg4)',
          position:'relative', transition:'background 0.2s', flexShrink:0,
          boxShadow: autoSave ? '0 0 8px rgba(6,214,160,0.4)' : 'none',
        }}>
          <div style={{ position:'absolute', top:3, width:16, height:16, borderRadius:8,
            background:'#fff', transition:'left 0.2s',
            left: autoSave ? 21 : 3, boxShadow:'0 1px 3px rgba(0,0,0,0.4)' }}/>
        </button>
      </div>

      <Divider label="Save & Export" />

      {/* Browser save */}
      <BigBtn icon="💾" color="var(--accent)"
        label="Save to Browser"
        sub={lastSaved ? `Last saved: ${lastSaved}` : 'Instant — survives page refresh, same device only'}
        onClick={handleSave} />

      {/* Quick export */}
      <BigBtn icon="📄" color="var(--accent)"
        label="Quick Export  (.glbstudio)"
        sub="JSON with model URLs + keyframes/cameras/physics. Small file. Needs internet to reload."
        onClick={handleQuickExport} disabled={!hasModels} />

      {/* Bundle export */}
      <div>
        <BigBtn icon="📦" color="var(--accent2)"
          label="Export Full Bundle  (.glbstudio)"
          sub={`Embeds GLB data inside file — fully self-contained${models.length > 0 ? ` · Est. ~${fmtBytes(estimatedSize)}` : ''}`}
          onClick={handleBundle}
          disabled={!hasModels || exporting}
          loading={exporting}
          badge={skipModels.size > 0 ? `${models.length - skipModels.size}/${models.length} models` : undefined}
        />

        {/* Per-model embed toggle */}
        {hasModels && (
          <button onClick={()=>setShowSkipUI(v=>!v)} style={{
            width:'100%', marginTop:4, padding:'5px 10px',
            background:'transparent', border:'1px solid var(--border)',
            borderRadius:'var(--radius-sm)', color:'var(--text2)',
            fontSize:10, cursor:'pointer', textAlign:'left', transition:'all 0.12s',
          }}>
            {showSkipUI ? '▲ Hide' : '▼ Configure'} which models to embed
          </button>
        )}

        {showSkipUI && (
          <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-sm)',
            marginTop:4, overflow:'hidden', animation:'fadeUp 0.15s ease' }}>
            {models.map(m => {
              const skip = skipModels.has(m.id)
              const isLocal = m.url?.startsWith('blob:') || m.url?.startsWith('data:')
              return (
                <div key={m.id} style={{ display:'flex', alignItems:'center', gap:8,
                  padding:'7px 10px', borderBottom:'1px solid var(--border)',
                  background: skip ? 'var(--bg2)' : 'rgba(124,58,237,0.05)' }}>
                  <input type="checkbox" checked={!skip}
                    onChange={() => setSkipModels(prev => {
                      const n = new Set(prev)
                      if (n.has(m.id)) n.delete(m.id); else n.add(m.id)
                      return n
                    })}
                    style={{ accentColor:'var(--accent2)', width:14, height:14 }}
                  />
                  <span style={{ flex:1, fontSize:11, color: skip ? 'var(--text3)' : 'var(--text1)',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</span>
                  <span style={{ fontSize:9, color:'var(--text3)', flexShrink:0 }}>
                    {isLocal ? '📁 local' : '🔗 url'}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Progress bar */}
        {exporting && (
          <div style={{ marginTop:6, padding:'10px 12px', borderRadius:'var(--radius-sm)',
            background:'var(--bg2)', border:'1px solid var(--border)', animation:'fadeUp 0.15s ease' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:11 }}>
              <span style={{ color:'var(--text2)' }}>{progress.msg}</span>
              <span style={{ color:'var(--accent2)', fontFamily:'var(--font-mono)' }}>{progress.pct}%</span>
            </div>
            <div style={{ height:5, background:'var(--bg3)', borderRadius:3 }}>
              <div style={{ height:'100%', borderRadius:3, transition:'width 0.4s',
                width:`${progress.pct}%`,
                background:'linear-gradient(90deg,var(--accent2),var(--accent))' }}/>
            </div>
          </div>
        )}
      </div>

      {/* Share link */}
      <BigBtn icon="🔗" color="var(--accent3)"
        label="Copy Share Link"
        sub="URL that reopens project with model URLs. Public models only — no local uploads."
        onClick={handleShare} disabled={!hasModels} />

      <Divider label="Import" />

      {/* Drop zone */}
      <div
        onDrop={e=>{ e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
        onDragOver={e=>{ e.preventDefault(); setDragging(true) }}
        onDragLeave={()=>setDragging(false)}
        onClick={()=>fileRef.current?.click()}
        style={{
          border:`2px dashed ${dragging?'var(--accent)':'var(--border-hi)'}`,
          borderRadius:'var(--radius)', padding:'22px 16px',
          textAlign:'center', cursor:'pointer',
          background: dragging ? 'rgba(79,142,255,0.06)' : 'var(--bg2)',
          transition:'all 0.15s',
        }}>
        <div style={{ fontSize:30, marginBottom:7, opacity: dragging?1:0.5 }}>
          {dragging ? '📂' : '📥'}
        </div>
        <div style={{ fontSize:12, fontWeight:600, color:'var(--text1)', marginBottom:3 }}>
          {dragging ? 'Drop to preview & import' : 'Drop .glbstudio here'}
        </div>
        <div style={{ fontSize:10, color:'var(--text3)' }}>
          or click to browse · Preview shown before loading
        </div>
        <input ref={fileRef} type="file" accept=".glbstudio,.json"
          style={{display:'none'}} onChange={e=>{ handleFile(e.target.files[0]); e.target.value='' }}/>
      </div>

      <BigBtn icon="📂" color="var(--warn)"
        label="Load from Browser Storage"
        sub="Loads the last project saved with 'Save to Browser'"
        onClick={handleLoad} />

      {/* Recent projects */}
      {recent.length > 0 && (
        <div>
          <button onClick={()=>setShowRecent(v=>!v)} style={{
            width:'100%', padding:'7px 10px', background:'transparent',
            border:'1px solid var(--border)', borderRadius:'var(--radius-sm)',
            color:'var(--text2)', fontSize:11, cursor:'pointer', textAlign:'left',
            display:'flex', justifyContent:'space-between', alignItems:'center',
          }}>
            <span>🕐 Recent projects ({recent.length})</span>
            <span style={{ fontSize:10 }}>{showRecent?'▲':'▼'}</span>
          </button>
          {showRecent && (
            <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-sm)',
              marginTop:4, overflow:'hidden', animation:'fadeUp 0.15s ease' }}>
              {recent.map((r,i) => (
                <div key={i} style={{ padding:'7px 10px', borderBottom:'1px solid var(--border)',
                  display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:14 }}>{r.type==='bundle'?'📦':'📄'}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:'var(--text1)',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</div>
                    <div style={{ fontSize:9, color:'var(--text3)' }}>
                      {fmtDate(r.date)} · {r.models} model{r.models!==1?'s':''}
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={()=>{ clearRecentProjects?.(); setRecent([]) }}
                style={{ width:'100%', padding:'6px', background:'transparent',
                  border:'none', color:'var(--text3)', cursor:'pointer', fontSize:10 }}>
                Clear history
              </button>
            </div>
          )}
        </div>
      )}

      {/* Format guide */}
      <div style={{ padding:'12px 14px', borderRadius:'var(--radius)',
        background:'var(--bg2)', border:'1px solid var(--border)',
        fontSize:11, color:'var(--text2)', lineHeight:1.9 }}>
        <div style={{ fontWeight:700, color:'var(--text1)', marginBottom:6 }}>📋 Format guide</div>
        {[
          ['📄 Quick Export',  'URLs only · small file · needs internet'],
          ['📦 Full Bundle',   'Models embedded · self-contained · shareable offline'],
          ['🔗 Share Link',    'URL only · no file · public models only'],
          ['💾 Browser Save',  'Instant · same device · clears with browser data'],
        ].map(([k,v])=>(
          <div key={k} style={{ display:'flex', gap:6 }}>
            <span style={{ color:'var(--text0)', fontWeight:600, flexShrink:0 }}>{k}</span>
            <span style={{ color:'var(--text3)' }}>— {v}</span>
          </div>
        ))}
      </div>

    </div>
  )
}
