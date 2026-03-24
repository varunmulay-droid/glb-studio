/**
 * AIController.jsx
 * OpenRouter LLM with auto-retry across multiple free models.
 * Has FULL real-time control over the 3D scene:
 * - Move/rotate/scale objects instantly OR via keyframes
 * - Physics: enable, gravity, impulses, forces
 * - Animations: switch clips, speed, play/pause
 * - Lighting, skybox, camera
 * - Create complex multi-step animation sequences
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import useStore from '../store/useStore'
import { applyImpulse, setBodyVelocity } from './PhysicsEngine'

const BASE_URL = 'https://openrouter.ai/api/v1'

// Free models with fallback chain (tried in order on 429)
const FREE_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',
  'google/gemma-3-4b-it:free',
  'mistralai/mistral-7b-instruct:free',
  'stepfun/step-3.5-flash:free',
  'qwen/qwen3-8b:free',
]

// ── Build detailed scene context ───────────────────────────────────────────────
function buildSceneContext() {
  const s = useStore.getState()
  return {
    models: s.models.map(m => ({
      id: m.id,
      name: m.name,
      position: m.position.map(v => Math.round(v * 100) / 100),
      rotation: m.rotation.map(v => Math.round(v * 100) / 100),
      scale: m.scale.map(v => Math.round(v * 100) / 100),
      visible: m.visible,
      animations: m.animations,
      activeAnimation: m.activeAnimation,
      animationSpeed: m.animationSpeed,
    })),
    selectedModelId: s.selectedModelId,
    selectedModelName: s.models.find(m => m.id === s.selectedModelId)?.name || null,
    currentFrame: s.currentFrame,
    totalFrames: s.totalFrames,
    fps: s.fps,
    isPlaying: s.isPlaying,
    lightingPreset: s.lightingPreset,
    physicsEnabled: s.physicsEnabled,
    gravity: s.gravity,
    keyframeFrames: Object.keys(s.keyframes).map(Number).sort((a,b)=>a-b),
  }
}

// ── System prompt ──────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a powerful AI controller for a 3D animation studio built with Three.js and React.
You have COMPLETE control over the 3D scene. When users ask you to do something, you EXECUTE it immediately.

ALWAYS respond with valid JSON only — no markdown, no explanation outside JSON:
{
  "message": "Brief friendly explanation of what you did",
  "actions": [ ...array of action objects... ]
}

═══════════════════════════════════════════════════
AVAILABLE ACTIONS (use as many as needed):
═══════════════════════════════════════════════════

── INSTANT TRANSFORM (moves RIGHT NOW, no animation) ──
{"type":"set_transform","modelId":"<id>","position":[x,y,z],"rotation":[rx,ry,rz],"scale":[sx,sy,sz]}
Note: rotation is in radians. 1 full turn = 6.2832. 90° = 1.5708

── CREATE KEYFRAME ANIMATION SEQUENCE ──
This creates smooth movement over time. Provide ALL keyframes needed:
{"type":"animate_sequence","modelId":"<id>","keyframes":[
  {"frame":0,"position":[x,y,z],"rotation":[rx,ry,rz],"scale":[sx,sy,sz]},
  {"frame":60,"position":[x2,y2,z2],"rotation":[rx2,ry2,rz2],"scale":[sx2,sy2,sz2]},
  {"frame":120,"position":[x3,y3,z3],"rotation":[rx3,ry3,rz3],"scale":[sx3,sy3,sz3]}
]}

── ADD SINGLE KEYFRAME ──
{"type":"add_keyframe","modelId":"<id>","frame":<n>,"position":[x,y,z],"rotation":[rx,ry,rz],"scale":[sx,sy,sz]}

── PLAYBACK ──
{"type":"set_playing","value":true}
{"type":"set_frame","frame":<n>}

── GLB ANIMATIONS ──
{"type":"set_animation","modelId":"<id>","animation":"<clipName>","speed":<0.1-3.0>}

── PHYSICS ──
{"type":"set_physics","enabled":true,"gravity":<number, e.g. -9.82>}
{"type":"apply_impulse","modelId":"<id>","impulse":{"x":<n>,"y":<n>,"z":<n>}}
{"type":"set_velocity","modelId":"<id>","velocity":{"x":<n>,"y":<n>,"z":<n>}}

── LIGHTING ──
{"type":"set_lighting","preset":"studio"|"outdoor"|"dramatic"|"neon"}

── MODEL MANAGEMENT ──
{"type":"add_model","url":"<url>","name":"<name>"}
{"type":"remove_model","modelId":"<id>"}
{"type":"select_model","modelId":"<id>"}
{"type":"set_visibility","modelId":"<id>","visible":true|false}

── MULTI-MODEL OPERATIONS ──
Apply actions to multiple models using separate action objects in the array.

═══════════════════════════════════════════════════
BUILT-IN MODELS YOU CAN ADD:
═══════════════════════════════════════════════════
Fox:     https://threejs.org/examples/models/gltf/Fox/glTF/Fox.gltf
Robot:   https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb
Soldier: https://threejs.org/examples/models/gltf/Soldier.glb
Parrot:  https://threejs.org/examples/models/gltf/Parrot.glb
Horse:   https://threejs.org/examples/models/gltf/Horse.glb

═══════════════════════════════════════════════════
COORDINATE SYSTEM & TIPS:
═══════════════════════════════════════════════════
- X axis = left/right, Y = up/down, Z = forward/backward
- Ground is at Y = 0. Models typically sit at Y = 0 to 1
- 1 unit ≈ 1 meter. Cars are ~4 units wide
- For "drive straight across": animate X position from -10 to 10 over frames 0→totalFrames
- For "spin": animate Y rotation from 0 to 6.2832 (full circle)
- For "bounce": animate Y position up then down
- For cars: keep Y constant (ground level), animate X or Z
- Physics must be enabled for impulse/velocity actions to work
- When user says "make it move" or "animate it" — use animate_sequence NOT set_transform
- Always include frame 0 in sequences to set the start position
- Match modelId EXACTLY from scene state — copy it character for character
`

// ── Execute AI actions ─────────────────────────────────────────────────────────
async function executeActions(actions, onLog) {
  const store = useStore.getState()

  for (const action of actions) {
    await new Promise(r => setTimeout(r, 60))

    try {
      switch (action.type) {

        case 'set_transform': {
          const id = action.modelId
          if (action.position) store.updateModelTransform(id, 'position', action.position)
          if (action.rotation) store.updateModelTransform(id, 'rotation', action.rotation)
          if (action.scale)    store.updateModelTransform(id, 'scale',    action.scale)
          break
        }

        case 'animate_sequence': {
          const id  = action.modelId
          const kfs = action.keyframes || []
          for (const kf of kfs) {
            store.setCurrentFrame(kf.frame)
            await new Promise(r => setTimeout(r, 40))
            if (kf.position) store.updateModelTransform(id, 'position', kf.position)
            if (kf.rotation) store.updateModelTransform(id, 'rotation', kf.rotation)
            if (kf.scale)    store.updateModelTransform(id, 'scale',    kf.scale)
            store.addKeyframe(kf.frame, id)
          }
          store.setCurrentFrame(0)
          break
        }

        case 'add_keyframe': {
          const id = action.modelId
          if (action.position) store.updateModelTransform(id, 'position', action.position)
          if (action.rotation) store.updateModelTransform(id, 'rotation', action.rotation)
          if (action.scale)    store.updateModelTransform(id, 'scale',    action.scale)
          await new Promise(r => setTimeout(r, 30))
          store.addKeyframe(action.frame, id)
          break
        }

        case 'set_playing':
          store.setIsPlaying(action.value)
          break

        case 'set_frame':
          store.setCurrentFrame(Math.max(0, Math.min(action.frame, store.totalFrames - 1)))
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
          applyImpulse(action.modelId, action.impulse || { x:0, y:5, z:0 })
          break

        case 'set_velocity':
          setBodyVelocity(action.modelId, action.velocity || { x:0, y:0, z:0 })
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

        case 'set_visibility':
          if (action.visible !== store.models.find(m=>m.id===action.modelId)?.visible)
            store.toggleModelVisibility(action.modelId)
          break

        default:
          console.warn('[AI] Unknown action:', action.type)
      }
    } catch (e) {
      console.error('[AI] Action failed:', action, e)
    }
  }
}

// ── Safe JSON parse ────────────────────────────────────────────────────────────
function parseAIResponse(text) {
  // Strip markdown code fences if present
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
  // Find first { ... }
  const start = clean.indexOf('{')
  const end   = clean.lastIndexOf('}')
  if (start === -1 || end === -1) return { message: text, actions: [] }
  try {
    return JSON.parse(clean.slice(start, end + 1))
  } catch (e) {
    // Try to extract just the message
    const msgMatch = text.match(/"message"\s*:\s*"([^"]+)"/)
    return { message: msgMatch?.[1] || text, actions: [] }
  }
}

// ── API call with fallback retry ───────────────────────────────────────────────
async function callWithFallback(messages, apiKey, modelIdx = 0) {
  if (modelIdx >= FREE_MODELS.length) {
    throw new Error('All free models are rate-limited. Please wait a minute and try again, or add your own OpenRouter API key.')
  }

  const model = FREE_MODELS[modelIdx]
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'GLB Studio',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 2048,
      temperature: 0.4,
    }),
  })

  if (res.status === 429 || res.status === 503) {
    console.warn(`[AI] ${model} rate-limited, trying next model…`)
    return callWithFallback(messages, apiKey, modelIdx + 1)
  }

  if (!res.ok) {
    const err = await res.text()
    // If provider error, also try next
    if (err.includes('Provider returned error') || err.includes('rate') || err.includes('429')) {
      return callWithFallback(messages, apiKey, modelIdx + 1)
    }
    throw new Error(`API ${res.status}: ${err.slice(0, 300)}`)
  }

  const data = await res.json()
  return { data, model }
}

// ── UI Helpers ─────────────────────────────────────────────────────────────────
function ChatBubble({ msg }) {
  const isUser  = msg.role === 'user'
  const isError = msg.role === 'error'
  const isInfo  = msg.role === 'info'

  if (isInfo) return (
    <div style={{ padding:'6px 10px', borderRadius:6,
      background:'rgba(79,142,255,0.08)', border:'1px solid rgba(79,142,255,0.15)',
      fontSize:10, color:'var(--accent)', fontStyle:'italic' }}>{msg.content}</div>
  )
  if (isError) return (
    <div style={{ padding:'8px 12px', borderRadius:8,
      background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)',
      fontSize:11, color:'var(--danger)', lineHeight:1.5 }}>
      <div style={{ fontWeight:700, marginBottom:3 }}>❌ Error</div>
      {msg.content}
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column',
      alignItems: isUser ? 'flex-end' : 'flex-start', gap:3 }}>
      <div style={{ fontSize:9, color:'var(--text3)', padding:'0 3px' }}>
        {isUser ? 'You' : `✦ AI${msg.model ? ` · ${msg.model.split('/')[1]?.split(':')[0]}` : ''}`}
      </div>
      <div style={{
        maxWidth:'90%', padding:'9px 12px',
        borderRadius: isUser ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
        background: isUser
          ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
          : 'var(--bg3)',
        border: isUser ? 'none' : '1px solid var(--border-hi)',
        color: isUser ? '#fff' : 'var(--text0)',
        fontSize:12, lineHeight:1.55,
        boxShadow: isUser ? '0 2px 12px rgba(79,142,255,0.3)' : 'none',
      }}>{msg.display || msg.content}</div>
      {msg.actionsCount > 0 && (
        <div style={{ fontSize:9, color:'var(--accent3)', padding:'0 3px',
          display:'flex', alignItems:'center', gap:4 }}>
          <div style={{ width:5,height:5,borderRadius:'50%',background:'var(--accent3)' }}/>
          {msg.actionsCount} action{msg.actionsCount>1?'s':''} executed
        </div>
      )}
    </div>
  )
}

function ThinkingDots() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px',
      background:'var(--bg3)', borderRadius:10, border:'1px solid var(--border)',
      alignSelf:'flex-start' }}>
      <div style={{ display:'flex', gap:4 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width:6, height:6, borderRadius:'50%',
            background:'var(--accent)',
            animation:`pulse 1.2s ease ${i*0.2}s infinite` }}/>
        ))}
      </div>
      <span style={{ fontSize:11, color:'var(--text2)' }}>AI thinking…</span>
    </div>
  )
}

// ── Quick prompts ──────────────────────────────────────────────────────────────
const QUICK = [
  { icon:'🚗', text:'Make the car drive straight across the scene' },
  { icon:'🔄', text:'Make the selected model spin 360° over 150 frames' },
  { icon:'⬆', text:'Make the selected model jump up and come back down' },
  { icon:'🌙', text:'Switch to dramatic night lighting' },
  { icon:'⚡', text:'Enable physics with Earth gravity' },
  { icon:'🎬', text:'Play all animations in the scene' },
  { icon:'📦', text:'Add a Fox model at position 0,0,0' },
  { icon:'🏎️', text:'Create a figure-8 path animation for the car' },
]

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AIController() {
  const {
    openrouterKey, setOpenrouterKey,
    aiMessages, addAiMessage, clearAiMessages,
    aiThinking, setAiThinking,
  } = useStore()

  const [input,   setInput]    = useState('')
  const [apiKey,  setApiKey]   = useState(openrouterKey || '')
  const [showKey, setShowKey]  = useState(!openrouterKey)
  const [currentModel, setCM]  = useState(FREE_MODELS[0])
  const chatRef    = useRef()
  const historyRef = useRef([])
  const textareaRef = useRef()

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [aiMessages, aiThinking])

  const saveKey = () => {
    setOpenrouterKey(apiKey.trim())
    setShowKey(false)
  }

  const sendMessage = useCallback(async (overrideText) => {
    const text = (overrideText || input).trim()
    if (!text || aiThinking) return

    const key = useStore.getState().openrouterKey
    if (!key) { setShowKey(true); return }

    setInput('')
    addAiMessage({ role:'user', content: text })
    setAiThinking(true)

    // Build full message array with scene context
    const scene   = buildSceneContext()
    const sysMsg  = SYSTEM_PROMPT + `\n\n═══ CURRENT SCENE STATE ═══\n${JSON.stringify(scene, null, 2)}`
    const apiMsgs = [
      { role:'system', content: sysMsg },
      ...historyRef.current.slice(-16),  // keep last 8 turns
      { role:'user', content: text },
    ]

    try {
      const { data, model } = await callWithFallback(apiMsgs, key)
      setCM(model)
      const raw     = data.choices?.[0]?.message?.content || '{}'
      const parsed  = parseAIResponse(raw)

      let actionsApplied = 0
      if (parsed.actions?.length > 0) {
        await executeActions(parsed.actions)
        actionsApplied = parsed.actions.length
      }

      // Update conversation history
      historyRef.current.push(
        { role:'user',      content: text },
        { role:'assistant', content: raw  }
      )

      addAiMessage({
        role:'assistant',
        content: raw,
        display: parsed.message || 'Done.',
        actionsCount: actionsApplied,
        model,
      })
    } catch (e) {
      addAiMessage({ role:'error', content: e.message })
    } finally {
      setAiThinking(false)
    }
  }, [input, aiThinking, addAiMessage, setAiThinking])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

      {/* ── API Key banner ── */}
      {showKey && (
        <div style={{ padding:12, borderBottom:'1px solid var(--border)',
          background:'rgba(139,92,246,0.06)', animation:'fadeUp 0.2s ease', flexShrink:0 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--text0)', marginBottom:6,
            display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:16 }}>✦</span> OpenRouter API Key
          </div>
          <div style={{ fontSize:11, color:'var(--text2)', marginBottom:8, lineHeight:1.6 }}>
            Get a free key at{' '}
            <a href="https://openrouter.ai/keys" target="_blank"
              style={{ color:'#8b5cf6', textDecoration:'none', fontWeight:600 }}>
              openrouter.ai/keys ↗</a><br/>
            Free tier · No credit card · Auto-retries on rate limits
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <input type="password" value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              onKeyDown={e => e.key==='Enter' && saveKey()}
              placeholder="sk-or-v1-…"
              autoFocus
              style={{ flex:1 }} />
            <button onClick={saveKey} style={{
              padding:'6px 14px', borderRadius:'var(--radius-sm)',
              background:'#8b5cf6', border:'none', color:'#fff',
              fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0,
            }}>Save</button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ padding:'10px 12px 8px', borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text0)',
            display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:18, color:'#8b5cf6' }}>✦</span>
            AI Scene Controller
          </div>
          <div style={{ fontSize:10, color:'var(--text3)', marginTop:1 }}>
            {currentModel.split('/')[1]?.split(':')[0] || 'ready'} · auto-retry on rate limits
          </div>
        </div>
        <div style={{ display:'flex', gap:5 }}>
          <button onClick={() => setShowKey(!showKey)} style={{
            padding:'4px 8px', borderRadius:'var(--radius-sm)',
            background:'var(--bg3)', border:'1px solid var(--border)',
            color:'var(--text2)', fontSize:10, cursor:'pointer',
          }}>🔑</button>
          <button onClick={() => { clearAiMessages(); historyRef.current = [] }} style={{
            padding:'4px 8px', borderRadius:'var(--radius-sm)',
            background:'var(--bg3)', border:'1px solid var(--border)',
            color:'var(--text2)', fontSize:10, cursor:'pointer',
          }}>Clear</button>
        </div>
      </div>

      {/* ── Quick prompts (shown when chat is empty) ── */}
      {aiMessages.length === 0 && !aiThinking && (
        <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)',
          flexShrink:0, overflowY:'auto', maxHeight:220 }}>
          <div style={{ fontSize:10, color:'var(--text3)', fontWeight:600,
            letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6 }}>
            Quick Actions
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {QUICK.map((q, i) => (
              <button key={i}
                onClick={() => sendMessage(q.text)}
                style={{
                  padding:'7px 10px', borderRadius:'var(--radius-sm)',
                  background:'var(--bg2)', border:'1px solid var(--border)',
                  color:'var(--text1)', fontSize:11, cursor:'pointer',
                  textAlign:'left', transition:'all 0.1s',
                  display:'flex', alignItems:'center', gap:8,
                }}
                onMouseEnter={e=>{e.currentTarget.style.background='var(--bg3)';e.currentTarget.style.color='var(--text0)';e.currentTarget.style.borderColor='var(--border-hi)'}}
                onMouseLeave={e=>{e.currentTarget.style.background='var(--bg2)';e.currentTarget.style.color='var(--text1)';e.currentTarget.style.borderColor='var(--border)'}}
              >
                <span style={{ fontSize:14, flexShrink:0 }}>{q.icon}</span>
                <span>{q.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Chat messages ── */}
      <div ref={chatRef} style={{ flex:1, overflowY:'auto', padding:'12px',
        display:'flex', flexDirection:'column', gap:10, minHeight:0 }}>
        {aiMessages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
        {aiThinking && <ThinkingDots />}
      </div>

      {/* ── Input ── */}
      <div style={{ padding:'10px 12px', borderTop:'1px solid var(--border)',
        background:'var(--bg1)', flexShrink:0 }}>
        <div style={{ display:'flex', gap:6, alignItems:'flex-end' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask AI to control the scene… (Enter to send)"
            rows={2}
            style={{ flex:1, resize:'none', borderRadius:'var(--radius-sm)',
              padding:'8px 10px', fontSize:12, lineHeight:1.5,
              fontFamily:'var(--font-ui)',
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={aiThinking || !input.trim()}
            style={{
              width:38, height:38, borderRadius:'var(--radius-sm)',
              background: (!aiThinking && input.trim()) ? '#8b5cf6' : 'var(--bg3)',
              border: `1px solid ${(!aiThinking && input.trim()) ? '#8b5cf6' : 'var(--border)'}`,
              color: (!aiThinking && input.trim()) ? '#fff' : 'var(--text3)',
              fontSize:18, cursor: (aiThinking || !input.trim()) ? 'not-allowed' : 'pointer',
              flexShrink:0, transition:'all 0.15s', display:'flex',
              alignItems:'center', justifyContent:'center',
              boxShadow: (!aiThinking && input.trim()) ? '0 0 14px rgba(139,92,246,0.4)' : 'none',
            }}
          >↑</button>
        </div>
        <div style={{ fontSize:9, color:'var(--text3)', marginTop:5, textAlign:'center' }}>
          Controls models · animations · physics · lighting · camera
        </div>
      </div>
    </div>
  )
}
