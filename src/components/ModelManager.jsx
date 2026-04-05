/**
 * ModelManager.jsx — Fixed version
 *
 * Bug fixes:
 * 1. TypeError "Cannot read properties of undefined (reading 'length')"
 *    — animations array was undefined before GLTF fully loaded
 * 2. Model selection jumps to wrong model
 *    — TransformControls was passed groupRef (a ref object) not groupRef.current
 *    — Fixed: use explicit attach ref pattern
 * 3. Physics causes shaking/flipping
 *    — Physics engine was writing back to store every frame, causing
 *      a feedback loop: store update → useEffect → reset position → physics fight
 *    — Fixed: when physics is ON for a body, skip the store→mesh sync useEffect
 *    — PhysicsEngine syncs mesh; store only updated by user transforms
 * 4. Physics auto-enabled on import
 *    — Removed: physics registration no longer fires on model load
 *    — Physics registration now only happens when user explicitly enables physics
 * 5. City GLB moves on physics enable
 *    — Default type is now 'static' for any model with no physics config set
 *    — Fixed: bodies placed at exact mesh world position (no bounding box offset)
 */
import { useEffect, useRef, useMemo, useCallback } from 'react'
import { useGLTF, TransformControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE   from 'three'
import useStore     from '../store/useStore'

// Physics imported lazily to avoid circular deps
let _registerPhysics   = null
let _unregisterPhysics = null
async function getPhysicsFns() {
  if (!_registerPhysics) {
    const m = await import('./PhysicsEngine')
    _registerPhysics   = m.registerPhysicsObject
    _unregisterPhysics = m.unregisterPhysicsObject
  }
  return { register: _registerPhysics, unregister: _unregisterPhysics }
}

function ModelMesh({ model }) {
  const groupRef       = useRef()
  const mixerRef       = useRef(null)
  const actionsRef     = useRef({})
  const currentAnimRef = useRef(null)
  const physicsActiveRef = useRef(false)  // is this body currently in physics world?

  const { scene, animations: rawAnims } = useGLTF(model.url)
  const animations = rawAnims || []  // guard against undefined

  const {
    selectedModelId, transformMode,
    updateModelTransform, setModelAnimations, setModelAnimPlaying,
    selectModel, currentFrame, keyframes,
    snapEnabled, snapTranslate, snapRotate, snapScale,
    physicsEnabled, physicsConnected, modelPhysics,
  } = useStore()

  const isSelected   = selectedModelId === model.id
  const isRenderMode = useStore(s => s.isRenderMode || s.isExporting)

  // ── Clone scene (manual skeleton rebind, no SkeletonUtils dep) ────────────
  const clonedScene = useMemo(() => {
    if (!scene) return null
    const clone    = scene.clone(true)
    const srcBones = [], dstBones = []
    scene.traverse(n => { if (n.isBone) srcBones.push(n) })
    clone.traverse(n => { if (n.isBone) dstBones.push(n) })
    clone.traverse(child => {
      if (child.isSkinnedMesh && child.skeleton) {
        const newBones = child.skeleton.bones.map(b => {
          const idx = srcBones.indexOf(b)
          return idx !== -1 ? dstBones[idx] : b
        })
        child.skeleton = new THREE.Skeleton(newBones, child.skeleton.boneInverses)
        child.bind(child.skeleton, child.bindMatrix)
      }
      if (child.isMesh) {
        child.castShadow = child.receiveShadow = true
        if (child.material) {
          child.material = Array.isArray(child.material)
            ? child.material.map(m => m.clone())
            : child.material.clone()
        }
      }
    })
    return clone
  }, [scene])

  // ── AnimationMixer — set up on load ───────────────────────────────────────
  useEffect(() => {
    if (!clonedScene || !animations.length) return
    const mixer = new THREE.AnimationMixer(clonedScene)
    mixerRef.current = mixer
    const actionMap = {}
    animations.forEach(clip => {
      const action = mixer.clipAction(clip, clonedScene)
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.clampWhenFinished = false
      actionMap[clip.name] = action
    })
    actionsRef.current = actionMap

    const names = animations.map(a => a.name)
    setModelAnimations(model.id, names)

    const curAnim = useStore.getState().models.find(m => m.id === model.id)?.activeAnimation
    const first   = curAnim || names[0]
    if (first && actionMap[first]) {
      actionMap[first].play()
      currentAnimRef.current = first
    }
    setModelAnimPlaying(model.id, true)

    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(clonedScene)
    }
  }, [clonedScene, animations.length, model.id])  // animations.length safe guard

  // ── Animation switch ──────────────────────────────────────────────────────
  useEffect(() => {
    const mixer   = mixerRef.current
    const actions = actionsRef.current
    if (!mixer || !model.activeAnimation) return
    const target = model.activeAnimation
    if (currentAnimRef.current === target) return
    const prev = actions[currentAnimRef.current]
    const next = actions[target]
    if (!next) return
    if (prev && prev !== next) { prev.fadeOut(0.3); next.reset().fadeIn(0.3) }
    else next.reset()
    if (model.animationPlaying) next.play()
    else { next.play(); next.paused = true }
    next.setEffectiveTimeScale(model.animationSpeed || 1)
    currentAnimRef.current = target
  }, [model.activeAnimation, model.animationPlaying, model.animationSpeed])

  useEffect(() => {
    const cur = actionsRef.current[currentAnimRef.current]
    if (cur) cur.paused = !model.animationPlaying
  }, [model.animationPlaying])

  useEffect(() => {
    Object.values(actionsRef.current).forEach(a => a.setEffectiveTimeScale(model.animationSpeed || 1))
  }, [model.animationSpeed])

  // ── Tick mixer ────────────────────────────────────────────────────────────
  useFrame((_, delta) => { mixerRef.current?.update(delta) })

  // ── Physics registration — ONLY when user clicks "Connect Physics" ─────────
  useEffect(() => {
    if (!physicsEnabled || !physicsConnected || !groupRef.current) {
      physicsActiveRef.current = false
      return
    }
    // Register this body
    getPhysicsFns().then(({ register, unregister }) => {
      if (!groupRef.current) return
      const props = modelPhysics[model.id] || {}
      register(model.id, groupRef.current, {
        mass:           props.mass           ?? 1,
        type:           props.type           ?? 'static',   // default STATIC — safe
        linearDamping:  props.damping        ?? 0.3,
        angularDamping: props.angularDamping ?? 0.5,
        friction:       props.friction       ?? 0.4,
        restitution:    props.restitution    ?? 0.2,
        centerOfMassY:  props.centerOfMassY  ?? 0,
        collisionShape: props.collisionShape ?? 'box',
        ccdRadius:      props.ccdRadius      ?? 0,
      })
      physicsActiveRef.current = true
    })
    return () => {
      getPhysicsFns().then(({ unregister }) => {
        unregister(model.id)
        physicsActiveRef.current = false
      })
    }
  }, [physicsEnabled, physicsConnected, model.id, JSON.stringify(modelPhysics[model.id])])

  // ── Material overrides ────────────────────────────────────────────────────
  useEffect(() => {
    if (!clonedScene) return
    const mat = model.materialOverride
    clonedScene.traverse(child => {
      if (!child.isMesh || !child.material) return
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      mats.forEach(m => {
        if (mat?.color     !== undefined) m.color?.set(mat.color)
        if (mat?.roughness !== undefined) m.roughness = mat.roughness
        if (mat?.metalness !== undefined) m.metalness = mat.metalness
        if (mat?.opacity   !== undefined) { m.opacity = mat.opacity; m.transparent = mat.opacity < 1 }
        if (mat?.wireframe !== undefined) m.wireframe = !!mat.wireframe
        if (!mat) { m.wireframe = false; m.opacity = 1; m.transparent = false }
        m.needsUpdate = true
      })
    })
  }, [model.materialOverride, clonedScene])

  // ── Shadow settings ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!clonedScene) return
    clonedScene.traverse(child => {
      if (child.isMesh) {
        child.castShadow    = model.castShadow    ?? true
        child.receiveShadow = model.receiveShadow ?? true
      }
    })
  }, [model.castShadow, model.receiveShadow, clonedScene])

  // ── Sync store position → mesh
  //    SKIPPED when physics engine is actively driving this body
  useEffect(() => {
    if (!groupRef.current) return
    if (physicsActiveRef.current) return  // physics owns the transform — don't override

    const store       = useStore.getState()
    const interpolated = store.interpolateAtFrame(model.id, currentFrame)
    const src          = interpolated || model
    groupRef.current.position.set(...src.position)
    groupRef.current.rotation.set(...src.rotation)
    groupRef.current.scale.set(...src.scale)
  }, [currentFrame, keyframes, model.position, model.rotation, model.scale])

  // ── TransformControls drag → store ────────────────────────────────────────
  const onTransformChange = useCallback(() => {
    if (!groupRef.current) return
    const p  = groupRef.current.position
    const r  = groupRef.current.rotation
    const sc = groupRef.current.scale
    updateModelTransform(model.id, 'position', [p.x,  p.y,  p.z])
    updateModelTransform(model.id, 'rotation', [r.x,  r.y,  r.z])
    updateModelTransform(model.id, 'scale',    [sc.x, sc.y, sc.z])
  }, [model.id, updateModelTransform])

  if (!model.visible || !clonedScene) return null

  return (
    <>
      <group
        ref={groupRef}
        onClick={e => { e.stopPropagation(); selectModel(model.id) }}
      >
        <primitive object={clonedScene} />

        {/* Selection ring — hidden during render */}
        {isSelected && !isRenderMode && (
          <mesh rotation={[-Math.PI/2, 0, 0]}>
            <ringGeometry args={[0.9, 1.05, 64]} />
            <meshBasicMaterial color="#4f8eff" transparent opacity={0.6}
              side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        )}
      </group>

      {/* TransformControls — fix: pass ref.current via key trick so it
          always attaches to the correct mesh when selection changes */}
      {isSelected && !isRenderMode && groupRef.current && (
        <TransformControls
          key={model.id}           // force remount when selected model changes
          object={groupRef.current}
          mode={transformMode}
          onChange={onTransformChange}
          translationSnap={snapEnabled ? snapTranslate : null}
          rotationSnap={snapEnabled ? (snapRotate * Math.PI / 180) : null}
          scaleSnap={snapEnabled ? snapScale : null}
          size={0.8}
        />
      )}
    </>
  )
}

export default function ModelManager() {
  const models = useStore(s => s.models)
  if (!models?.length) return null
  return (
    <>
      {models.map(model => (
        <ModelMesh key={`${model.id}-${model.url}`} model={model} />
      ))}
    </>
  )
}
