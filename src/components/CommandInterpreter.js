/**
 * CommandInterpreter.js
 * The missing layer: LLM output → validated commands → 3D engine actions.
 *
 * Handles:
 * - Structured command schema validation
 * - Target resolution ("selected", "car", model name → model ID)
 * - Relative transforms (translate DELTA vs absolute SET)
 * - Physics-aware movement (velocity/impulse if physics on, else transform)
 * - Multi-step animation generation
 * - Context memory ("it", "the model", "that object" → last selected)
 * - Error recovery (graceful fallback on bad LLM output)
 */

import * as THREE from 'three'
import useStore from '../store/useStore'
import { applyImpulse, setBodyVelocity } from './PhysicsEngine'

// ── Direction mapping ─────────────────────────────────────────────────────────
// Maps natural language directions to axis deltas
const DIR_MAP = {
  forward:    { axis:'z', sign:-1 },
  backward:   { axis:'z', sign: 1 },
  back:       { axis:'z', sign: 1 },
  left:       { axis:'x', sign:-1 },
  right:      { axis:'x', sign: 1 },
  up:         { axis:'y', sign: 1 },
  down:       { axis:'y', sign:-1 },
  north:      { axis:'z', sign:-1 },
  south:      { axis:'z', sign: 1 },
  east:       { axis:'x', sign: 1 },
  west:       { axis:'x', sign:-1 },
}

// ── Target resolver ────────────────────────────────────────────────────────────
export function resolveTarget(target) {
  const s = useStore.getState()
  const models = s.models

  if (!target || target === 'selected' || target === 'it' || target === 'this'
      || target === 'the model' || target === 'that' || target === 'the object') {
    // Use selected, or fall back to last selected, or first model
    const id = s.selectedModelId || s.lastSelectedModelId || models[0]?.id
    return models.find(m => m.id === id) || null
  }

  if (target === 'all' || target === 'everything') {
    return models  // returns array
  }

  // Try exact ID
  const byId = models.find(m => m.id === target)
  if (byId) return byId

  // Try name match (case-insensitive, partial)
  const lower = target.toLowerCase()
  const byName = models.find(m => m.name.toLowerCase().includes(lower))
  if (byName) return byName

  // Try common aliases
  const aliases = {
    car:      ['car','vehicle','automobile','auto','race'],
    character:['soldier','fox','robot','character','person','human'],
    tree:     ['tree','plant','bush'],
    city:     ['city','building','block','urban'],
  }
  for (const [, terms] of Object.entries(aliases)) {
    if (terms.some(t => lower.includes(t))) {
      const found = models.find(m => terms.some(t => m.name.toLowerCase().includes(t)))
      if (found) return found
    }
  }

  return null
}

// ── Command schema validation ─────────────────────────────────────────────────
function validateCommand(cmd) {
  const errors = []
  if (!cmd || typeof cmd !== 'object') { errors.push('Not an object'); return errors }
  if (!cmd.action && !cmd.type) { errors.push('Missing action/type field') }
  return errors
}

