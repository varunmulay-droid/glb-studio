import { useRef, useState, Suspense } from 'react'
import Scene           from './components/Scene'
import Toolbar         from './components/Toolbar'
import Timeline        from './components/Timeline'
import ModelsPanel     from './components/ModelsPanel'
import PropertiesPanel from './components/PropertiesPanel'
import ExportPanel     from './components/ExportPanel'
import AnimationPlayer from './components/AnimationPlayer'
import CameraMode      from './components/CameraMode'
import SkyboxPanel     from './components/SkyboxPanel'
import PhysicsPanel    from './components/PhysicsPanel'
import AIController    from './components/AIController'
import ProjectPanel    from './components/ProjectPanel'
import useStore        from './store/useStore'

const TABS = [
  { id:'models',     icon:'📦', label:'Models'    },
  { id:'properties', icon:'⚙',  label:'Properties' },
  { id:'animations', icon:'🎞',  label:'Animations' },
  { id:'camera',     icon:'🎥',  label:'Camera'     },
  { id:'skybox',     icon:'🌐',  label:'Skybox'     },
  { id:'physics',    icon:'⚡',  label:'Physics'    },
  { id:'ai',         icon:'✦',   label:'AI'         },
  { id:'project',    icon:'🗂',   label:'Project'    },
  { id:'export',     icon:'▶',   label:'Export'     },
]

function PanelContent({ id, canvasRef }) {
  return (
    <div style={{ flex:1, overflow:'auto', minHeight:0,
      display: id==='ai' ? 'flex' : 'block',
      flexDirection: id==='ai' ? 'column' : undefined,
    }}>
      {id==='models'     && <ModelsPanel />}
      {id==='properties' && <PropertiesPanel />}
      {id==='animations' && <AnimationPlayer />}
      {id==='camera'     && <CameraMode sceneRef={canvasRef} />}
      {id==='skybox'     && <SkyboxPanel />}
      {id==='physics'    && <PhysicsPanel />}
      {id==='ai'         && <AIController />}
      {id==='project'    && <ProjectPanel />}
      {id==='export'     && <ExportPanel canvasRef={canvasRef} />}
    </div>
  )
}

function Loading() {
  return (
    <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',
      justifyContent:'center',background:'var(--bg0)',flexDirection:'column',gap:16 }}>
      <div style={{ width:40,height:40,border:'3px solid var(--bg4)',
        borderTopColor:'var(--accent)',borderRadius:'50%',animation:'spin 0.8s linear infinite' }}/>
      <span style={{ fontSize:12,color:'var(--text2)',letterSpacing:'0.1em' }}>LOADING SCENE</span>
    </div>
  )
}

