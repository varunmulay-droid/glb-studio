import { useRef, useState, Suspense } from 'react'
import Scene          from './components/Scene'
import Toolbar        from './components/Toolbar'
import Timeline       from './components/Timeline'
import ModelsPanel    from './components/ModelsPanel'
import PropertiesPanel from './components/PropertiesPanel'
import ExportPanel    from './components/ExportPanel'
import AnimationPlayer from './components/AnimationPlayer'
import CameraMode     from './components/CameraMode'
import SkyboxPanel    from './components/SkyboxPanel'
import useStore       from './store/useStore'

const TABS = [
  { id:'models',     icon:'📦', label:'Models'    },
  { id:'properties', icon:'⚙', label:'Properties' },
  { id:'animations', icon:'🎞', label:'Animations' },
  { id:'camera',     icon:'🎥', label:'Camera'     },
  { id:'skybox',     icon:'🌐', label:'Skybox'     },
  { id:'export',     icon:'▶', label:'Export'     },
]

// ── Shared panel tab strip ─────────────────────────────────────────────────────
function TabStrip({ orientation = 'horizontal', onSelect, active }) {
  return (
    <div style={{
      display:'flex',
      flexDirection: orientation === 'vertical' ? 'column' : 'row',
      background:'var(--bg1)',
      borderBottom: orientation === 'horizontal' ? '1px solid var(--border)' : 'none',
      borderRight:  orientation === 'vertical'   ? '1px solid var(--border)' : 'none',
      overflow: orientation === 'horizontal' ? 'auto hidden' : 'visible',
    }}>
      {TABS.map(t => (
        <button key={t.id}
          onClick={() => onSelect(active === t.id ? null : t.id)}
          title={t.label}
          style={{
            flexShrink: 0,
            padding: orientation === 'vertical' ? '12px 10px' : '8px 14px',
            background: active===t.id ? 'var(--bg2)' : 'transparent',
            border:'none',
            borderLeft:   orientation==='vertical'   && active===t.id ? '2px solid var(--accent)' : orientation==='vertical'   ? '2px solid transparent' : 'none',
            borderBottom: orientation==='horizontal' && active===t.id ? '2px solid var(--accent)' : orientation==='horizontal' ? '2px solid transparent' : 'none',
            color: active===t.id ? 'var(--text0)' : 'var(--text2)',
            cursor:'pointer', fontSize: orientation==='vertical' ? 18 : 12,
            display:'flex', flexDirection: orientation==='vertical' ? 'column' : 'row',
            alignItems:'center', gap: orientation==='vertical' ? 4 : 6,
            transition:'all 0.12s',
            minWidth: orientation==='horizontal' ? 80 : 48,
          }}
        >
          <span style={{ fontSize: orientation==='vertical' ? 16 : 14 }}>{t.icon}</span>
          <span style={{ fontSize:10, fontWeight: active===t.id ? 600 : 400,
            letterSpacing:'0.04em', whiteSpace:'nowrap',
            display: orientation==='vertical' ? 'block' : 'none',
          }}>{t.label}</span>
        </button>
      ))}
    </div>
  )
}

function PanelContent({ id, canvasRef }) {
  return (
    <div style={{ flex:1, overflow:'auto', minHeight:0 }}>
      {id==='models'     && <ModelsPanel />}
      {id==='properties' && <PropertiesPanel />}
      {id==='animations' && <AnimationPlayer />}
      {id==='camera'     && <CameraMode sceneRef={canvasRef} />}
      {id==='skybox'     && <SkyboxPanel />}
      {id==='export'     && <ExportPanel canvasRef={canvasRef} />}
    </div>
  )
}

