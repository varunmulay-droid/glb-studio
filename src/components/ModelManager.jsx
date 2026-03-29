/**
 * ModelManager.jsx
 * Renders all GLB models in the Three.js scene.
 * Fixes:
 *  - Animation detection: registers ALL clips from GLB immediately on load
 *  - Animation playback: auto-plays first clip, responds to animationPlaying state
 *  - Mixer update: driven by useFrame so clips actually animate
 *  - Transform sync: bidirectional (store ↔ TransformControls)
 *  - Clone: properly clones scene so multiple instances don't share geometry
 */
import { useEffect, useRef, useMemo } from 'react'
import { useGLTF, useAnimations, TransformControls } from '@react-three/drei'
import { useFrame }   from '@react-three/fiber'
import * as THREE     from 'three'
import useStore       from '../store/useStore'

function ModelMesh({ model }) {
  const groupRef     = useRef()
  const mixerRef     = useRef(null)
  const actionsRef   = useRef({})
  const currentAnimRef = useRef(null)

  const { scene, animations } = useGLTF(model.url)

  const {
    selectedModelId, transformMode,
    updateModelTransform, setModelAnimations, setModelAnimPlaying,
    selectModel, currentFrame, keyframes,
    snapEnabled, snapTranslate, snapRotate, snapScale,
  } = useStore()

  const isSelected  = selectedModelId === model.id
  const isRenderMode = useStore.getState().isRenderMode || useStore.getState().isExporting

  // ── Clone scene using SkeletonUtils for correct bone cloning ──────────────
  const clonedScene = useMemo(() => {
    // Deep clone preserving skeleton/skinned mesh properly
    const clone = scene.clone(true)
    // Re-bind skinned meshes to cloned skeleton
    const srcBones = []
    const dstBones = []
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
    })
    clone.traverse(child => {
      if (child.isMesh) {
        child.castShadow    = true
        child.receiveShadow = true
        if (child.material) {
          child.material = Array.isArray(child.material)
            ? child.material.map(m => m.clone())
            : child.material.clone()
        }
      }
    })
    return clone
  }, [scene])

  // ── Set up AnimationMixer + register all clips ────────────────────────────
  useEffect(() => {
    if (!clonedScene) return

    // Create mixer on the cloned scene root
    const mixer = new THREE.AnimationMixer(clonedScene)
    mixerRef.current = mixer

    if (animations && animations.length > 0) {
      const actionMap = {}
      animations.forEach(clip => {
        // Re-target clip to cloned scene bones
        const action = mixer.clipAction(clip, clonedScene)
        action.setLoop(THREE.LoopRepeat, Infinity)
        action.clampWhenFinished = false
        actionMap[clip.name] = action
      })
      actionsRef.current = actionMap

      // Register animation names to store
      const names = animations.map(a => a.name)
      setModelAnimations(model.id, names)

      // Auto-play first clip if model has no active animation set
      const activeAnim = useStore.getState().models.find(m => m.id === model.id)?.activeAnimation
      const firstClip  = activeAnim || names[0]
      if (firstClip && actionMap[firstClip]) {
        actionMap[firstClip].play()
        currentAnimRef.current = firstClip
      }

      // Mark as playing
      setModelAnimPlaying(model.id, true)
    }

    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(clonedScene)
    }
  }, [clonedScene, animations, model.id])

  // ── React to animation changes from store ─────────────────────────────────
  useEffect(() => {
    const mixer   = mixerRef.current
    const actions = actionsRef.current
    if (!mixer || !model.activeAnimation) return

    const targetAnim = model.activeAnimation
    if (currentAnimRef.current === targetAnim && model.animationPlaying) return

    // Cross-fade to new animation
    const prevAction = actions[currentAnimRef.current]
    const nextAction = actions[targetAnim]

    if (nextAction) {
      if (prevAction && prevAction !== nextAction) {
        prevAction.fadeOut(0.3)
        nextAction.reset().fadeIn(0.3)
      } else {
        nextAction.reset()
      }

      if (model.animationPlaying) {
        nextAction.play()
      } else {
        nextAction.play()
        nextAction.paused = true
      }

      nextAction.setEffectiveTimeScale(model.animationSpeed || 1)
      currentAnimRef.current = targetAnim
    }
  }, [model.activeAnimation, model.animationPlaying, model.animationSpeed])

  // ── Play/pause toggle ─────────────────────────────────────────────────────
  useEffect(() => {
    const actions = actionsRef.current
    const cur     = currentAnimRef.current
    if (!cur || !actions[cur]) return
    actions[cur].paused = !model.animationPlaying
  }, [model.animationPlaying])

  // ── Speed changes ─────────────────────────────────────────────────────────
  useEffect(() => {
    const actions = actionsRef.current
    Object.values(actions).forEach(a => {
      a.setEffectiveTimeScale(model.animationSpeed || 1)
    })
  }, [model.animationSpeed])

  // ── Apply material overrides from store ──────────────────────────────────
  useEffect(() => {
    if (!clonedScene) return
    const mat = model.materialOverride
    clonedScene.traverse(child => {
      if (!child.isMesh || !child.material) return
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      mats.forEach(m => {
        if (mat?.color !== undefined)     m.color?.set(mat.color)
        if (mat?.roughness !== undefined) m.roughness = mat.roughness
        if (mat?.metalness !== undefined) m.metalness = mat.metalness
        if (mat?.opacity !== undefined)   { m.opacity = mat.opacity; m.transparent = mat.opacity < 1 }
        if (mat?.wireframe !== undefined) m.wireframe = !!mat.wireframe
        if (!mat) {
          // Reset - use original material stored at load
          m.wireframe = false
          if (m.opacity !== undefined) { m.opacity=1; m.transparent=false }
        }
        m.needsUpdate = true
      })
    })
  }, [model.materialOverride, clonedScene])

  // ── Tick mixer ───────────────────────────────────────────────────────────
  // ── Shadow settings ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!clonedScene) return
    clonedScene.traverse(child => {
      if (child.isMesh) {
        child.castShadow    = model.castShadow    ?? true
        child.receiveShadow = model.receiveShadow ?? true
      }
    })
  }, [model.castShadow, model.receiveShadow, clonedScene])

  useFrame((_, delta) => {
    mixerRef.current?.update(delta)
  })

  // ── Sync position from store (and keyframe interpolation) ─────────────────
  useEffect(() => {
    if (!groupRef.current) return
    const store = useStore.getState()
    const interpolated = store.interpolateAtFrame(model.id, currentFrame)
    const src = interpolated || model
    groupRef.current.position.set(...src.position)
    groupRef.current.rotation.set(...src.rotation)
    groupRef.current.scale.set(...src.scale)
  }, [currentFrame, keyframes, model.position, model.rotation, model.scale])

  // ── Handle TransformControls drag ─────────────────────────────────────────
  const onTransformChange = () => {
    if (!groupRef.current) return
    const p = groupRef.current.position
    const r = groupRef.current.rotation
    const sc = groupRef.current.scale
    updateModelTransform(model.id, 'position', [p.x,  p.y,  p.z])
    updateModelTransform(model.id, 'rotation', [r.x,  r.y,  r.z])
    updateModelTransform(model.id, 'scale',    [sc.x, sc.y, sc.z])
  }

  if (!model.visible) return null

  return (
    <>
      <group
        ref={groupRef}
        onClick={e => { e.stopPropagation(); selectModel(model.id) }}
      >
        <primitive object={clonedScene} />

        {/* Selection indicator — hidden during render */}
        {isSelected && !isRenderMode && (
          <mesh rotation={[-Math.PI/2, 0, 0]}>
            <ringGeometry args={[0.85, 1.0, 48]} />
            <meshBasicMaterial color="#4f8eff" transparent opacity={0.7}
              side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        )}
      </group>

      {isSelected && !isRenderMode && (
        <TransformControls
          object={groupRef}
          mode={transformMode}
          onObjectChange={onTransformChange}
          size={0.75}
          translationSnap={snapEnabled ? snapTranslate : null}
          rotationSnap={snapEnabled ? (snapRotate * Math.PI/180) : null}
          scaleSnap={snapEnabled ? snapScale : null}
        />
      )}
    </>
  )
}

export default function ModelManager() {
  const models = useStore(s => s.models)
  return (
    <>
      {models.map(model => (
        <ModelMesh key={`${model.id}-${model.url}`} model={model} />
      ))}
    </>
  )
}