// ── Apply a single validated command ─────────────────────────────────────────
export async function applyCommand(cmd) {
  const s      = useStore.getState()
  const action = cmd.action || cmd.type || ''

  // Resolve target
  let target = resolveTarget(cmd.target || cmd.modelId || 'selected')
  if (!target && action !== 'add_model' && action !== 'set_lighting'
      && action !== 'set_physics' && action !== 'set_playing'
      && action !== 'set_frame' && action !== 'add_model') {
    // No target — try first model
    target = s.models[0] || null
  }

  const targets = Array.isArray(target) ? target : (target ? [target] : [])

  switch (action.toLowerCase().replace(/-/g,'_')) {

    // ── TRANSLATE (relative delta) ───────────────────────────────────────────
    case 'translate':
    case 'move':
    case 'move_by': {
      for (const m of targets) {
        const pos = [...m.position]
        const t   = cmd.translate || cmd.by || cmd.delta || {}

        // Handle direction shorthand: { direction:"forward", amount:3 }
        if (cmd.direction && cmd.amount != null) {
          const d = DIR_MAP[cmd.direction.toLowerCase()]
          if (d) pos[d.axis==='x'?0:d.axis==='y'?1:2] += cmd.amount * d.sign
        } else {
          pos[0] += t.x || 0
          pos[1] += t.y || 0
          pos[2] += t.z || 0
        }

        // Physics-aware: if physics on + dynamic body → set velocity
        if (s.physicsEnabled && (s.modelPhysics[m.id]?.type || 'dynamic') === 'dynamic') {
          const vel = { x: (t.x||0)*2, y: (t.y||0)*2, z: (t.z||0)*2 }
          setBodyVelocity(m.id, vel)
        } else {
          s.updateModelTransform(m.id, 'position', pos)
        }
      }
      break
    }

    // ── SET POSITION (absolute) ──────────────────────────────────────────────
    case 'set_position':
    case 'set_transform':
    case 'teleport': {
      for (const m of targets) {
        const p = cmd.position || cmd.translate || cmd.pos || {}
        const r = cmd.rotation || cmd.rotate || {}
        const sc = cmd.scale || {}
        if (cmd.position || cmd.pos) s.updateModelTransform(m.id, 'position',
          [p.x??m.position[0], p.y??m.position[1], p.z??m.position[2]])
        if (cmd.rotation || cmd.rotate) s.updateModelTransform(m.id, 'rotation',
          [r.x??m.rotation[0], r.y??m.rotation[1], r.z??m.rotation[2]])
        if (cmd.scale) s.updateModelTransform(m.id, 'scale',
          [sc.x??m.scale[0], sc.y??m.scale[1], sc.z??m.scale[2]])
      }
      break
    }

    // ── ROTATE (relative delta in degrees or radians) ────────────────────────
    case 'rotate':
    case 'rotate_by': {
      for (const m of targets) {
        const rot = [...m.rotation]
        const r   = cmd.rotate || cmd.by || cmd.delta || {}
        const useDeg = cmd.unit !== 'rad'  // default degrees
        const toRad  = useDeg ? (Math.PI/180) : 1

        rot[0] += (r.x || 0) * toRad
        rot[1] += (r.y || 0) * toRad
        rot[2] += (r.z || 0) * toRad
        s.updateModelTransform(m.id, 'rotation', rot)
      }
      break
    }

    // ── SCALE ────────────────────────────────────────────────────────────────
    case 'scale':
    case 'resize':
    case 'scale_by': {
      for (const m of targets) {
        const sc   = [...m.scale]
        const factor = cmd.scale || cmd.factor || cmd.by || {}
        if (typeof factor === 'number') {
          s.updateModelTransform(m.id, 'scale', [sc[0]*factor, sc[1]*factor, sc[2]*factor])
        } else {
          s.updateModelTransform(m.id, 'scale', [
            sc[0] * (factor.x || factor.uniform || 1),
            sc[1] * (factor.y || factor.uniform || 1),
            sc[2] * (factor.z || factor.uniform || 1),
          ])
        }
      }
      break
    }

    // ── ANIMATE SEQUENCE (keyframes over time) ───────────────────────────────
    case 'animate':
    case 'animate_sequence':
    case 'create_animation': {
      for (const m of targets) {
        const kfs = cmd.keyframes || []
        for (const kf of kfs) {
          s.setCurrentFrame(kf.frame)
          await new Promise(r => setTimeout(r, 40))
          if (kf.position) s.updateModelTransform(m.id, 'position',
            Array.isArray(kf.position) ? kf.position : [kf.position.x||0, kf.position.y||0, kf.position.z||0])
          if (kf.rotation) s.updateModelTransform(m.id, 'rotation',
            Array.isArray(kf.rotation) ? kf.rotation : [kf.rotation.x||0, kf.rotation.y||0, kf.rotation.z||0])
          if (kf.scale) s.updateModelTransform(m.id, 'scale',
            Array.isArray(kf.scale) ? kf.scale : [kf.scale.x||1, kf.scale.y||1, kf.scale.z||1])
          s.addKeyframe(kf.frame, m.id)
        }
        s.setCurrentFrame(0)
      }
      break
    }

    // ── PHYSICS IMPULSE ──────────────────────────────────────────────────────
    case 'impulse':
    case 'apply_impulse':
    case 'push':
    case 'launch': {
      for (const m of targets) {
        const imp = cmd.impulse || cmd.force || { x:0, y:8, z:0 }
        applyImpulse(m.id, imp)
      }
      break
    }

    case 'set_velocity':
    case 'velocity': {
      for (const m of targets) {
        const vel = cmd.velocity || cmd.vel || { x:0, y:0, z:0 }
        setBodyVelocity(m.id, vel)
      }
      break
    }

    case 'stop': {
      for (const m of targets) setBodyVelocity(m.id, { x:0, y:0, z:0 })
      break
    }

    // ── GLB ANIMATION ────────────────────────────────────────────────────────
    case 'set_animation':
    case 'play_animation': {
      for (const m of targets) {
        if (cmd.animation) s.setModelActiveAnimation(m.id, cmd.animation)
        if (cmd.speed != null) s.setModelAnimSpeed(m.id, cmd.speed)
        s.setModelAnimPlaying?.(m.id, true)
      }
      break
    }

    case 'pause_animation': {
      for (const m of targets) s.setModelAnimPlaying?.(m.id, false)
      break
    }

    // ── TIMELINE ─────────────────────────────────────────────────────────────
    case 'play':         s.setIsPlaying(true);  break
    case 'pause':        s.setIsPlaying(false); break
    case 'stop_playing': s.setIsPlaying(false); s.setCurrentFrame(0); break
    case 'set_playing':  s.setIsPlaying(cmd.value ?? cmd.playing ?? true); break
    case 'set_frame':    s.setCurrentFrame(cmd.frame ?? 0); break
    case 'goto_frame':   s.setCurrentFrame(cmd.frame ?? 0); break

    // ── PHYSICS ──────────────────────────────────────────────────────────────
    case 'set_physics':
    case 'physics': {
      if (cmd.enabled != null) s.setPhysicsEnabled(cmd.enabled)
      if (cmd.gravity != null) s.setGravity(cmd.gravity)
      break
    }

    // ── LIGHTING ─────────────────────────────────────────────────────────────
    case 'set_lighting':
    case 'lighting': {
      if (cmd.preset) s.setLightingPreset(cmd.preset)
      break
    }

    // ── MODEL MANAGEMENT ─────────────────────────────────────────────────────
    case 'add_model': {
      if (cmd.url) s.addModel(cmd.url, cmd.name)
      break
    }

    case 'remove_model':
    case 'delete': {
      for (const m of targets) s.removeModel(m.id)
      break
    }

    case 'select': {
      if (targets.length > 0) s.selectModel(targets[0].id)
      break
    }

    case 'hide': {
      for (const m of targets) if (m.visible) s.toggleModelVisibility(m.id)
      break
    }

    case 'show': {
      for (const m of targets) if (!m.visible) s.toggleModelVisibility(m.id)
      break
    }

    case 'reset_transform': {
      for (const m of targets) {
        s.updateModelTransform(m.id, 'position', [0,0,0])
        s.updateModelTransform(m.id, 'rotation', [0,0,0])
        s.updateModelTransform(m.id, 'scale',    [1,1,1])
      }
      break
    }

    default:
      console.warn('[CommandInterpreter] Unknown action:', action)
  }
}

