/**
 * ModelManager.jsx — stable, bug-free version
 *
 * Fixes:
 *  - TypeError "Cannot read properties of undefined (reading 'length')"
 *    useGLTF can return animations=undefined; fully guarded everywhere
 *  - Model selection attaches TransformControls to wrong mesh
 *    Fixed: use groupRef.current directly with key={model.id} remount
 *  - Physics feedback loop shaking
 *    Fixed: physicsActiveRef blocks store→mesh sync when body is active
 */
import { useEffect, useRef, useMemo, useCallback, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import * as THREE   from 'three'
import useStore     from '../store/useStore'

/* ── lazy physics import ─────────────────────────────────────────────────── */
let _reg = null, _unreg = null
async function physFns() {
  if (!_reg) {
    const m = await import('./PhysicsEngine')
    _reg   = m.registerPhysicsObject
    _unreg = m.unregisterPhysicsObject
  }
  return { reg: _reg, unreg: _unreg }
}

/* ═══════════════════════════════════════════════════════════════════════════
   ModelMesh — renders one GLB model
   ═══════════════════════════════════════════════════════════════════════════ */
function ModelMesh({ model }) {
  const groupRef       = useRef()
  const mixerRef       = useRef(null)
  const actionsRef     = useRef({})
  const curAnimRef     = useRef(null)
  const physActiveRef  = useRef(false)

  /* useGLTF returns scene + animations (may be undefined while loading) */
  const gltf       = useGLTF(model.url)
  const scene      = gltf?.scene
  const animations = gltf?.animations ?? []   // ALWAYS an array

  const store = useStore()
  const {
    selectedModelId, transformMode,
    updateModelTransform, setModelAnimations, setModelAnimPlaying,
    selectModel, currentFrame, keyframes,
    snapEnabled, snapTranslate, snapRotate, snapScale,
    physicsEnabled, physicsConnected, modelPhysics,
  } = store

  const isSelected    = selectedModelId === model.id
  const isRenderMode  = useStore(s => !!(s.isRenderMode || s.isExporting))

  /* ── deep-clone scene preserving skinned meshes ──────────────────────── */
  const clonedScene = useMemo(() => {
    if (!scene) return null
    const clone    = scene.clone(true)
    const srcBones = [], dstBones = []
    scene.traverse(n => { if (n.isBone) srcBones.push(n) })
    clone.traverse(n => { if (n.isBone) dstBones.push(n) })
    clone.traverse(child => {
      if (child.isSkinnedMesh && child.skeleton) {
        const bones = child.skeleton.bones.map(b => {
          const i = srcBones.indexOf(b)
          return i !== -1 ? dstBones[i] : b
        })
        child.skeleton = new THREE.Skeleton(bones, child.skeleton.boneInverses)
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

  /* ── AnimationMixer ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!clonedScene) return
    if (!animations || animations.length === 0) return   // double-guard

    const mixer = new THREE.AnimationMixer(clonedScene)
    mixerRef.current = mixer

    const map = {}
    animations.forEach(clip => {
      if (!clip?.name) return
      const action = mixer.clipAction(clip, clonedScene)
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.clampWhenFinished = false
      map[clip.name] = action
    })
    actionsRef.current = map

    const names = Object.keys(map)
    if (names.length > 0) {
      setModelAnimations(model.id, names)
      const cur = useStore.getState().models.find(m => m.id === model.id)?.activeAnimation
      const first = cur || names[0]
      if (map[first]) { map[first].play(); curAnimRef.current = first }
      setModelAnimPlaying(model.id, true)
    }

    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(clonedScene)
      mixerRef.current = null
      actionsRef.current = {}
      curAnimRef.current = null
    }
  }, [clonedScene, animations.length, model.id]) // animations.length: safe number dep

  /* ── Switch animation clip ───────────────────────────────────────────── */
  useEffect(() => {
    const mixer = mixerRef.current
    const acts  = actionsRef.current
    if (!mixer || !model.activeAnimation) return
    const target = model.activeAnimation
    if (curAnimRef.current === target) {
      const cur = acts[target]
      if (cur) { cur.paused = !model.animationPlaying; cur.setEffectiveTimeScale(model.animationSpeed ?? 1) }
      return
    }
    const prev = acts[curAnimRef.current]
    const next = acts[target]
    if (!next) return
    if (prev && prev !== next) { prev.fadeOut(0.25); next.reset().fadeIn(0.25) } else next.reset()
    if (model.animationPlaying) next.play(); else { next.play(); next.paused = true }
    next.setEffectiveTimeScale(model.animationSpeed ?? 1)
    curAnimRef.current = target
  }, [model.activeAnimation, model.animationPlaying, model.animationSpeed])

  /* ── Tick mixer ──────────────────────────────────────────────────────── */
  useFrame((_, dt) => { mixerRef.current?.update(dt) })

  /* ── Physics registration ────────────────────────────────────────────── */
  useEffect(() => {
    if (!physicsEnabled || !physicsConnected || !groupRef.current) {
      physActiveRef.current = false
      return
    }
    const props = modelPhysics?.[model.id] ?? {}
    physFns().then(({ reg, unreg }) => {
      if (!groupRef.current) return
      reg(model.id, groupRef.current, {
        mass:           props.mass           ?? 1,
        type:           props.type           ?? 'static',
        linearDamping:  props.damping        ?? 0.3,
        angularDamping: props.angularDamping ?? 0.5,
        friction:       props.friction       ?? 0.4,
        restitution:    props.restitution    ?? 0.2,
        centerOfMassY:  props.centerOfMassY  ?? 0,
        collisionShape: props.collisionShape ?? 'box',
        ccdRadius:      props.ccdRadius      ?? 0,
      })
      physActiveRef.current = true
    })
    return () => {
      physFns().then(({ unreg }) => { unreg(model.id); physActiveRef.current = false })
    }
  }, [physicsEnabled, physicsConnected, model.id,
      JSON.stringify(modelPhysics?.[model.id])])  // safe stringify

  /* ── Material overrides ──────────────────────────────────────────────── */
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

  /* ── Shadow settings ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!clonedScene) return
    clonedScene.traverse(child => {
      if (child.isMesh) {
        child.castShadow    = model.castShadow    ?? true
        child.receiveShadow = model.receiveShadow ?? true
      }
    })
  }, [model.castShadow, model.receiveShadow, clonedScene])

  /* ── Store position → mesh (skipped when physics owns the body) ──────── */
  useEffect(() => {
    if (!groupRef.current || physActiveRef.current) return
    const s   = useStore.getState()
    const src = s.interpolateAtFrame(model.id, currentFrame) || model
    groupRef.current.position.set(...src.position)
    groupRef.current.rotation.set(...src.rotation)
    groupRef.current.scale.set(...src.scale)
  }, [currentFrame, keyframes, model.position, model.rotation, model.scale])

  /* ── TransformControls → store ───────────────────────────────────────── */
  const onTCChange = useCallback(() => {
    if (!groupRef.current) return
    const p  = groupRef.current.position
    const r  = groupRef.current.rotation
    const sc = groupRef.current.scale
    updateModelTransform(model.id, 'position', [p.x, p.y, p.z])
    updateModelTransform(model.id, 'rotation', [r.x, r.y, r.z])
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

        {isSelected && !isRenderMode && (
          <mesh rotation={[-Math.PI/2, 0, 0]}>
            <ringGeometry args={[0.9, 1.05, 64]} />
            <meshBasicMaterial color="#4f8eff" transparent opacity={0.55}
              side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        )}
      </group>

      {/* key={model.id} forces remount → always attaches to correct mesh */}
      {isSelected && !isRenderMode && groupRef.current && (
        <TransformControls
          key={`tc-${model.id}`}
          object={groupRef.current}
          mode={transformMode}
          onChange={onTCChange}
          translationSnap={snapEnabled ? snapTranslate  : null}
          rotationSnap={snapEnabled    ? (snapRotate * Math.PI / 180) : null}
          scaleSnap={snapEnabled       ? snapScale : null}
          size={0.8}
        />
      )}
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   ModelManager — renders all models
   ═══════════════════════════════════════════════════════════════════════════ */
export default function ModelManager() {
  const models = useStore(s => s.models)
  if (!models || models.length === 0) return null
  return (
    <>
      {models.map(model => (
        <ModelMesh key={`${model.id}__${model.url}`} model={model} />
      ))}
    </>
  )
}
