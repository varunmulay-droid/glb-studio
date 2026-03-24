/**
 * AIController.jsx
 * OpenRouter LLM (stepfun/step-3.5-flash:free) with full scene access.
 * The AI can read and control every aspect of the 3D scene:
 * - Add/remove models, change transforms
 * - Create and modify keyframes / animations
 * - Toggle physics, change gravity, apply forces
 * - Change lighting and skybox
 * - Generate multi-step animation sequences
 */
import { useState, useRef, useEffect } from 'react'
import useStore from '../store/useStore'
import { applyImpulse, setBodyVelocity } from './PhysicsEngine'

const MODEL = 'stepfun/step-3.5-flash:free'
const BASE_URL = 'https://openrouter.ai/api/v1'

// ── Build scene context for the AI ────────────────────────────────────────────
function buildSceneContext() {
  const s = useStore.getState()
  return {
    models: s.models.map(m => ({
      id: m.id, name: m.name,
      position: m.position, rotation: m.rotation, scale: m.scale,
      visible: m.visible,
      animations: m.animations,
      activeAnimation: m.activeAnimation,
      animationSpeed: m.animationSpeed,
    })),
    selectedModelId: s.selectedModelId,
    currentFrame: s.currentFrame,
    totalFrames: s.totalFrames,
    fps: s.fps,
    isPlaying: s.isPlaying,
    lightingPreset: s.lightingPreset,
    physicsEnabled: s.physicsEnabled,
    gravity: s.gravity,
    keyframeCount: Object.keys(s.keyframes).length,
    keyframes: Object.entries(s.keyframes).slice(0, 20).map(([f, kf]) => ({
      frame: parseInt(f),
      models: Object.keys(kf),
    })),
  }
}

// ── AI function definitions (what the AI can call) ────────────────────────────
const AI_FUNCTIONS = `
You are an AI controller for a 3D animation studio. You have FULL control over the scene.
When the user asks you to do something, respond with a JSON action block AND a friendly explanation.

ALWAYS respond with this structure:
{
  "message": "Your friendly explanation of what you're doing",
  "actions": [
    // Array of action objects — execute ALL of them
  ]
}

AVAILABLE ACTIONS:

1. Add keyframe:
{"type":"add_keyframe","modelId":"<id>","frame":<number>,"position":[x,y,z],"rotation":[rx,ry,rz],"scale":[sx,sy,sz]}

2. Move model now:
{"type":"set_transform","modelId":"<id>","position":[x,y,z],"rotation":[rx,ry,rz],"scale":[sx,sy,sz]}

3. Play/stop animation:
{"type":"set_playing","value":true|false}

4. Set current frame:
{"type":"set_frame","frame":<number>}

5. Change animation clip:
{"type":"set_animation","modelId":"<id>","animation":"<name>","speed":<number>}

6. Toggle physics:
{"type":"set_physics","enabled":true|false,"gravity":<number>}

7. Apply impulse (requires physics enabled):
{"type":"apply_impulse","modelId":"<id>","impulse":{"x":<n>,"y":<n>,"z":<n>}}

8. Change lighting:
{"type":"set_lighting","preset":"studio"|"outdoor"|"dramatic"|"neon"}

9. Add model from URL:
{"type":"add_model","url":"<url>","name":"<name>"}

10. Remove model:
{"type":"remove_model","modelId":"<id>"}

11. Create animation sequence (auto-creates multiple keyframes):
{"type":"animate_sequence","modelId":"<id>","keyframes":[
  {"frame":0,"position":[x,y,z],"rotation":[rx,ry,rz],"scale":[sx,sy,sz]},
  {"frame":30,"position":[x,y,z],"rotation":[rx,ry,rz],"scale":[sx,sy,sz]}
]}

12. Select model:
{"type":"select_model","modelId":"<id>"}

SCENE SAMPLE MODELS you can add (use add_model):
- Fox: https://threejs.org/examples/models/gltf/Fox/glTF/Fox.gltf
- Robot: https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb
- Soldier: https://threejs.org/examples/models/gltf/Soldier.glb
- Flamingo: https://threejs.org/examples/models/gltf/Flamingo.glb

TIPS for animations:
- 1 unit = roughly 1 meter in the scene
- Frame 0 = start, use totalFrames for end
- For "moving straight" car animation: animate x position over frames 0→totalFrames
- Rotation values are in radians (π ≈ 3.14159)
- For realistic car movement: keep y stable (ground level), animate x or z
`