// ── Desktop layout: icon sidebar + slide-out panel ────────────────────────────
function DesktopLayout({ canvasRef }) {
  const { activePanel, setActivePanel } = useStore()
  const PANEL_W = 260

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
      {/* 3D Canvas */}
      <div ref={canvasRef} style={{ flex:1, position:'relative', overflow:'hidden', minWidth:0 }}>
        <Suspense fallback={<Loading />}>
          <Scene canvasRef={canvasRef} />
        </Suspense>
      </div>

      {/* Vertical icon rail + slide panel */}
      <div style={{ display:'flex', flexShrink:0, zIndex:150 }}>
        {/* Slide-out panel */}
        <div style={{
          width: activePanel ? PANEL_W : 0,
          overflow:'hidden',
          background:'var(--bg1)',
          borderLeft:'1px solid var(--border)',
          display:'flex', flexDirection:'column',
          transition:'width 0.2s ease',
        }}>
          {activePanel && (
            <div style={{ width:PANEL_W, display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
              {/* Panel header */}
              <div style={{
                padding:'10px 14px', borderBottom:'1px solid var(--border)',
                display:'flex', alignItems:'center', justifyContent:'space-between',
                flexShrink:0,
              }}>
                <span style={{ fontSize:12, fontWeight:700, color:'var(--text0)', letterSpacing:'0.04em' }}>
                  {TABS.find(t=>t.id===activePanel)?.icon}&nbsp;
                  {TABS.find(t=>t.id===activePanel)?.label}
                </span>
                <button onClick={() => setActivePanel(null)}
                  style={{ background:'none', border:'none', color:'var(--text2)', cursor:'pointer',
                    fontSize:16, lineHeight:1, padding:2 }}>×</button>
              </div>
              <PanelContent id={activePanel} canvasRef={canvasRef} />
            </div>
          )}
        </div>

        {/* Icon rail */}
        <div style={{
          width:48, background:'var(--bg1)',
          borderLeft:'1px solid var(--border)',
          display:'flex', flexDirection:'column',
          alignItems:'center', paddingTop:8, gap:2,
        }}>
          {TABS.map(t => (
            <button key={t.id}
              onClick={() => setActivePanel(activePanel===t.id ? null : t.id)}
              title={t.label}
              style={{
                width:36, height:36, borderRadius:'var(--radius-sm)',
                background: activePanel===t.id ? 'rgba(79,142,255,0.15)' : 'transparent',
                border:`1px solid ${activePanel===t.id ? 'rgba(79,142,255,0.3)' : 'transparent'}`,
                color: activePanel===t.id ? 'var(--accent)' : 'var(--text2)',
                cursor:'pointer', fontSize:16, transition:'all 0.12s',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}
              onMouseEnter={e => { if(activePanel!==t.id){ e.currentTarget.style.background='var(--bg3)'; e.currentTarget.style.color='var(--text0)' }}}
              onMouseLeave={e => { if(activePanel!==t.id){ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text2)' }}}
            >{t.icon}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Mobile layout ─────────────────────────────────────────────────────────────
function MobileLayout({ canvasRef }) {
  const { activePanel, setActivePanel } = useStore()

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      {/* Canvas */}
      <div ref={canvasRef} style={{ flex:1, position:'relative', overflow:'hidden', minHeight:0 }}>
        <Suspense fallback={<Loading />}>
          <Scene canvasRef={canvasRef} />
        </Suspense>

        {/* Slide-up drawer */}
        {activePanel && (
          <div style={{
            position:'absolute', bottom:0, left:0, right:0,
            height:'55%', background:'var(--bg1)',
            borderTop:'1px solid var(--border)',
            display:'flex', flexDirection:'column',
            zIndex:180, animation:'fadeUp 0.18s ease',
          }}>
            {/* Drawer handle */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'8px 14px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
              <span style={{ fontSize:12, fontWeight:700, color:'var(--text0)' }}>
                {TABS.find(t=>t.id===activePanel)?.icon}&nbsp;
                {TABS.find(t=>t.id===activePanel)?.label}
              </span>
              <button onClick={() => setActivePanel(null)}
                style={{ background:'none', border:'none', color:'var(--text2)', cursor:'pointer', fontSize:18 }}>×</button>
            </div>
            <PanelContent id={activePanel} canvasRef={canvasRef} />
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <div style={{
        display:'flex', background:'var(--bg1)',
        borderTop:'1px solid var(--border)', flexShrink:0,
        overflowX:'auto',
      }}>
        {TABS.map(t => (
          <button key={t.id}
            onClick={() => setActivePanel(activePanel===t.id ? null : t.id)}
            style={{
              flex:'0 0 auto', minWidth:52, padding:'8px 6px 6px',
              background: activePanel===t.id ? 'var(--bg2)' : 'transparent',
              border:'none',
              borderTop:`2px solid ${activePanel===t.id ? 'var(--accent)' : 'transparent'}`,
              color: activePanel===t.id ? 'var(--accent)' : 'var(--text2)',
              cursor:'pointer', display:'flex', flexDirection:'column',
              alignItems:'center', gap:2, transition:'all 0.12s',
            }}
          >
            <span style={{ fontSize:18 }}>{t.icon}</span>
            <span style={{ fontSize:9, fontWeight: activePanel===t.id ? 600 : 400 }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Loading ────────────────────────────────────────────────────────────────────
function Loading() {
  return (
    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
      background:'var(--bg0)', flexDirection:'column', gap:16 }}>
      <div style={{ width:40, height:40, border:'3px solid var(--bg4)',
        borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <span style={{ fontSize:12, color:'var(--text2)', letterSpacing:'0.1em' }}>LOADING SCENE</span>
    </div>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef    = useRef()
  const showTimeline = useStore(s => s.showTimeline)
  const [mobile]     = useState(() => window.innerWidth < 640)
  const TL_H = showTimeline ? 148 : 0

  return (
    <div style={{
      width:'100vw', height:'100vh',
      display:'flex', flexDirection:'column',
      background:'var(--bg0)', overflow:'hidden',
      fontFamily:'var(--font-ui)',
    }}>
      <Toolbar />

      {/* Main content — height minus toolbar and timeline */}
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column',
        paddingBottom: TL_H }}>
        {mobile ? <MobileLayout canvasRef={canvasRef} /> : <DesktopLayout canvasRef={canvasRef} />}
      </div>

      {/* Timeline — fixed at bottom */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:200 }}>
        <Timeline />
      </div>
    </div>
  )
}