// ── Execute array of commands ─────────────────────────────────────────────────
export async function executeCommands(commands) {
  const validated = []
  const errors    = []

  for (const cmd of (commands || [])) {
    const errs = validateCommand(cmd)
    if (errs.length) { errors.push({ cmd, errs }); continue }
    validated.push(cmd)
  }

  if (errors.length) console.warn('[CommandInterpreter] Validation errors:', errors)

  for (const cmd of validated) {
    await applyCommand(cmd)
    await new Promise(r => setTimeout(r, 60))
  }

  return { executed: validated.length, errors: errors.length }
}

// ── Parse LLM response robustly ───────────────────────────────────────────────
export function parseLLMResponse(rawText) {
  if (!rawText) return null

  // Strip markdown
  let text = rawText.replace(/```json\s*/gi,'').replace(/```\s*/gi,'').trim()

  // Find JSON object
  const start = text.indexOf('{')
  const end   = text.lastIndexOf('}')
  if (start === -1 || end === -1) return null

  try {
    const obj = JSON.parse(text.slice(start, end+1))
    // Normalize: support both "action" and "type" keys
    // Support both "commands" array and single "action"
    if (obj.commands && Array.isArray(obj.commands)) {
      return obj  // already correct format
    }
    if (obj.actions && Array.isArray(obj.actions)) {
      return { message: obj.message, commands: obj.actions }
    }
    if (obj.action || obj.type) {
      // Single command — wrap it
      return { message: obj.message || '', commands: [obj] }
    }
    return obj
  } catch (e) {
    // Try to extract partial JSON arrays
    const arrMatch = text.match(/\[[\s\S]+?\]/)
    if (arrMatch) {
      try {
        const arr = JSON.parse(arrMatch[0])
        return { message: '', commands: arr }
      } catch {}
    }
    return null
  }
}

