import { useRef, useState, Suspense } from 'react'
import Scene from './components/Scene'
import Toolbar from './components/Toolbar'
import Timeline from './components/Timeline'
import ModelsPanel from './components/ModelsPanel'
import PropertiesPanel from './components/PropertiesPanel'
import ExportPanel from './components/ExportPanel'
import useStore from './store/useStore'

const PANEL_TABS = [
  { id: 'models', label: 'MODELS', icon: '◈' },
  { id: 'properties', label: 'PROPS', icon: '⚙' },
  { id: 'export', label: 'EXPORT', icon: '▶' },
]

function SidePanel({ canvasRef }) {
  const { activePanel, setActivePanel } = useStore()

  return (
    <div style={{
      width: 200,
      flexShrink: 0,
      background: 'rgba(8,8,20,0.97)',
      borderLeft: '1px solid rgba(0,245,255,0.1)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 150,
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(0,0,10,0.5)',
      }}>
        {PANEL_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActivePanel(tab.id)}
            style={{
              flex: 1, padding: '8px 4px',
              background: activePanel === tab.id ? 'rgba(0,245,255,0.08)' : 'transparent',
              border: 'none',
              borderBottom: `2px solid ${activePanel === tab.id ? '#00f5ff' : 'transparent'}`,
              color: activePanel === tab.id ? '#00f5ff' : '#444',
              cursor: 'pointer', fontSize: 10,
              fontFamily: 'Space Mono, monospace',
              letterSpacing: '0.05em',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 2,
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 14 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activePanel === 'models' && <ModelsPanel />}
        {activePanel === 'properties' && <PropertiesPanel />}
        {activePanel === 'export' && <ExportPanel canvasRef={canvasRef} />}
      </div>
    </div>
  )
}

function MobileBottomBar() {
  const { activePanel, setActivePanel } = useStore()

  return (
    <div style={{
      display: 'flex',
      borderTop: '1px solid rgba(0,245,255,0.1)',
      background: 'rgba(8,8,20,0.97)',
      zIndex: 200,
    }}>
      {PANEL_TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActivePanel(activePanel === tab.id ? null : tab.id)}
          style={{
            flex: 1, padding: '8px 4px',
            background: activePanel === tab.id ? 'rgba(0,245,255,0.08)' : 'transparent',
            border: 'none',
            borderTop: `2px solid ${activePanel === tab.id ? '#00f5ff' : 'transparent'}`,
            color: activePanel === tab.id ? '#00f5ff' : '#555',
            cursor: 'pointer', fontSize: 9,
            fontFamily: 'Space Mono, monospace',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 2,
          }}
        >
          <span style={{ fontSize: 18 }}>{tab.icon}</span>
          <span>{tab.label}</span>
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
      position: 'absolute',
      bottom: 48, left: 0, right: 0,
      height: 280,
      background: 'rgba(8,8,20,0.97)',
      borderTop: '1px solid rgba(0,245,255,0.15)',
      zIndex: 180,
      overflow: 'auto',
    }}>
      {activePanel === 'models' && <ModelsPanel />}
      {activePanel === 'properties' && <PropertiesPanel />}
      {activePanel === 'export' && <ExportPanel canvasRef={canvasRef} />}
    </div>
  )
}

export default function App() {
  const canvasRef = useRef()
  const showTimeline = useStore(s => s.showTimeline)

  // Detect mobile
  const isMobile = window.innerWidth < 640

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column',
      background: '#080810',
      fontFamily: 'Space Mono, monospace',
      overflow: 'hidden',
    }}>
      {/* Top toolbar */}
      <Toolbar />

      {/* Main area */}
      <div style={{
        flex: 1,
        display: 'flex',
        position: 'relative',
        marginTop: 42, // toolbar height
        marginBottom: showTimeline ? 150 : 30, // timeline height
      }}>
        {/* 3D Scene */}
        <div ref={canvasRef} style={{ flex: 1, position: 'relative' }}>
          <Suspense fallback={
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#00f5ff', fontFamily: 'Orbitron',
              fontSize: 14, letterSpacing: '0.2em',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8, animation: 'spin 2s linear infinite' }}>◈</div>
                LOADING SCENE...
              </div>
            </div>
          }>
            <Scene canvasRef={canvasRef} />
          </Suspense>

          {/* Mobile drawer overlay */}
          {isMobile && <MobileDrawer canvasRef={canvasRef} />}
        </div>

        {/* Desktop side panel */}
        {!isMobile && <SidePanel canvasRef={canvasRef} />}
      </div>

      {/* Timeline */}
      <div style={{ position: 'absolute', bottom: isMobile ? 48 : 0, left: 0, right: isMobile ? 0 : 200 }}>
        <Timeline />
      </div>

      {/* Mobile bottom bar */}
      {isMobile && (
        <div style={{ position: 'relative', zIndex: 200 }}>
          <MobileBottomBar />
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { -webkit-tap-highlight-color: transparent; }
        input[type=range] {
          accent-color: #00f5ff;
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background: rgba(0,245,255,0.2); border-radius: 2px; }
      `}</style>
    </div>
  )
}
