/**
 * AIController.jsx
 * Full AI scene controller with:
 * - Command interpreter layer (not raw LLM → scene)
 * - Voice input (Web Speech API)
 * - Animation preset generator
 * - Context memory ("it", "the car", last selected)
 * - Auto-retry across 5 free OpenRouter models
 * - Structured command validation
 * - Object registry (resolve by name/type/alias)
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import useStore from '../store/useStore'
import {
  parseLLMResponse, executeCommands,
  resolveTarget, generatePresetAnimation,
} from './CommandInterpreter'

const BASE_URL   = 'https://openrouter.ai/api/v1'
// Verified working free models on OpenRouter (updated list)
// Ordered by reliability - falls through on 404/429/503
const FREE_MODELS = [
  'google/gemma-2-9b-it:free',
  'mistralai/mistral-7b-instruct:free',
  'microsoft/phi-3-mini-128k-instruct:free',
  'qwen/qwen-2-7b-instruct:free',
  'huggingfaceh4/zephyr-7b-beta:free',
  'openchat/openchat-7b:free',
  'gryphe/mythomist-7b:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'deepseek/deepseek-r1-distill-qwen-7b:free',
  'nousresearch/nous-capybara-7b:free',
]

// ── System prompt ──────────────────────────────────────────────────────────────
const SYSTEM = `You are an AI controller for a professional 3D animation studio.
You control a Three.js scene with physics (Cannon.js) and a keyframe timeline.

OUTPUT: Return ONLY valid JSON. No markdown. No explanation outside JSON.

FORMAT:
{
  "message": "Brief friendly description of what you did",
  "commands": [
    { "action": "<action>", "target": "<target>", ...params }
  ]
}

═══ ACTIONS ═══

INSTANT MOVE (no animation, teleport/offset):
{ "action":"translate", "target":"<t>", "translate":{"x":0,"y":0,"z":0} }
{ "action":"set_position","target":"<t>","position":{"x":0,"y":0,"z":0} }
{ "action":"rotate", "target":"<t>", "rotate":{"x":0,"y":0,"z":90}, "unit":"deg" }
{ "action":"scale",  "target":"<t>", "scale":{"uniform":2} }

KEYFRAME ANIMATION:
{ "action":"animate_sequence","target":"<t>","keyframes":[
  {"frame":0,  "position":{"x":-10,"y":0,"z":0},"rotation":{"x":0,"y":0,"z":0}},
  {"frame":150,"position":{"x":10, "y":0,"z":0},"rotation":{"x":0,"y":0,"z":0}}
]}

PLAYBACK:
{ "action":"play" }
{ "action":"pause" }
{ "action":"set_frame","frame":0 }

GLB ANIMATION CLIP:
{ "action":"set_animation","target":"<t>","animation":"<clipName>","speed":1.0 }

PHYSICS:
{ "action":"set_physics","enabled":true,"gravity":-9.82 }
{ "action":"apply_impulse","target":"<t>","impulse":{"x":0,"y":8,"z":0} }
{ "action":"set_velocity","target":"<t>","velocity":{"x":5,"y":0,"z":0} }
{ "action":"stop","target":"<t>" }

LIGHTING:
{ "action":"set_lighting","preset":"studio"|"outdoor"|"dramatic"|"neon" }

MODELS:
{ "action":"add_model","url":"<url>","name":"<n>" }
{ "action":"remove_model","target":"<t>" }
{ "action":"hide","target":"<t>" }
{ "action":"show","target":"<t>" }
{ "action":"select","target":"<t>" }

═══ TARGET VALUES ═══
"selected"    → currently selected model (default)
"it"/"this"   → same as selected
"all"         → every model
"car"/"fox"   → match by name (partial, case-insensitive)
"<exact-id>"  → model ID from scene state

═══ COORDINATE SYSTEM ═══
X = right, Y = up, Z = toward viewer
Ground = Y 0. 1 unit ≈ 1 meter.
Forward (away) = Z negative. Right = X positive.

═══ BUILT-IN MODELS ═══
Fox:     https://threejs.org/examples/models/gltf/Fox/glTF/Fox.gltf
Robot:   https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb
Soldier: https://threejs.org/examples/models/gltf/Soldier.glb
Parrot:  https://threejs.org/examples/models/gltf/Parrot.glb

═══ RULES ═══
1. Always output valid JSON — never plain text
2. Use animate_sequence for "make it move/drive/walk" (not translate)
3. For cars driving: animate X or Z position across frames 0→totalFrames
4. Include frame 0 in every keyframe sequence
5. Physics impulse only works when physics is enabled
6. You can chain multiple commands in the array
7. "it"/"the model"/"that" → target="selected"
`

// ── Build scene context ────────────────────────────────────────────────────────
function buildContext() {
  const s = useStore.getState()
  return {
    models: s.models.map(m => ({
      id: m.id, name: m.name,
      position: m.position.map(v=>+v.toFixed(2)),
      rotation: m.rotation.map(v=>+v.toFixed(3)),
      scale:    m.scale.map(v=>+v.toFixed(2)),
      visible:  m.visible,
      animations: m.animations,
      activeAnimation: m.activeAnimation,
    })),
    selected: s.selectedModelId,
    selectedName: s.models.find(m=>m.id===s.selectedModelId)?.name || null,
    lastSelected: s.lastSelectedModelId,
    currentFrame: s.currentFrame,
    totalFrames:  s.totalFrames,
    fps:          s.fps,
    isPlaying:    s.isPlaying,
    lightingPreset: s.lightingPreset,
    physicsEnabled: s.physicsEnabled,
    gravity:        s.gravity,
  }
}

// ── OpenRouter call with model fallback chain ─────────────────────────────────
async function callAI(messages, apiKey, modelIdx=0) {
  if (modelIdx >= FREE_MODELS.length)
    throw new Error('All free models are rate-limited. Please wait ~1 min and retry.')

  const model = FREE_MODELS[modelIdx]
  let res
  try {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'GLB Studio',
      },
      body: JSON.stringify({ model, messages, max_tokens:2048, temperature:0.3 }),
    })
  } catch(e) {
    // Network error — try next
    return callAI(messages, apiKey, modelIdx+1)
  }

  // Skip to next model on any of these status codes
  if ([404, 429, 500, 503, 529].includes(res.status)) {
    console.info(`[AI] ${model} → ${res.status}, trying next model…`)
    return callAI(messages, apiKey, modelIdx+1)
  }
  if (!res.ok) {
    const txt = await res.text()
    // Also skip on provider errors, rate limits in body, or endpoint not found
    if (txt.includes('429') || txt.includes('rate') || txt.includes('No endpoints')
        || txt.includes('Provider returned') || txt.includes('model_not_found')
        || txt.includes('not found') || txt.includes('unavailable')) {
      console.info(`[AI] ${model} → body error, trying next…`)
      return callAI(messages, apiKey, modelIdx+1)
    }
    throw new Error(`API ${res.status}: ${txt.slice(0,300)}`)
  }
  const data = await res.json()
  return { data, model }
}

// ── Voice recognition ─────────────────────────────────────────────────────────
function useVoice(onResult) {
  const recRef = useRef(null)
  const [listening, setListening] = useState(false)

  const supported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const toggle = useCallback(() => {
    if (!supported) return
    if (listening) {
      recRef.current?.stop()
      setListening(false)
      return
    }
    const SRClass = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SRClass()
    rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1
    rec.onresult = e => {
      const txt = e.results[0][0].transcript
      setListening(false)
      onResult(txt)
    }
    rec.onerror  = () => setListening(false)
    rec.onend    = () => setListening(false)
    rec.start()
    recRef.current = rec
    setListening(true)
  }, [listening, supported, onResult])

  return { toggle, listening, supported }
}

// ── Quick prompt presets ──────────────────────────────────────────────────────
const QUICK = [
  { icon:'🚗', label:'Car drives straight', text:'Make the car drive straight across the scene from left to right' },
  { icon:'🏎️', label:'Figure-8 path',       text:'Make the car do a figure-8 animation path' },
  { icon:'🔄', label:'Spin 360°',            text:'Make the selected model spin 360 degrees over the full timeline' },
  { icon:'⬆️', label:'Bounce',              text:'Make the selected model bounce up and down repeatedly' },
  { icon:'⚡', label:'Enable Physics',       text:'Enable physics with Earth gravity' },
  { icon:'🚀', label:'Launch up',            text:'Enable physics and launch the selected model upward' },
  { icon:'🌙', label:'Night scene',          text:'Switch to dramatic night lighting' },
  { icon:'☀️', label:'Outdoor scene',       text:'Switch to outdoor sunny lighting' },
  { icon:'▶️', label:'Play timeline',       text:'Play the animation timeline' },
  { icon:'📦', label:'Add Fox',             text:'Add the Fox GLB model to the scene' },
]

// ── Chat message ──────────────────────────────────────────────────────────────
function Bubble({ msg }) {
  const isUser  = msg.role === 'user'
  const isError = msg.role === 'error'
  const isInfo  = msg.role === 'info'

  if (isInfo) return (
    <div style={{ fontSize:10, color:'var(--accent)', fontStyle:'italic',
      padding:'4px 8px', background:'rgba(79,142,255,0.06)', borderRadius:5 }}>{msg.content}</div>
  )
  if (isError) return (
    <div style={{ padding:'9px 12px', borderRadius:8,
      background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.2)',
      fontSize:11, color:'var(--danger)', lineHeight:1.5 }}>
      <b>❌ Error: </b>{msg.content}
      {msg.retry && <div style={{marginTop:4,color:'var(--text2)'}}>
        Tip: wait 30s and try again, or use a different prompt.
      </div>}
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column',
      alignItems: isUser ? 'flex-end' : 'flex-start', gap:3 }}>
      <div style={{ fontSize:9, color:'var(--text3)', padding:'0 3px' }}>
        {isUser ? 'You' : `✦ AI${msg.model?' · '+msg.model.split('/')[1]?.split(':')[0]:''}`}
      </div>
      <div style={{
        maxWidth:'92%', padding:'9px 12px',
        borderRadius: isUser ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
        background: isUser
          ? 'linear-gradient(135deg,var(--accent),var(--accent2))'
          : 'var(--bg3)',
        border: isUser ? 'none' : '1px solid var(--border-hi)',
        color: isUser ? '#fff' : 'var(--text0)',
        fontSize:12, lineHeight:1.55,
        boxShadow: isUser ? '0 2px 12px rgba(79,142,255,0.25)' : 'none',
      }}>{msg.display || msg.content}</div>
      {msg.cmdCount > 0 && (
        <div style={{ fontSize:9, color:'var(--accent3)', padding:'0 3px',
          display:'flex', alignItems:'center', gap:4 }}>
          <span style={{ width:5, height:5, borderRadius:'50%', background:'var(--accent3)', display:'inline-block' }}/>
          {msg.cmdCount} command{msg.cmdCount>1?'s':''} executed
        </div>
      )}
    </div>
  )
}

function Dots() {
  return (
    <div style={{ display:'flex', gap:4, padding:'8px 12px', background:'var(--bg3)',
      borderRadius:10, border:'1px solid var(--border)', alignSelf:'flex-start',
      alignItems:'center' }}>
      {[0,1,2].map(i=>(
        <div key={i} style={{ width:6,height:6,borderRadius:'50%',background:'var(--accent)',
          animation:`pulse 1.2s ease ${i*0.2}s infinite` }}/>
      ))}
      <span style={{ fontSize:10, color:'var(--text2)', marginLeft:4 }}>thinking…</span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AIController() {
  const {
    openrouterKey, setOpenrouterKey,
    aiMessages, addAiMessage, clearAiMessages,
    aiThinking, setAiThinking,
    addAiCommandHistory,
  } = useStore()

  const [input,    setInput]   = useState('')
  const [apiKey,   setApiKey]  = useState(openrouterKey || '')
  const [showKey,  setShowKey] = useState(!openrouterKey)
  const [activeModel, setAM]   = useState(FREE_MODELS[0])
  const [showQuick, setShowQ]  = useState(true)
  const chatRef    = useRef()
  const historyRef = useRef([])
  const inputRef   = useRef()

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [aiMessages, aiThinking])

  const saveKey = () => { setOpenrouterKey(apiKey.trim()); setShowKey(false) }

  const send = useCallback(async (overrideText) => {
    const text = (overrideText !== undefined ? overrideText : input).trim()
    if (!text || aiThinking) return
    const key  = useStore.getState().openrouterKey
    if (!key) { setShowKey(true); return }

    setInput(''); setShowQ(false)
    addAiMessage({ role:'user', content:text })
    setAiThinking(true)

    const ctx     = buildContext()
    const sysMsg  = SYSTEM + `\n\n═══ LIVE SCENE STATE ═══\n${JSON.stringify(ctx,null,2)}`
    const msgs    = [
      { role:'system', content:sysMsg },
      ...historyRef.current.slice(-14),
      { role:'user', content:text },
    ]

    try {
      const { data, model } = await callAI(msgs, key)
      setAM(model)
      const raw    = data.choices?.[0]?.message?.content || '{}'
      const parsed = parseLLMResponse(raw)

      let cmdCount = 0
      if (parsed?.commands?.length) {
        const result = await executeCommands(parsed.commands)
        cmdCount = result.executed
        addAiCommandHistory({ prompt:text, commands:parsed.commands, model, timestamp:Date.now() })
      }

      historyRef.current.push(
        { role:'user',      content:text },
        { role:'assistant', content:raw  }
      )

      addAiMessage({
        role:'assistant', content:raw,
        display: parsed?.message || 'Done.',
        cmdCount, model,
      })
    } catch(e) {
      addAiMessage({ role:'error', content:e.message, retry:true })
    } finally {
      setAiThinking(false)
    }
  }, [input, aiThinking])

  // Voice
  const { toggle:voiceToggle, listening, supported:voiceSupported } = useVoice(
    useCallback(txt => { setInput(txt); setTimeout(()=>send(txt),100) }, [send])
  )

  const handleKey = (e) => {
    if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

      {/* API Key */}
      {showKey && (
        <div style={{ padding:12, borderBottom:'1px solid var(--border)',
          background:'rgba(139,92,246,0.05)', flexShrink:0 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--text0)', marginBottom:6 }}>
            ✦ OpenRouter API Key
          </div>
          <div style={{ fontSize:11, color:'var(--text2)', marginBottom:8, lineHeight:1.6 }}>
            Free key at{' '}
            <a href="https://openrouter.ai/keys" target="_blank"
              style={{ color:'#8b5cf6', textDecoration:'none', fontWeight:600 }}>
              openrouter.ai/keys ↗</a>
            <br/>No credit card · Auto-retries 5 models on rate limits
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <input type="password" value={apiKey}
              onChange={e=>setApiKey(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&saveKey()}
              placeholder="sk-or-v1-…" autoFocus style={{flex:1}} />
            <button onClick={saveKey} style={{
              padding:'6px 14px', borderRadius:'var(--radius-sm)',
              background:'#8b5cf6', border:'none', color:'#fff',
              fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0,
            }}>Save</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding:'10px 12px 8px', borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text0)',
            display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ color:'#8b5cf6', fontSize:18 }}>✦</span>
            AI Scene Controller
          </div>
          <div style={{ fontSize:9, color:'var(--text3)', marginTop:1 }}>
            {activeModel.split('/')[1]?.split(':')[0]} · command interpreter · {FREE_MODELS.length} model fallbacks
          </div>
        </div>
        <div style={{ display:'flex', gap:4 }}>
          <button onClick={()=>setShowKey(!showKey)} title="API Key"
            style={iconBtn('#8b5cf6', showKey)}>🔑</button>
          <button onClick={()=>setShowQ(!showQuick)} title="Quick actions"
            style={iconBtn('var(--accent)', showQuick)}>⚡</button>
          <button onClick={()=>{clearAiMessages();historyRef.current=[];setShowQ(true)}} title="Clear chat"
            style={iconBtn('var(--text2)',false)}>✕</button>
        </div>
      </div>

      {/* Quick prompts */}
      {showQuick && aiMessages.length===0 && (
        <div style={{ flexShrink:0, overflowY:'auto', maxHeight:240,
          padding:'8px 10px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontSize:10, color:'var(--text3)', fontWeight:600,
            letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:5 }}>Quick Actions</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
            {QUICK.map((q,i) => (
              <button key={i} onClick={()=>send(q.text)}
                style={{
                  padding:'6px 8px', borderRadius:'var(--radius-sm)',
                  background:'var(--bg2)', border:'1px solid var(--border)',
                  color:'var(--text1)', fontSize:10, cursor:'pointer',
                  textAlign:'left', transition:'all 0.1s',
                  display:'flex', alignItems:'center', gap:6,
                  overflow:'hidden',
                }}
                onMouseEnter={e=>{e.currentTarget.style.background='var(--bg3)';e.currentTarget.style.borderColor='var(--border-hi)'}}
                onMouseLeave={e=>{e.currentTarget.style.background='var(--bg2)';e.currentTarget.style.borderColor='var(--border)'}}
              >
                <span style={{flexShrink:0}}>{q.icon}</span>
                <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{q.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat */}
      <div ref={chatRef} style={{ flex:1, overflowY:'auto', padding:'12px',
        display:'flex', flexDirection:'column', gap:10, minHeight:0 }}>
        {aiMessages.length===0 && !aiThinking && (
          <div style={{ textAlign:'center', padding:'20px 12px', color:'var(--text3)' }}>
            <div style={{ fontSize:28, marginBottom:8, opacity:0.5 }}>✦</div>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--text2)' }}>AI Scene Controller</div>
            <div style={{ fontSize:11, marginTop:4, lineHeight:1.6 }}>
              Ask me to move, animate, or control<br/>anything in the 3D scene
            </div>
          </div>
        )}
        {aiMessages.map((msg,i) => <Bubble key={i} msg={msg} />)}
        {aiThinking && <Dots />}
      </div>

      {/* Input */}
      <div style={{ padding:'10px 12px', borderTop:'1px solid var(--border)',
        background:'var(--bg1)', flexShrink:0 }}>
        <div style={{ display:'flex', gap:6, alignItems:'flex-end' }}>
          {/* Voice button */}
          {voiceSupported && (
            <button onClick={voiceToggle}
              title={listening ? 'Stop listening' : 'Voice input'}
              style={{
                width:36, height:36, borderRadius:'var(--radius-sm)', flexShrink:0,
                background: listening ? 'rgba(239,68,68,0.15)' : 'var(--bg3)',
                border:`1px solid ${listening ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
                color: listening ? 'var(--danger)' : 'var(--text2)',
                fontSize:16, cursor:'pointer', transition:'all 0.15s',
                animation: listening ? 'pulse 1s ease infinite' : 'none',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}
            >{listening ? '⏹' : '🎤'}</button>
          )}

          <textarea ref={inputRef} value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={listening ? '🎤 Listening…' : 'Ask AI to control the scene… (Enter to send)'}
            rows={2}
            style={{ flex:1, resize:'none', borderRadius:'var(--radius-sm)',
              padding:'8px 10px', fontSize:12, lineHeight:1.5,
              fontFamily:'var(--font-ui)',
            }}
          />

          <button onClick={()=>send()} disabled={aiThinking||!input.trim()}
            style={{
              width:36, height:36, borderRadius:'var(--radius-sm)', flexShrink:0,
              background:(!aiThinking&&input.trim())?'#8b5cf6':'var(--bg3)',
              border:`1px solid ${(!aiThinking&&input.trim())?'#8b5cf6':'var(--border)'}`,
              color:(!aiThinking&&input.trim())?'#fff':'var(--text3)',
              fontSize:18, cursor:(aiThinking||!input.trim())?'not-allowed':'pointer',
              transition:'all 0.15s', display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:(!aiThinking&&input.trim())?'0 0 14px rgba(139,92,246,0.4)':'none',
            }}
          >↑</button>
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', marginTop:5 }}>
          <div style={{ fontSize:9, color:'var(--text3)' }}>
            Move · Animate · Physics · Lighting · Voice
          </div>
          {listening && (
            <div style={{ fontSize:9, color:'var(--danger)',
              animation:'pulse 1s ease infinite' }}>● REC</div>
          )}
        </div>
      </div>
    </div>
  )
}

const iconBtn = (color, active) => ({
  padding:'4px 7px', borderRadius:'var(--radius-sm)',
  background: active ? `${color}18` : 'var(--bg3)',
  border:`1px solid ${active ? `${color}44` : 'var(--border)'}`,
  color: active ? color : 'var(--text2)',
  fontSize:11, cursor:'pointer', transition:'all 0.12s',
})
