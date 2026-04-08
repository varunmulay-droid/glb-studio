import { useEffect, useRef, useMemo, useCallback } from 'react'
import { useGLTF, TransformControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import useStore from '../store/useStore'

let _reg=null, _unreg=null
async function physFns() {
  if (!_reg) { const m=await import('./PhysicsEngine'); _reg=m.registerPhysicsObject; _unreg=m.unregisterPhysicsObject }
  return { reg:_reg, unreg:_unreg }
}

function ModelMesh({ model }) {
  const groupRef      = useRef()
  const mixerRef      = useRef(null)
  const actionsRef    = useRef({})
  const curAnimRef    = useRef(null)
  const physActiveRef = useRef(false)

  const gltf       = useGLTF(model.url)
  const scene      = gltf?.scene
  const animations = Array.isArray(gltf?.animations) ? gltf.animations : []

  const {
    selectedModelId, transformMode,
    updateModelTransform, setModelAnimations, setModelAnimPlaying,
    selectModel, currentFrame, keyframes,
    snapEnabled, snapTranslate, snapRotate, snapScale,
    physicsEnabled, physicsConnected, modelPhysics,
  } = useStore()

  const isSelected  = selectedModelId === model.id
  const isRenderMode= useStore(s => !!(s.isRenderMode||s.isExporting))

  const clonedScene = useMemo(() => {
    if (!scene) return null
    const clone=scene.clone(true), srcB=[], dstB=[]
    scene.traverse(n => { if (n.isBone) srcB.push(n) })
    clone.traverse(n => { if (n.isBone) dstB.push(n) })
    clone.traverse(child => {
      if (child.isSkinnedMesh && child.skeleton) {
        const bones=child.skeleton.bones.map(b=>{ const i=srcB.indexOf(b); return i!==-1?dstB[i]:b })
        child.skeleton=new THREE.Skeleton(bones,child.skeleton.boneInverses)
        child.bind(child.skeleton,child.bindMatrix)
      }
      if (child.isMesh) {
        child.castShadow=child.receiveShadow=true
        if (child.material) child.material=Array.isArray(child.material)?child.material.map(m=>m.clone()):child.material.clone()
      }
    })
    return clone
  }, [scene])

  // Mixer
  useEffect(() => {
    if (!clonedScene || animations.length===0) return
    const mixer=new THREE.AnimationMixer(clonedScene)
    mixerRef.current=mixer
    const map={}
    animations.forEach(clip => {
      if (!clip?.name) return
      const a=mixer.clipAction(clip,clonedScene)
      a.setLoop(THREE.LoopRepeat,Infinity); a.clampWhenFinished=false
      map[clip.name]=a
    })
    actionsRef.current=map
    const names=Object.keys(map)
    if (names.length>0) {
      setModelAnimations(model.id,names)
      const cur=useStore.getState().models.find(m=>m.id===model.id)?.activeAnimation
      const first=cur||names[0]
      if (map[first]) { map[first].play(); curAnimRef.current=first }
      setModelAnimPlaying(model.id,true)
    }
    return () => { mixer.stopAllAction(); mixer.uncacheRoot(clonedScene); mixerRef.current=null; actionsRef.current={}; curAnimRef.current=null }
  }, [clonedScene, animations.length, model.id])

  // Switch anim
  useEffect(() => {
    const mixer=mixerRef.current, acts=actionsRef.current
    if (!mixer||!model.activeAnimation) return
    const target=model.activeAnimation
    if (curAnimRef.current===target) {
      const cur=acts[target]
      if (cur) { cur.paused=!model.animationPlaying; cur.setEffectiveTimeScale(model.animationSpeed??1) }
      return
    }
    const prev=acts[curAnimRef.current], next=acts[target]
    if (!next) return
    if (prev&&prev!==next) { prev.fadeOut(0.25); next.reset().fadeIn(0.25) } else next.reset()
    if (model.animationPlaying) next.play(); else { next.play(); next.paused=true }
    next.setEffectiveTimeScale(model.animationSpeed??1)
    curAnimRef.current=target
  }, [model.activeAnimation,model.animationPlaying,model.animationSpeed])

  useFrame((_,dt) => { mixerRef.current?.update(dt) })

  // Physics
  useEffect(() => {
    if (!physicsEnabled||!physicsConnected||!groupRef.current) { physActiveRef.current=false; return }
    const props=modelPhysics?.[model.id]??{}
    physFns().then(({reg,unreg}) => {
      if (!groupRef.current) return
      reg(model.id,groupRef.current,{
        mass:props.mass??1, type:props.type??'static',
        linearDamping:props.damping??0.3, angularDamping:props.angularDamping??0.5,
        friction:props.friction??0.4, restitution:props.restitution??0.2,
        centerOfMassY:props.centerOfMassY??0, collisionShape:props.collisionShape??'box', ccdRadius:props.ccdRadius??0,
      })
      physActiveRef.current=true
    })
    return () => { physFns().then(({unreg})=>{ unreg(model.id); physActiveRef.current=false }) }
  }, [physicsEnabled,physicsConnected,model.id,JSON.stringify(modelPhysics?.[model.id])])

  // Material
  useEffect(() => {
    if (!clonedScene) return
    const mat=model.materialOverride
    clonedScene.traverse(child => {
      if (!child.isMesh||!child.material) return
      const mats=Array.isArray(child.material)?child.material:[child.material]
      mats.forEach(m => {
        if (mat?.color!==undefined)     m.color?.set(mat.color)
        if (mat?.roughness!==undefined) m.roughness=mat.roughness
        if (mat?.metalness!==undefined) m.metalness=mat.metalness
        if (mat?.opacity!==undefined)   { m.opacity=mat.opacity; m.transparent=mat.opacity<1 }
        if (mat?.wireframe!==undefined) m.wireframe=!!mat.wireframe
        if (!mat)                       { m.wireframe=false; m.opacity=1; m.transparent=false }
        m.needsUpdate=true
      })
    })
  }, [model.materialOverride,clonedScene])

  // Shadows
  useEffect(() => {
    if (!clonedScene) return
    clonedScene.traverse(child => { if (child.isMesh) { child.castShadow=model.castShadow??true; child.receiveShadow=model.receiveShadow??true } })
  }, [model.castShadow,model.receiveShadow,clonedScene])

  // Store→mesh (skip if physics owns it)
  useEffect(() => {
    if (!groupRef.current||physActiveRef.current) return
    const s=useStore.getState()
    const src=s.interpolateAtFrame(model.id,currentFrame)||model
    groupRef.current.position.set(...src.position)
    groupRef.current.rotation.set(...src.rotation)
    groupRef.current.scale.set(...src.scale)
  }, [currentFrame,keyframes,model.position,model.rotation,model.scale])

  const onTCChange = useCallback(() => {
    if (!groupRef.current) return
    const p=groupRef.current.position, r=groupRef.current.rotation, sc=groupRef.current.scale
    updateModelTransform(model.id,'position',[p.x,p.y,p.z])
    updateModelTransform(model.id,'rotation',[r.x,r.y,r.z])
    updateModelTransform(model.id,'scale',[sc.x,sc.y,sc.z])
  }, [model.id,updateModelTransform])

  if (!model.visible||!clonedScene) return null

  return (
    <>
      <group ref={groupRef} onClick={e => { e.stopPropagation(); selectModel(model.id) }}>
        <primitive object={clonedScene} />
        {isSelected&&!isRenderMode && (
          <mesh rotation={[-Math.PI/2,0,0]}>
            <ringGeometry args={[0.9,1.05,64]} />
            <meshBasicMaterial color="#4f8eff" transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        )}
      </group>
      {isSelected&&!isRenderMode&&groupRef.current && (
        <TransformControls
          key={`tc-${model.id}`}
          object={groupRef.current}
          mode={transformMode}
          onChange={onTCChange}
          translationSnap={snapEnabled?snapTranslate:null}
          rotationSnap={snapEnabled?(snapRotate*Math.PI/180):null}
          scaleSnap={snapEnabled?snapScale:null}
          size={0.8}
        />
      )}
    </>
  )
}

export default function ModelManager() {
  const models = useStore(s => s.models)
  if (!models||models.length===0) return null
  return <>{models.map(m => <ModelMesh key={`${m.id}__${m.url}`} model={m} />)}</>
}
