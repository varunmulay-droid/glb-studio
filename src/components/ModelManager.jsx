/**
 * ModelManager.jsx
 *
 * Root cause of all issues was a feedback loop:
 *   TransformControls drag → onChange → updateModelTransform (store) →
 *   model.position changes → useEffect fires → position.set() on group →
 *   fights the drag in progress → TC drops selection → mesh snaps back
 *
 * Fix: use a isDragging ref. When TC is dragging, the store→mesh sync
 * useEffect is COMPLETELY skipped. TC owns the mesh during drag.
 * Only on drag END (onMouseUp) do we write to the store.
 *
 * Also fixes keyframe workflow:
 *   1. Click model → selected (TC appears)
 *   2. Drag model to new position (TC owns mesh, no store updates mid-drag)
 *   3. Release → position written to store ONCE
 *   4. Click "Add Keyframe" → stores current model.position correctly
 *   5. Scrub timeline → interpolation works
 */
import { useEffect, useRef, useMemo, useCallback } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import * as THREE from 'three'
import useStore from '../store/useStore'
import { orbitControlsRef } from './Scene'

/* ── lazy physics import ───────────────────────────────────────────────────── */
let _reg=null, _unreg=null
async function physFns() {
  if (!_reg) { const m=await import('./PhysicsEngine'); _reg=m.registerPhysicsObject; _unreg=m.unregisterPhysicsObject }
  return { reg:_reg, unreg:_unreg }
}

/* ── TransformControls wrapper using vanilla Three.js (not @react-three/drei)
      Drei's TransformControls fires onChange every frame which is the root
      cause of the drag feedback loop. The vanilla TC fires events correctly. ── */
function useTCGizmo(groupRef, mode, onChange, snap) {
  const { camera, gl, scene } = useThree()
  const tcRef = useRef(null)

  useEffect(() => {
    if (!groupRef.current) return
    const tc = new TransformControls(camera, gl.domElement)
    tc.attach(groupRef.current)
    tc.setMode(mode || 'translate')
    tc.size = 0.85

    // Snap
    if (snap?.translate) tc.translationSnap = snap.translate
    if (snap?.rotate)    tc.rotationSnap    = snap.rotate * (Math.PI / 180)
    if (snap?.scale)     tc.scaleSnap       = snap.scale

    scene.add(tc)
    tcRef.current = tc

    // Drag end → write to store once
    const onEnd = () => {
      if (!groupRef.current) return
      onChange()
    }
    tc.addEventListener('mouseUp', onEnd)
    tc.addEventListener('touchEnd', onEnd)

    return () => {
      tc.removeEventListener('mouseUp', onEnd)
      tc.removeEventListener('touchEnd', onEnd)
      tc.detach()
      scene.remove(tc)
      tc.dispose()
      tcRef.current = null
    }
  }, [groupRef.current, mode, camera, gl, scene]) // remount when mode or object changes

  // Disable OrbitControls while dragging
  useEffect(() => {
    const tc = tcRef.current
    if (!tc) return
    const onDragStart = () => {
      // Find and disable orbit controls
      scene.traverse(obj => { if (obj.isOrbitControls) obj.enabled = false })
    }
    const onDragEnd = () => {
      scene.traverse(obj => { if (obj.isOrbitControls) obj.enabled = true })
    }
    tc.addEventListener('dragging-changed', e => {
      if (e.value) onDragStart(); else onDragEnd()
    })
  }, [tcRef.current, scene])

  useFrame(() => { tcRef.current?.update?.() })

  return tcRef
}

