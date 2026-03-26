import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }
  componentDidCatch(error, info) {
    this.setState({ error, info })
    console.error('[GLB Studio Error]', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: 'fixed', inset: 0,
          background: '#0c0c10',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 24, fontFamily: 'monospace',
          color: '#ef4444', gap: 16, zIndex: 9999,
        }}>
          <div style={{ fontSize: 36 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
            GLB Studio crashed
          </div>
          <div style={{
            background: '#1a0808', border: '1px solid #ef444433',
            borderRadius: 8, padding: 14, maxWidth: 360, width: '100%',
            fontSize: 11, lineHeight: 1.6, wordBreak: 'break-word',
          }}>
            {String(this.state.error)}
          </div>
          <button
            onClick={() => { this.setState({ error: null, info: null }); window.location.reload() }}
            style={{
              padding: '10px 24px', borderRadius: 8,
              background: '#3b82f6', border: 'none',
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >↺ Reload App</button>
        </div>
      )
    }
    return this.props.children
  }
}