// ── Generate animation presets ────────────────────────────────────────────────
export function generatePresetAnimation(type, modelId, totalFrames) {
  const s     = useStore.getState()
  const model = s.models.find(m => m.id === modelId)
  if (!model) return []

  const [px, py, pz] = model.position
  const tf = totalFrames || s.totalFrames

  const presets = {
    drive_straight: [
      { frame:0,      position:[px-10, py, pz], rotation:[0,0,0],       scale:model.scale },
      { frame:tf,     position:[px+10, py, pz], rotation:[0,0,0],       scale:model.scale },
    ],
    spin_360: [
      { frame:0,      position:[px,py,pz], rotation:[0,0,0],            scale:model.scale },
      { frame:tf/2,   position:[px,py,pz], rotation:[0,Math.PI,0],      scale:model.scale },
      { frame:tf,     position:[px,py,pz], rotation:[0,Math.PI*2,0],    scale:model.scale },
    ],
    bounce: [
      { frame:0,      position:[px,py,pz],   rotation:model.rotation, scale:model.scale },
      { frame:tf*0.25,position:[px,py+3,pz], rotation:model.rotation, scale:model.scale },
      { frame:tf*0.5, position:[px,py,pz],   rotation:model.rotation, scale:model.scale },
      { frame:tf*0.75,position:[px,py+3,pz], rotation:model.rotation, scale:model.scale },
      { frame:tf,     position:[px,py,pz],   rotation:model.rotation, scale:model.scale },
    ],
    figure_eight: (() => {
      const kfs = []
      const steps = 12
      for (let i = 0; i <= steps; i++) {
        const t   = (i / steps) * Math.PI * 2
        const x   = px + Math.sin(t) * 5
        const z   = pz + Math.sin(t) * Math.cos(t) * 5
        const rot = [0, -t, 0]
        kfs.push({ frame: Math.round((i/steps)*tf), position:[x,py,z], rotation:rot, scale:model.scale })
      }
      return kfs
    })(),
    circle: (() => {
      const kfs = []
      const steps = 8
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2
        kfs.push({
          frame: Math.round((i/steps)*tf),
          position: [px + Math.cos(t)*5, py, pz + Math.sin(t)*5],
          rotation: [0, t, 0],
          scale: model.scale,
        })
      }
      return kfs
    })(),
    fly_in: [
      { frame:0,  position:[px, py+20, pz-20], rotation:[0.5,0,0], scale:[0.1,0.1,0.1] },
      { frame:tf, position:[px, py,    pz],    rotation:[0,0,0],   scale:model.scale    },
    ],
  }

  return presets[type] || []
}