// ── Desktop: icon rail + slide panel ─────────────────────────────────────────
function DesktopLayout({ canvasRef }) {
  const { activePanel, setActivePanel } = useStore()
  const PANEL_W = 280

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
      {/* Canvas */}
      <div ref={canvasRef} style={{ flex:1, position:'relative', overflow:'hidden', minWidth:0 }}>
        <Suspense fallback={<Loading />}>
          <Scene canvasRef={canvasRef} />
        </Suspense>
      </div>

      {/* Slide panel */}
      <div style={{
        width: activePanel ? PANEL_W : 0,
        overflow:'hidden', background:'var(--bg1)',
        borderLeft:'1px solid var(--border)',
        display:'flex', flexDirection:'column',
        transition:'width 0.2s ease', flexShrink:0,
      }}>
        {activePanel && (
          <div style={{ width:PANEL_W, height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)',
              display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <span style={{ fontSize:16 }}>{TABS.find(t=>t.id===activePanel)?.icon}</span>
                <span style={{ fontSize:13, fontWeight:700, color:'var(--text0)' }}>
                  {TABS.find(t=>t.id===activePanel)?.label}
                </span>
              </div>
              <button onClick={() => setActivePanel(null)}
                style={{ background:'none',border:'none',color:'var(--text2)',cursor:'pointer',
                  fontSize:18,lineHeight:1,padding:2,transition:'color 0.12s' }}
                onMouseEnter={e=>e.currentTarget.style.color='var(--text0)'}
                onMouseLeave={e=>e.currentTarget.style.color='var(--text2)'}
              >×</button>
            </div>
            <PanelContent id={activePanel} canvasRef={canvasRef} />
          </div>
        )}
      </div>

      {/* Icon rail */}
      <div style={{ width:48, background:'var(--bg1)',
        borderLeft:'1px solid var(--border)',
        display:'flex', flexDirection:'column',
        alignItems:'center', padding:'8px 0', gap:2, flexShrink:0 }}>
        {TABS.map(t => {
          const isAI = t.id === 'ai'
          return (
            <button key={t.id}
              onClick={() => setActivePanel(activePanel===t.id ? null : t.id)}
              title={t.label}
              style={{
                width:36, height:36, borderRadius:'var(--radius-sm)',
                background: activePanel===t.id
                  ? isAI ? 'rgba(139,92,246,0.2)' : 'rgba(79,142,255,0.15)'
                  : 'transparent',
                border:`1px solid ${activePanel===t.id
                  ? isAI ? 'rgba(139,92,246,0.4)' : 'rgba(79,142,255,0.3)'
                  : 'transparent'}`,
                color: activePanel===t.id
                  ? isAI ? '#8b5cf6' : 'var(--accent)'
                  : 'var(--text2)',
                cursor:'pointer', fontSize:16, transition:'all 0.12s',
                display:'flex', alignItems:'center', justifyContent:'center',
                position:'relative',
                boxShadow: activePanel===t.id && isAI ? '0 0 12px rgba(139,92,246,0.3)' : 'none',
              }}
              onMouseEnter={e => { if(activePanel!==t.id){e.currentTarget.style.background='var(--bg3)';e.currentTarget.style.color='var(--text0)'}}}
              onMouseLeave={e => { if(activePanel!==t.id){e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text2)'}}}
            >
              {t.icon}
              {isAI && (
                <div style={{ position:'absolute',top:3,right:3,width:5,height:5,
                  borderRadius:'50%',background:'#8b5cf6',
                  animation:'pulse 2s ease infinite',
                }}/>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Mobile ────────────────────────────────────────────────────────────────────
function MobileLayout({ canvasRef }) {
  const { activePanel, setActivePanel } = useStore()
  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <div ref={canvasRef} style={{ flex:1, position:'relative', overflow:'hidden', minHeight:0 }}>
        <Suspense fallback={<Loading />}>
          <Scene canvasRef={canvasRef} />
        </Suspense>
        {activePanel && (
          <div style={{ position:'absolute', bottom:0, left:0, right:0,
            height:'58%', background:'var(--bg1)',
            borderTop:'1px solid var(--border)',
            display:'flex', flexDirection:'column',
            zIndex:180, animation:'fadeUp 0.18s ease' }}>
            <div style={{ padding:'8px 14px', borderBottom:'1px solid var(--border)',
              display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--text0)' }}>
                {TABS.find(t=>t.id===activePanel)?.icon}&nbsp;
                {TABS.find(t=>t.id===activePanel)?.label}
              </span>
              <button onClick={() => setActivePanel(null)}
                style={{ background:'none',border:'none',color:'var(--text2)',cursor:'pointer',fontSize:20 }}>×</button>
            </div>
            <PanelContent id={activePanel} canvasRef={canvasRef} />
          </div>
        )}
      </div>
      <div style={{ display:'flex', background:'var(--bg1)',
        borderTop:'1px solid var(--border)', flexShrink:0, overflowX:'auto' }}>
        {TABS.map(t => (
          <button key={t.id}
            onClick={() => setActivePanel(activePanel===t.id ? null : t.id)}
            style={{
              flex:'0 0 auto', minWidth:50, padding:'7px 4px 5px',
              background: activePanel===t.id ? 'var(--bg2)' : 'transparent',
              border:'none',
              borderTop:`2px solid ${activePanel===t.id ? (t.id==='ai'?'#8b5cf6':'var(--accent)') : 'transparent'}`,
              color: activePanel===t.id ? (t.id==='ai'?'#8b5cf6':'var(--accent)') : 'var(--text2)',
              cursor:'pointer', display:'flex', flexDirection:'column',
              alignItems:'center', gap:2, transition:'all 0.12s',
            }}
          >
            <span style={{ fontSize:17 }}>{t.icon}</span>
            <span style={{ fontSize:8, fontWeight: activePanel===t.id ? 700 : 400 }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef    = useRef()
  const showTimeline = useStore(s => s.showTimeline)
  const [mobile]     = useState(() => window.innerWidth < 640)

  return (
    <div style={{ width:'100vw', height:'100vh',
      display:'flex', flexDirection:'column',
      background:'var(--bg0)', overflow:'hidden',
      fontFamily:'var(--font-ui)', fontSize:13 }}>
      <Toolbar />
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column',
        paddingBottom: showTimeline ? 148 : 0 }}>
        {mobile ? <MobileLayout canvasRef={canvasRef} /> : <DesktopLayout canvasRef={canvasRef} />}
      </div>
      <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:200 }}>
        <Timeline />
      </div>
    </div>
  )
}