// ── Execute AI actions ─────────────────────────────────────────────────────────
async function executeActions(actions) {
  const store = useStore.getState()

  for (const action of actions) {
    await new Promise(r => setTimeout(r, 80)) // small delay between actions

    switch (action.type) {

      case 'add_keyframe':
        store.addKeyframe(action.frame, action.modelId)
        if (action.position) store.updateModelTransform(action.modelId, 'position', action.position)
        if (action.rotation) store.updateModelTransform(action.modelId, 'rotation', action.rotation)
        if (action.scale)    store.updateModelTransform(action.modelId, 'scale',    action.scale)
        store.addKeyframe(action.frame, action.modelId) // add again after transform
        break

      case 'animate_sequence':
        for (const kf of (action.keyframes || [])) {
          store.setCurrentFrame(kf.frame)
          await new Promise(r => setTimeout(r, 50))
          if (kf.position) store.updateModelTransform(action.modelId, 'position', kf.position)
          if (kf.rotation) store.updateModelTransform(action.modelId, 'rotation', kf.rotation)
          if (kf.scale)    store.updateModelTransform(action.modelId, 'scale',    kf.scale)
          store.addKeyframe(kf.frame, action.modelId)
        }
        store.setCurrentFrame(0)
        break

      case 'set_transform':
        if (action.position) store.updateModelTransform(action.modelId, 'position', action.position)
        if (action.rotation) store.updateModelTransform(action.modelId, 'rotation', action.rotation)
        if (action.scale)    store.updateModelTransform(action.modelId, 'scale',    action.scale)
        break

      case 'set_playing':
        store.setIsPlaying(action.value)
        break

      case 'set_frame':
        store.setCurrentFrame(action.frame)
        break

      case 'set_animation':
        store.setModelActiveAnimation(action.modelId, action.animation)
        if (action.speed != null) store.setModelAnimSpeed(action.modelId, action.speed)
        break

      case 'set_physics':
        store.setPhysicsEnabled(action.enabled)
        if (action.gravity != null) store.setGravity(action.gravity)
        break

      case 'apply_impulse':
        applyImpulse(action.modelId, action.impulse)
        break

      case 'set_lighting':
        store.setLightingPreset(action.preset)
        break

      case 'add_model':
        store.addModel(action.url, action.name)
        break

      case 'remove_model':
        store.removeModel(action.modelId)
        break

      case 'select_model':
        store.selectModel(action.modelId)
        break

      default:
        console.warn('Unknown AI action:', action.type)
    }
  }
}

// ── Parse AI response ──────────────────────────────────────────────────────────
function parseAIResponse(text) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (e) {}
  return { message: text, actions: [] }
}

// ── Chat message component ─────────────────────────────────────────────────────
function ChatMsg({ msg }) {
  const isUser = msg.role === 'user'
  const isSystem = msg.role === 'system'

  if (isSystem) return (
    <div style={{
      padding:'6px 10px', borderRadius:'var(--radius-sm)',
      background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.15)',
      fontSize:10, color:'var(--warn)', fontStyle:'italic',
    }}>{msg.content}</div>
  )

  return (
    <div style={{
      display:'flex', flexDirection:'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      gap:3,
    }}>
      <div style={{ fontSize:9, color:'var(--text3)', padding:'0 2px' }}>
        {isUser ? 'You' : '✦ AI'}
      </div>
      <div style={{
        maxWidth:'88%', padding:'8px 11px',
        borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        background: isUser ? 'var(--accent)' : 'var(--bg3)',
        border: isUser ? 'none' : '1px solid var(--border)',
        color: isUser ? '#fff' : 'var(--text0)',
        fontSize:12, lineHeight:1.5,
      }}>
        {msg.display || msg.content}
      </div>
      {msg.actionsCount > 0 && (
        <div style={{ fontSize:9, color:'var(--accent3)', padding:'0 2px' }}>
          ✓ {msg.actionsCount} action{msg.actionsCount>1?'s':''} applied
        </div>
      )}
    </div>
  )
}

