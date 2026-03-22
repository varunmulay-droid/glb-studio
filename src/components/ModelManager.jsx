import { useEffect, useRef, useMemo } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import useStore from '../store/useStore'

function ModelMesh({ model }) {
  const groupRef = useRef()
  const transformRef = useRef()
  const { scene, animations } = useGLTF(model.url)
  const { actions, mixer } = useAnimations(animations, groupRef)

  const {
    selectedModelId, transformMode,
    updateModelTransform, setModelAnimations,
    selectModel, currentFrame, isPlaying,
    interpolateAtFrame, keyframes
  } = useStore()

  const isSelected = selectedModelId === model.id

  // Clone scene to avoid sharing
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    return clone
  }, [scene])

  // Register available animations
  useEffect(() => {
    if (animations.length > 0) {
      setModelAnimations(model.id, animations.map(a => a.name))
    }
  }, [animations, model.id])

  // Play/pause animation
  useEffect(() => {
    if (!actions || !model.activeAnimation) return
    Object.values(actions).forEach(a => a?.stop())
    const action = actions[model.activeAnimation]
    if (action) {
      action.setEffectiveTimeScale(model.animationSpeed)
      if (model.animationPlaying || isPlaying) {
        action.play()
      }
    }
  }, [model.activeAnimation, model.animationPlaying, model.animationSpeed, actions, isPlaying])

  // Apply interpolated transforms during playback / scrubbing
  useEffect(() => {
    const interpolated = interpolateAtFrame(model.id, currentFrame)
    if (interpolated && groupRef.current) {
      groupRef.current.position.set(...interpolated.position)
      groupRef.current.rotation.set(...interpolated.rotation)
      groupRef.current.scale.set(...interpolated.scale)
    } else if (groupRef.current) {
      groupRef.current.position.set(...model.position)
      groupRef.current.rotation.set(...model.rotation)
      groupRef.current.scale.set(...model.scale)
    }
  }, [currentFrame, keyframes, model.position, model.rotation, model.scale])

  // Apply model transforms
  useEffect(() => {
    if (!groupRef.current) return
    groupRef.current.position.set(...model.position)
    groupRef.current.rotation.set(...model.rotation)
    groupRef.current.scale.set(...model.scale)
  }, [model.position, model.rotation, model.scale])

  // Listen to transform control changes
  const handleTransformChange = () => {
    if (!groupRef.current) return
    const pos = groupRef.current.position
    const rot = groupRef.current.rotation
    const sc = groupRef.current.scale
    updateModelTransform(model.id, 'position', [pos.x, pos.y, pos.z])
    updateModelTransform(model.id, 'rotation', [rot.x, rot.y, rot.z])
    updateModelTransform(model.id, 'scale', [sc.x, sc.y, sc.z])
  }

  if (!model.visible) return null

  return (
    <>
      <group
        ref={groupRef}
        onClick={(e) => { e.stopPropagation(); selectModel(model.id) }}
      >
        <primitive object={clonedScene} />
        {/* Selection ring */}
        {isSelected && (
          <mesh>
            <ringGeometry args={[0.8, 0.9, 32]} />
            <meshBasicMaterial color="#00f5ff" transparent opacity={0.6} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>

      {isSelected && (
        <TransformControls
          ref={transformRef}
          object={groupRef}
          mode={transformMode}
          onObjectChange={handleTransformChange}
          size={0.7}
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
        <ModelMesh key={model.id} model={model} />
      ))}
    </>
  )
}