function ModelMesh({ model }) {
  const groupRef      = useRef()
  const mixerRef      = useRef(null)
  const actionsRef    = useRef({})
  const curAnimRef    = useRef(null)
  const physActiveRef = useRef(false)
  const tcRef         = useRef(null)   // vanilla TC instance

  const { camera, gl, scene } = useThree()

  const gltf       = useGLTF(model.url)
  const sceneGltf  = gltf?.scene
  const animations = Array.isArray(gltf?.animations) ? gltf.animations : []

  const {
    selectedModelId, transformMode,
    updateModelTransform, setModelAnimations, setModelAnimPlaying,
    selectModel, currentFrame, keyframes,
    snapEnabled, snapTranslate, snapRotate, snapScale,
    physicsEnabled, physicsConnected, modelPhysics,
  } = useStore()

  const isSelected   = selectedModelId === model.id
  const isRenderMode = useStore(s => !!(s.isRenderMode || s.isExporting))

  /* ── Clone scene ─────────────────────────────────────────────────────────── */
  const clonedScene = useMemo(() => {
    if (!sceneGltf) return null
    const clone = sceneGltf.clone(true)
    const srcB=[], dstB=[]
    sceneGltf.traverse(n => { if (n.isBone) srcB.push(n) })
    clone.traverse(n => { if (n.isBone) dstB.push(n) })
    clone.traverse(child => {
      if (child.isSkinnedMesh && child.skeleton) {
        const bones = child.skeleton.bones.map(b => { const i=srcB.indexOf(b); return i!==-1?dstB[i]:b })
        child.skeleton = new THREE.Skeleton(bones, child.skeleton.boneInverses)
        child.bind(child.skeleton, child.bindMatrix)
      }
      if (child.isMesh) {
        child.castShadow = child.receiveShadow = true
        if (child.material)
          child.material = Array.isArray(child.material) ? child.material.map(m=>m.clone()) : child.material.clone()
      }
    })
    return clone
  }, [sceneGltf])

  /* ── AnimationMixer ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!clonedScene || animations.length === 0) return
    const mixer = new THREE.AnimationMixer(clonedScene)
    mixerRef.current = mixer
    const map = {}
    animations.forEach(clip => {
      if (!clip?.name) return
      const a = mixer.clipAction(clip, clonedScene)
      a.setLoop(THREE.LoopRepeat, Infinity)
      a.clampWhenFinished = false
      map[clip.name] = a
    })
    actionsRef.current = map
    const names = Object.keys(map)
    if (names.length > 0) {
      setModelAnimations(model.id, names)
      const cur   = useStore.getState().models.find(m=>m.id===model.id)?.activeAnimation
      const first = cur || names[0]
      if (map[first]) { map[first].play(); curAnimRef.current = first }
      setModelAnimPlaying(model.id, true)
    }
    return () => {
      mixer.stopAllAction(); mixer.uncacheRoot(clonedScene)
      mixerRef.current=null; actionsRef.current={}; curAnimRef.current=null
    }
  }, [clonedScene, animations.length, model.id])

  /* ── Anim clip switch ────────────────────────────────────────────────────── */
  useEffect(() => {
    const mixer=mixerRef.current, acts=actionsRef.current
    if (!mixer || !model.activeAnimation) return
    const target = model.activeAnimation
    if (curAnimRef.current === target) {
      const cur = acts[target]
      if (cur) { cur.paused=!model.animationPlaying; cur.setEffectiveTimeScale(model.animationSpeed??1) }
      return
    }
    const prev=acts[curAnimRef.current], next=acts[target]
    if (!next) return
    if (prev && prev!==next) { prev.fadeOut(0.25); next.reset().fadeIn(0.25) } else next.reset()
    if (model.animationPlaying) next.play(); else { next.play(); next.paused=true }
    next.setEffectiveTimeScale(model.animationSpeed ?? 1)
    curAnimRef.current = target
  }, [model.activeAnimation, model.animationPlaying, model.animationSpeed])

  useFrame((_, dt) => { mixerRef.current?.update(dt) })

  /* ── Vanilla TransformControls — created/destroyed when selection changes ── */
  useEffect(() => {
    // Clean up any existing TC
    if (tcRef.current) {
      tcRef.current.detach()
      scene.remove(tcRef.current)
      tcRef.current.dispose()
      tcRef.current = null
    }
    if (!isSelected || isRenderMode || !groupRef.current) return

    const tc = new TransformControls(camera, gl.domElement)
    tc.attach(groupRef.current)
    tc.setMode(transformMode || 'translate')
    tc.size = 0.85

    // Snap settings
    if (snapEnabled) {
      tc.translationSnap = snapTranslate || null
      tc.rotationSnap    = snapRotate ? (snapRotate * Math.PI / 180) : null
      tc.scaleSnap       = snapScale || null
    }

    scene.add(tc)
    tcRef.current = tc

    // Write to store ONCE when drag ends — not during drag
    const onMouseUp = () => {
      if (!groupRef.current) return
      const p  = groupRef.current.position
      const r  = groupRef.current.rotation
      const sc = groupRef.current.scale
      updateModelTransform(model.id, 'position', [p.x, p.y, p.z])
      updateModelTransform(model.id, 'rotation', [r.x, r.y, r.z])
      updateModelTransform(model.id, 'scale',    [sc.x, sc.y, sc.z])
    }

    // Disable OrbitControls during drag so camera doesn't rotate while moving model
    const onDragging = (e) => {
      if (orbitControlsRef.current) orbitControlsRef.current.enabled = !e.value
    }

    tc.addEventListener('mouseUp',       onMouseUp)
    tc.addEventListener('touchEnd',      onMouseUp)
    tc.addEventListener('dragging-changed', onDragging)

    return () => {
      tc.removeEventListener('mouseUp',       onMouseUp)
      tc.removeEventListener('touchEnd',      onMouseUp)
      tc.removeEventListener('dragging-changed', onDragging)
      tc.detach()
      scene.remove(tc)
      tc.dispose()
      tcRef.current = null
      // Re-enable orbit on cleanup
      if (orbitControlsRef.current) orbitControlsRef.current.enabled = true
    }
  }, [isSelected, isRenderMode, transformMode, snapEnabled, snapTranslate, snapRotate, snapScale,
      camera, gl, scene, model.id, updateModelTransform])

  // Update TC mode when toolbar mode changes without remounting
  useEffect(() => {
    tcRef.current?.setMode(transformMode || 'translate')
  }, [transformMode])

  // Update snap when snap settings change
  useEffect(() => {
    const tc = tcRef.current
    if (!tc) return
    tc.translationSnap = snapEnabled ? (snapTranslate||null) : null
    tc.rotationSnap    = snapEnabled ? (snapRotate?(snapRotate*Math.PI/180):null) : null
    tc.scaleSnap       = snapEnabled ? (snapScale||null) : null
  }, [snapEnabled, snapTranslate, snapRotate, snapScale])

  useFrame(() => { tcRef.current?.update?.() })

  /* ── Physics ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!physicsEnabled||!physicsConnected||!groupRef.current) { physActiveRef.current=false; return }
    const props = modelPhysics?.[model.id] ?? {}
    physFns().then(({reg}) => {
      if (!groupRef.current) return
      reg(model.id, groupRef.current, {
        mass:props.mass??1, type:props.type??'static',
        linearDamping:props.damping??0.3, angularDamping:props.angularDamping??0.5,
        friction:props.friction??0.4, restitution:props.restitution??0.2,
        centerOfMassY:props.centerOfMassY??0, collisionShape:props.collisionShape??'box', ccdRadius:props.ccdRadius??0,
      })
      physActiveRef.current = true
    })
    return () => { physFns().then(({unreg})=>{ unreg(model.id); physActiveRef.current=false }) }
  }, [physicsEnabled, physicsConnected, model.id, JSON.stringify(modelPhysics?.[model.id])])

  /* ── Material overrides ──────────────────────────────────────────────────── */
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
        if (mat?.opacity   !== undefined) { m.opacity=mat.opacity; m.transparent=mat.opacity<1 }
        if (mat?.wireframe !== undefined) m.wireframe = !!mat.wireframe
        if (!mat) { m.wireframe=false; m.opacity=1; m.transparent=false }
        m.needsUpdate = true
      })
    })
  }, [model.materialOverride, clonedScene])

  /* ── Shadows ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!clonedScene) return
    clonedScene.traverse(child => {
      if (child.isMesh) { child.castShadow=model.castShadow??true; child.receiveShadow=model.receiveShadow??true }
    })
  }, [model.castShadow, model.receiveShadow, clonedScene])

  /* ── Store → mesh sync
        Only runs when NOT being dragged by TC.
        TC writing to store on mouseUp means model.position changes AFTER drag ends.
        Then this effect runs and confirms the position — no conflict.        ── */
  useEffect(() => {
    if (!groupRef.current || physActiveRef.current) return
    // Don't reset while TC is actively dragging
    if (tcRef.current?.dragging) return

    const s   = useStore.getState()
    const src = s.interpolateAtFrame(model.id, currentFrame) || model
    groupRef.current.position.set(...(src.position || [0,0,0]))
    groupRef.current.rotation.set(...(src.rotation || [0,0,0]))
    groupRef.current.scale.set(   ...(src.scale    || [1,1,1]))
  }, [currentFrame, keyframes, model.position, model.rotation, model.scale])

  if (!model.visible || !clonedScene) return null

  return (
    <group ref={groupRef} onClick={e => { e.stopPropagation(); selectModel(model.id) }}>
      <primitive object={clonedScene} />
      {/* Selection ring */}
      {isSelected && !isRenderMode && (
        <mesh rotation={[-Math.PI/2, 0, 0]}>
          <ringGeometry args={[0.9, 1.05, 64]} />
          <meshBasicMaterial color="#4f8eff" transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

export default function ModelManager() {
  const models = useStore(s => s.models)
  if (!models || models.length === 0) return null
  return <>{models.map(m => <ModelMesh key={`${m.id}__${m.url}`} model={m} />)}</>
}