// ── Main AI Controller component ───────────────────────────────────────────────
export default function AIController() {
  const { openrouterKey, setOpenrouterKey, aiMessages, addAiMessage, clearAiMessages, setAiThinking, aiThinking } = useStore()
  const [input,   setInput]   = useState('')
  const [apiKey,  setApiKey]  = useState(openrouterKey || '')
  const [showKey, setShowKey] = useState(!openrouterKey)
  const chatRef = useRef()
  const historyRef = useRef([]) // raw API history

  // Auto-scroll
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [aiMessages])

  const saveKey = () => {
    setOpenrouterKey(apiKey.trim())
    setShowKey(false)
  }

  const sendMessage = async () => {
    if (!input.trim() || aiThinking) return
    if (!openrouterKey) { setShowKey(true); return }

    const userMsg = input.trim()
    setInput('')

    // Add user message to chat
    addAiMessage({ role:'user', content: userMsg })

    // Build scene context
    const scene = buildSceneContext()
    const systemPrompt = AI_FUNCTIONS + `\n\nCURRENT SCENE STATE:\n${JSON.stringify(scene, null, 2)}`

    // Build API messages
    const apiMessages = [
      { role:'system', content: systemPrompt },
      ...historyRef.current,
      { role:'user', content: userMsg },
    ]

    setAiThinking(true)
    addAiMessage({ role:'system', content:'⏳ Thinking…' })

    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openrouterKey}`,
          'HTTP-Referer': window.location.href,
          'X-Title': 'GLB Studio AI',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: apiMessages,
          max_tokens: 2000,
          temperature: 0.7,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`API error ${res.status}: ${err.substring(0,200)}`)
      }

      const data = await res.json()
      const rawContent = data.choices?.[0]?.message?.content || 'No response'

      // Parse actions
      const parsed = parseAIResponse(rawContent)

      // Execute actions
      let actionsApplied = 0
      if (parsed.actions && parsed.actions.length > 0) {
        await executeActions(parsed.actions)
        actionsApplied = parsed.actions.length
      }

      // Update history (remove "Thinking" message)
      historyRef.current.push(
        { role:'user', content: userMsg },
        { role:'assistant', content: rawContent }
      )
      // Keep history manageable
      if (historyRef.current.length > 20) historyRef.current = historyRef.current.slice(-20)

      // Remove "Thinking" system message and add real response
      useStore.setState(s => ({
        aiMessages: [
          ...s.aiMessages.filter(m => m.content !== '⏳ Thinking…'),
          { role:'assistant', content: rawContent, display: parsed.message, actionsCount: actionsApplied }
        ]
      }))

    } catch (err) {
      useStore.setState(s => ({
        aiMessages: [
          ...s.aiMessages.filter(m => m.content !== '⏳ Thinking…'),
          { role:'system', content:`❌ Error: ${err.message}` }
        ]
      }))
    } finally {
      setAiThinking(false)
    }
  }

  const QUICK_PROMPTS = [
    '🚗 Make the car drive straight across the scene',
    '🌙 Switch to dramatic night lighting',
    '🎬 Add a walk animation to the soldier',
    '⚡ Enable physics with Earth gravity',
    '🔄 Make the model spin 360° over 100 frames',
    '📦 Add a Fox model to the scene',
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

      {/* API Key setup */}
      {showKey && (
        <div style={{
          padding:12, borderBottom:'1px solid var(--border)',
          background:'rgba(79,142,255,0.05)',
          animation:'fadeUp 0.2s ease',
        }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text0)', marginBottom:4 }}>
            ✦ OpenRouter API Key
          </div>
          <div style={{ fontSize:10, color:'var(--text2)', marginBottom:8, lineHeight:1.5 }}>
            Free key at{' '}
            <a href="https://openrouter.ai/keys" target="_blank"
              style={{ color:'var(--accent)', textDecoration:'none' }}>openrouter.ai/keys ↗</a>
            <br/>Using: <span style={{ fontFamily:'var(--font-mono)', color:'var(--accent3)' }}>stepfun/step-3.5-flash:free</span>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <input
              type="password" value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              onKeyDown={e => e.key==='Enter' && saveKey()}
              placeholder="sk-or-v1-…"
              style={{ flex:1 }}
            />
            <button onClick={saveKey} style={{
              padding:'5px 12px', borderRadius:'var(--radius-sm)',
              background:'var(--accent)', border:'none', color:'#fff',
              fontSize:11, fontWeight:700, cursor:'pointer', flexShrink:0,
            }}>Save</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        padding:'10px 12px 8px',
        borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        flexShrink:0,
      }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text0)', display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:16 }}>✦</span> AI Scene Controller
          </div>
          <div style={{ fontSize:10, color:'var(--text2)', marginTop:1 }}>
            {MODEL.split('/')[1]}
          </div>
        </div>
        <div style={{ display:'flex', gap:5 }}>
          <button onClick={() => setShowKey(!showKey)} style={{
            padding:'4px 8px', borderRadius:'var(--radius-sm)',
            background:'var(--bg3)', border:'1px solid var(--border)',
            color:'var(--text2)', fontSize:10, cursor:'pointer',
          }}>🔑 Key</button>
          <button onClick={() => { clearAiMessages(); historyRef.current = [] }} style={{
            padding:'4px 8px', borderRadius:'var(--radius-sm)',
            background:'var(--bg3)', border:'1px solid var(--border)',
            color:'var(--text2)', fontSize:10, cursor:'pointer',
          }}>Clear</button>
        </div>
      </div>

      {/* Quick prompts */}
      {aiMessages.length === 0 && (
        <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ fontSize:10, color:'var(--text3)', fontWeight:600, marginBottom:6,
            textTransform:'uppercase', letterSpacing:'0.08em' }}>Quick actions</div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {QUICK_PROMPTS.map(p => (
              <button key={p} onClick={() => { setInput(p.substring(2)); }} style={{
                padding:'6px 10px', borderRadius:'var(--radius-sm)', textAlign:'left',
                background:'var(--bg2)', border:'1px solid var(--border)',
                color:'var(--text1)', fontSize:11, cursor:'pointer', transition:'all 0.12s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background='var(--bg3)'; e.currentTarget.style.color='var(--text0)' }}
                onMouseLeave={e => { e.currentTarget.style.background='var(--bg2)'; e.currentTarget.style.color='var(--text1)' }}
              >{p}</button>
            ))}
          </div>
        </div>
      )}

      {/* Chat messages */}
      <div ref={chatRef} style={{
        flex:1, overflowY:'auto', padding:'12px',
        display:'flex', flexDirection:'column', gap:10,
        minHeight:0,
      }}>
        {aiMessages.map((msg, i) => <ChatMsg key={i} msg={msg} />)}

        {aiThinking && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
            background:'var(--bg3)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' }}>
            <div style={{ display:'flex', gap:4 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width:5, height:5, borderRadius:'50%', background:'var(--accent)',
                  animation:`pulse 1s ease ${i*0.2}s infinite`,
                }}/>
              ))}
            </div>
            <span style={{ fontSize:11, color:'var(--text2)' }}>AI is thinking…</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        padding:'10px 12px', borderTop:'1px solid var(--border)',
        background:'var(--bg1)', flexShrink:0,
      }}>
        <div style={{ display:'flex', gap:6, alignItems:'flex-end' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }}}
            placeholder="Describe what you want to do… (Enter to send, Shift+Enter for newline)"
            rows={2}
            style={{
              flex:1, resize:'none', borderRadius:'var(--radius-sm)',
              padding:'8px 10px', fontSize:12, lineHeight:1.5,
              fontFamily:'var(--font-ui)',
            }}
          />
          <button onClick={sendMessage} disabled={aiThinking || !input.trim()} style={{
            padding:'10px 14px', borderRadius:'var(--radius-sm)',
            background: !aiThinking && input.trim() ? 'var(--accent)' : 'var(--bg3)',
            border:`1px solid ${!aiThinking && input.trim() ? 'var(--accent)' : 'var(--border)'}`,
            color: !aiThinking && input.trim() ? '#fff' : 'var(--text3)',
            fontSize:16, cursor: aiThinking || !input.trim() ? 'not-allowed' : 'pointer',
            flexShrink:0, transition:'all 0.15s',
            boxShadow: !aiThinking && input.trim() ? '0 0 12px rgba(79,142,255,0.3)' : 'none',
          }}>↑</button>
        </div>
        <div style={{ fontSize:9, color:'var(--text3)', marginTop:5, textAlign:'center' }}>
          AI can control models, animations, physics, lighting & more
        </div>
      </div>
    </div>
  )
}
