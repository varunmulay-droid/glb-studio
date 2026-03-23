import { useRef, useState, Suspense } from 'react'
import Scene from './components/Scene'
import Toolbar from './components/Toolbar'
import Timeline from './components/Timeline'
import ModelsPanel from './components/ModelsPanel'
import PropertiesPanel from './components/PropertiesPanel'
import ExportPanel from './components/ExportPanel'
import AnimationPlayer from './components/AnimationPlayer'
import CameraMode from './components/CameraMode'
import SkyboxPanel from './components/SkyboxPanel'
import useStore from './store/useStore'

const PANEL_TABS = [
  { id: 'models',      label: 'MODELS',  icon: '◈'  },
  { id: 'properties',  label: 'PROPS',   icon: '⚙'  },
  { id: 'animations',  label: 'ANIMS',   icon: '🎞'  },
  { id: 'camera',      label: 'CAMERA',  icon: '🎥'  },
  { id: 'skybox',      label: 'SKYBOX',  icon: '🌐'  },
  { id: 'export',      label: 'EXPORT',  icon: '▶'  },
]

const TOOLBAR_H  = 42   // px
const TIMELINE_H = 148  // px when visible
const PANEL_W    = 210  // side panel width

// ─────────────────────────────────────────────────────────────────────────────
// Desktop side panel (collapsible)
// ─────────────────────────────────────────────────────────────────────────────
function SidePanel({ canvasRef, collapsed, onCollapse }) {
  const { activePanel, setActivePanel } = useStore()

  return (
    <div style={{
      width: collapsed ? 36 : PANEL_W,
      flexShrink: 0,
      background: 'rgba(6,6,18,0.98)',
      borderLeft: '1px solid rgba(0,245,255,0.1)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.22s ease',
      overflow: 'hidden',
      zIndex: 150,
      position: 'relative',
    }}>
      {/* Collapse toggle */}
      <button
        onClick={onCollapse}
        title={collapsed ? 'Expand panel' : 'Collapse panel'}
        style={{
          position: 'absolute', top: 6, right: collapsed ? 4 : 6,
          width: 24, height: 24, borderRadius: 4,
          background: 'rgba(0,245,255,0.08)',
          border: '1px solid rgba(0,245,255,0.15)',
          color: '#00f5ff', cursor: 'pointer', fontSize: 11,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10, flexShrink: 0,
        }}
      >{collapsed ? '◁' : '▷'}</button>

      {!collapsed && <>
        {/* Tab icons */}
        <div style={{
          display: 'flex', flexWrap: 'wrap',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(0,0,8,0.6)',
          paddingTop: 2,
        }}>
          {PANEL_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActivePanel(activePanel === tab.id ? null : tab.id)}
              title={tab.label}
              style={{
                flex: '1 1 30%', minWidth: 0,
                padding: '7px 2px 5px',
                background: activePanel === tab.id ? 'rgba(0,245,255,0.09)' : 'transparent',
                border: 'none',
                borderBottom: `2px solid ${activePanel === tab.id ? '#00f5ff' : 'transparent'}`,
                color: activePanel === tab.id ? '#00f5ff' : '#3a3a5a',
                cursor: 'pointer', fontSize: 9,
                fontFamily: 'Space Mono, monospace',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 2,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 13 }}>{tab.icon}</span>
              <span style={{ fontSize: 8, letterSpacing: '0.04em' }}>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {activePanel === 'models'     && <ModelsPanel />}
          {activePanel === 'properties' && <PropertiesPanel />}
          {activePanel === 'animations' && <AnimationPlayer />}
          {activePanel === 'camera'     && <CameraMode sceneRef={canvasRef} />}
          {activePanel === 'skybox'     && <SkyboxPanel />}
          {activePanel === 'export'     && <ExportPanel canvasRef={canvasRef} />}
        </div>
      </>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile bottom bar + slide-up drawer
// ─────────────────────────────────────────────────────────────────────────────
function MobileBar() {
  const { activePanel, setActivePanel } = useStore()
  return (
    <div style={{
      display: 'flex', overflowX: 'auto',
      borderTop: '1px solid rgba(0,245,255,0.1)',
      background: 'rgba(6,6,18,0.98)',
      zIndex: 200, flexShrink: 0,
    }}>
      {PANEL_TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActivePanel(activePanel === tab.id ? null : tab.id)}
          style={{
            flex: '0 0 auto', minWidth: 52,
            padding: '7px 6px 5px',
            background: activePanel === tab.id ? 'rgba(0,245,255,0.09)' : 'transparent',
            border: 'none',
            borderTop: `2px solid ${activePanel === tab.id ? '#00f5ff' : 'transparent'}`,
            color: activePanel === tab.id ? '#00f5ff' : '#444',
            cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}
        >
          <span style={{ fontSize: 18 }}>{tab.icon}</span>
          <span style={{ fontSize: 8, fontFamily: 'Space Mono', letterSpacing: '0.04em', color: 'inherit' }}>
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  )
}

function MobileDrawer({ canvasRef }) {
  const { activePanel } = useStore()
  if (!activePanel) return null
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: 300,
      background: 'rgba(6,6,18,0.98)',
      borderTop: '1px solid rgba(0,245,255,0.18)',
      zIndex: 180, overflow: 'auto',
    }}>
      {activePanel === 'models'     && <ModelsPanel />}
      {activePanel === 'properties' && <PropertiesPanel />}
      {activePanel === 'animations' && <AnimationPlayer />}
      {activePanel === 'camera'     && <CameraMode sceneRef={canvasRef} />}
      {activePanel === 'skybox'     && <SkyboxPanel />}
      {activePanel === 'export'     && <ExportPanel canvasRef={canvasRef} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Root App
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef    = useRef()
  const showTimeline = useStore(s => s.showTimeline)
  const [collapsed, setCollapsed] = useState(false)

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640

  const tlH     = showTimeline ? TIMELINE_H : 28
  const mobBarH = isMobile ? 46 : 0
  const panelW  = isMobile ? 0 : (collapsed ? 36 : PANEL_W)

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column',
      background: '#050508',
      fontFamily: 'Space Mono, monospace',
      overflow: 'hidden',
    }}>
      {/* ── Toolbar (fixed top) ── */}
      <div style={{ flexShrink: 0, zIndex: 300 }}>
        <Toolbar />
      </div>

      {/* ── Main row: canvas + side panel ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        // Reserve space for toolbar above and timeline+mobile bar below
        marginBottom: tlH + mobBarH,
      }}>

        {/* 3D Canvas — takes ALL remaining width */}
        <div
          ref={canvasRef}
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            // Ensure canvas fills entire height of this row
            minHeight: 0,
          }}
        >
          <Suspense fallback={
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#050508',
            }}>
              <div style={{ textAlign: 'center', color: '#00f5ff', fontFamily: 'Orbitron, monospace' }}>
                <div style={{ fontSize: 36, marginBottom: 10,
                  animation: 'spin 1.6s linear infinite' }}>◈</div>
                <div style={{ fontSize: 12, letterSpacing: '0.25em', opacity: 0.7 }}>
                  LOADING SCENE
                </div>
              </div>
            </div>
          }>
            <Scene canvasRef={canvasRef} />
          </Suspense>

          {/* Mobile slide-up drawer sits inside canvas layer */}
          {isMobile && <MobileDrawer canvasRef={canvasRef} />}
        </div>

        {/* Desktop side panel */}
        {!isMobile && (
          <SidePanel
            canvasRef={canvasRef}
            collapsed={collapsed}
            onCollapse={() => setCollapsed(c => !c)}
          />
        )}
      </div>

      {/* ── Timeline — absolute, above mobile bar ── */}
      <div style={{
        position: 'fixed',
        bottom: mobBarH,
        left: 0,
        right: panelW,
        zIndex: 200,
      }}>
        <Timeline />
      </div>

      {/* ── Mobile bottom tab bar ── */}
      {isMobile && (
        <div style={{ flexShrink: 0, zIndex: 300 }}>
          <MobileBar />
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { -webkit-tap-highlight-color: transparent; }
        input[type=range] { accent-color: #00f5ff; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background: rgba(0,245,255,0.2); border-radius: 2px; }
        canvas { display: block !important; }
      `}</style>
    </div>
  )
}
