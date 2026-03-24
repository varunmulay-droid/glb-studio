/**
 * PhysicsEngine.jsx
 * Cannon-es physics world integrated with React Three Fiber.
 * Auto-applies physics bodies to every GLB model in the scene.
 * Supports: dynamic, static, kinematic body types.
 * Per-model: mass, damping, friction, restitution (bounciness).
 */
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as CANNON from 'cannon-es'
import * as THREE from 'three'
import useStore from '../store/useStore'

// Global physics world singleton shared across R3F frames
let physicsWorld = null
const bodyMap = new Map()   // modelId → CANNON.Body
const meshMap = new Map()   // modelId → THREE.Object3D ref

function createWorld(gravity) {
  const world = new CANNON.World()
  world.gravity.set(0, gravity, 0)
  world.broadphase = new CANNON.SAPBroadphase(world)
  world.allowSleep = true
  world.defaultContactMaterial.friction    = 0.4
  world.defaultContactMaterial.restitution = 0.3

  // Ground plane
  const groundBody = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC })
  groundBody.addShape(new CANNON.Plane())
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  groundBody.position.set(0, 0, 0)
  world.addBody(groundBody)

  return world
}

function getOrCreateWorld(gravity) {
  if (!physicsWorld) {
    physicsWorld = createWorld(gravity)
  } else {
    physicsWorld.gravity.set(0, gravity, 0)
  }
  return physicsWorld
}

function destroyWorld() {
  if (physicsWorld) {
    physicsWorld.bodies.forEach(b => physicsWorld.removeBody(b))
    physicsWorld = null
  }
  bodyMap.clear()
  meshMap.clear()
}

function getBoundingBox(object3d) {
  const box = new THREE.Box3().setFromObject(object3d)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  return { size, center }
}

function createBodyForModel(modelId, object3d, physicsProps) {
  const { size, center } = getBoundingBox(object3d)
  const {
    mass           = 1,
    damping        = 0.4,
    angularDamping = 0.6,
    type           = 'dynamic',
    friction       = 0.4,
    restitution    = 0.2,
  } = physicsProps || {}

  // Use box shape fitted to bounding box
  const halfExtents = new CANNON.Vec3(
    Math.max(size.x / 2, 0.1),
    Math.max(size.y / 2, 0.1),
    Math.max(size.z / 2, 0.1)
  )
  const shape = new CANNON.Box(halfExtents)

  const bodyType =
    type === 'static'    ? CANNON.Body.STATIC    :
    type === 'kinematic' ? CANNON.Body.KINEMATIC  :
                           CANNON.Body.DYNAMIC

  const body = new CANNON.Body({
    mass:           bodyType === CANNON.Body.STATIC ? 0 : mass,
    type:           bodyType,
    linearDamping:  damping,
    angularDamping: angularDamping,
  })
  body.addShape(shape)

  // Place body at object's world position
  const pos = object3d.position
  body.position.set(
    pos.x + center.x,
    pos.y + center.y + halfExtents.y,
    pos.z + center.z
  )
  body.quaternion.set(
    object3d.quaternion.x,
    object3d.quaternion.y,
    object3d.quaternion.z,
    object3d.quaternion.w,
  )

  // Material
  const mat = new CANNON.Material()
  mat.friction    = friction
  mat.restitution = restitution
  body.material = mat

  body.allowSleep = true
  body.sleepSpeedLimit = 0.1
  body.sleepTimeLimit  = 1

  return body
}

// ── Inner component that ticks the physics world ──────────────────────────────
function PhysicsTicker({ sceneObjects }) {
  const { scene } = useThree()
  const accumRef  = useRef(0)

  useFrame((_, delta) => {
    if (!physicsWorld) return
    const fixed = 1 / 60
    accumRef.current += delta
    while (accumRef.current >= fixed) {
      physicsWorld.step(fixed)
      accumRef.current -= fixed
    }

    // Sync Three.js objects from physics bodies
    bodyMap.forEach((body, modelId) => {
      const obj = meshMap.get(modelId)
      if (!obj || body.type === CANNON.Body.STATIC) return
      obj.position.set(body.position.x, body.position.y, body.position.z)
      obj.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w)
    })
  })

  return null
}

// ── Public API exported for use by other components ────────────────────────────
export function registerPhysicsObject(modelId, object3d, physicsProps) {
  if (!physicsWorld) return
  // Remove old body if exists
  if (bodyMap.has(modelId)) {
    physicsWorld.removeBody(bodyMap.get(modelId))
    bodyMap.delete(modelId)
  }
  const body = createBodyForModel(modelId, object3d, physicsProps)
  physicsWorld.addBody(body)
  bodyMap.set(modelId, body)
  meshMap.set(modelId, object3d)
}

export function unregisterPhysicsObject(modelId) {
  if (bodyMap.has(modelId)) {
    physicsWorld?.removeBody(bodyMap.get(modelId))
    bodyMap.delete(modelId)
    meshMap.delete(modelId)
  }
}

export function applyImpulse(modelId, impulse, point = { x:0, y:0, z:0 }) {
  const body = bodyMap.get(modelId)
  if (!body) return
  body.applyImpulse(
    new CANNON.Vec3(impulse.x, impulse.y, impulse.z),
    new CANNON.Vec3(point.x,   point.y,   point.z)
  )
}

export function setBodyVelocity(modelId, vel) {
  const body = bodyMap.get(modelId)
  if (!body) return
  body.velocity.set(vel.x, vel.y, vel.z)
  body.wakeUp()
}

export function getPhysicsWorld() { return physicsWorld }

// ── Main component ────────────────────────────────────────────────────────────
export default function PhysicsEngine() {
  const { physicsEnabled, gravity, models, modelPhysics } = useStore()

  useEffect(() => {
    if (physicsEnabled) {
      getOrCreateWorld(gravity)
    } else {
      destroyWorld()
    }
    return () => { if (!physicsEnabled) destroyWorld() }
  }, [physicsEnabled, gravity])

  if (!physicsEnabled) return null
  return <PhysicsTicker />
}
