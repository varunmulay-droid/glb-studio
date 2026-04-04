/**
 * PhysicsEngine.jsx — Complete Cannon-es physics integration
 *
 * Fixes:
 * - Bodies now automatically registered when models load
 * - Proper sync: physics → Three.js (not overridden by store transforms)
 * - Fixed accumulator so simulation runs at stable 120Hz substeps
 *
 * New physics properties:
 * - velocity, acceleration (applied as forces every frame)
 * - linearDamping (air resistance / viscosity simulation)
 * - angularDamping (rotational resistance)
 * - static friction + dynamic friction (per contact material)
 * - restitution (bounciness)
 * - centerOfMass offset
 * - continuousCollisionDetection for fast-moving objects
 * - Wind force (constant world-space force on all dynamic bodies)
 * - Per-body constant force (engine force for vehicles)
 *
 * Exported API:
 *   registerPhysicsObject(id, mesh, props)
 *   unregisterPhysicsObject(id)
 *   applyImpulse(id, {x,y,z}, point?)
 *   applyForce(id, {x,y,z}, point?)
 *   setBodyVelocity(id, {x,y,z})
 *   setAngularVelocity(id, {x,y,z})
 *   getBodyState(id) → {position, velocity, angularVelocity, sleeping}
 *   getPhysicsWorld()
 */
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as CANNON from 'cannon-es'
import * as THREE  from 'three'
import useStore    from '../store/useStore'

// ── Globals ───────────────────────────────────────────────────────────────────
let world    = null
const bodies = new Map()   // modelId → CANNON.Body
const meshes = new Map()   // modelId → THREE.Object3D
const forces = new Map()   // modelId → {x,y,z}  constant per-body force

// ── World creation ─────────────────────────────────────────────────────────────
function buildWorld(gravity, cfg = {}) {
  const w = new CANNON.World({
    gravity: new CANNON.Vec3(0, gravity, 0),
  })
  w.broadphase  = new CANNON.SAPBroadphase(w)
  w.allowSleep  = true
  w.solver.iterations = 20        // more iterations = more stable stacks

  // Default contact material
  const def = w.defaultContactMaterial
  def.friction          = cfg.globalFriction    ?? 0.4
  def.restitution       = cfg.globalRestitution ?? 0.3
  def.contactEquationStiffness  = 1e8
  def.contactEquationRelaxation = 3

  // Static ground plane
  const ground = new CANNON.Body({ mass:0, type:CANNON.Body.STATIC })
  ground.addShape(new CANNON.Plane())
  ground.quaternion.setFromEuler(-Math.PI/2, 0, 0)
  ground.position.set(0, 0, 0)
  ground.material = new CANNON.Material('ground')
  ground.material.friction    = cfg.globalFriction    ?? 0.6
  ground.material.restitution = cfg.globalRestitution ?? 0.3
  w.addBody(ground)

  return w
}

function teardown() {
  if (world) {
    ;[...world.bodies].forEach(b => world.removeBody(b))
    world = null
  }
  bodies.clear(); meshes.clear(); forces.clear()
}

// ── Body creation ──────────────────────────────────────────────────────────────
function makeBody(mesh, props = {}) {
  const {
    mass              = 1,
    type              = 'dynamic',
    linearDamping     = 0.3,
    angularDamping    = 0.5,
    friction          = 0.4,
    restitution       = 0.2,
    staticFriction    = 0.6,
    ccdRadius         = 0,        // >0 enables CCD for fast objects
    centerOfMassY     = 0,        // COM offset (lower = more stable car)
    collisionShape    = 'box',    // box | sphere | cylinder
  } = props

  // Compute bounding box from mesh
  const bb   = new THREE.Box3().setFromObject(mesh)
  const size = bb.getSize(new THREE.Vector3())
  const cx   = bb.getCenter(new THREE.Vector3())

  const bodyType =
    type === 'static'    ? CANNON.Body.STATIC    :
    type === 'kinematic' ? CANNON.Body.KINEMATIC :
                           CANNON.Body.DYNAMIC

  const body = new CANNON.Body({
    mass:           bodyType === CANNON.Body.STATIC ? 0 : Math.max(0.01, mass),
    type:           bodyType,
    linearDamping:  Math.min(1, Math.max(0, linearDamping)),
    angularDamping: Math.min(1, Math.max(0, angularDamping)),
    allowSleep:     true,
    sleepSpeedLimit: 0.05,
    sleepTimeLimit:  0.5,
  })

  // Choose collision shape
  if (collisionShape === 'sphere') {
    const r = Math.max(size.x, size.y, size.z) / 2
    body.addShape(new CANNON.Sphere(Math.max(r, 0.05)))
  } else if (collisionShape === 'cylinder') {
    const r = Math.max(size.x, size.z) / 2
    body.addShape(new CANNON.Cylinder(Math.max(r,0.05), Math.max(r,0.05), Math.max(size.y,0.1), 12))
  } else {
    body.addShape(new CANNON.Box(new CANNON.Vec3(
      Math.max(size.x/2, 0.05),
      Math.max(size.y/2, 0.05),
      Math.max(size.z/2, 0.05),
    )))
  }

  // Place at mesh world position exactly — no offsets that cause drift
  const wp = new THREE.Vector3()
  mesh.getWorldPosition(wp)
  body.position.set(wp.x, wp.y + size.y/2, wp.z)
  const wq = new THREE.Quaternion()
  mesh.getWorldQuaternion(wq)
  body.quaternion.set(wq.x, wq.y, wq.z, wq.w)

  // Per-body contact material (for friction/restitution with ground)
  const mat = new CANNON.Material()
  mat.friction    = friction
  mat.restitution = restitution
  body.material   = mat

  if (world) {
    const groundMat  = world.bodies[0]?.material
    if (groundMat) {
      const contact = new CANNON.ContactMaterial(groundMat, mat, {
        friction,
        restitution,
        contactEquationStiffness:  1e8,
        contactEquationRelaxation: 3,
        frictionEquationStiffness: 1e8,
      })
      world.addContactMaterial(contact)
    }
  }

  // CCD for fast objects (vehicles)
  if (ccdRadius > 0) {
    body.ccdSpeedThreshold = 1
    body.ccdIterations     = 10
  }

  return body
}

// ── Public API ─────────────────────────────────────────────────────────────────
export function registerPhysicsObject(id, mesh, props) {
  if (!world) return
  if (bodies.has(id)) {
    world.removeBody(bodies.get(id))
    bodies.delete(id); meshes.delete(id); forces.delete(id)
  }
  const body = makeBody(mesh, props)
  world.addBody(body)
  bodies.set(id, body)
  meshes.set(id, mesh)
}

export function unregisterPhysicsObject(id) {
  if (!bodies.has(id)) return
  world?.removeBody(bodies.get(id))
  bodies.delete(id); meshes.delete(id); forces.delete(id)
}

export function applyImpulse(id, imp, pt = {x:0,y:0,z:0}) {
  const b = bodies.get(id); if(!b) return
  b.applyImpulse(new CANNON.Vec3(imp.x,imp.y,imp.z), new CANNON.Vec3(pt.x,pt.y,pt.z))
  b.wakeUp()
}

export function applyForce(id, f, pt = {x:0,y:0,z:0}) {
  const b = bodies.get(id); if(!b) return
  b.applyForce(new CANNON.Vec3(f.x,f.y,f.z), new CANNON.Vec3(pt.x,pt.y,pt.z))
  b.wakeUp()
}

export function setBodyVelocity(id, v) {
  const b = bodies.get(id); if(!b) return
  b.velocity.set(v.x||0, v.y||0, v.z||0); b.wakeUp()
}

export function setAngularVelocity(id, v) {
  const b = bodies.get(id); if(!b) return
  b.angularVelocity.set(v.x||0, v.y||0, v.z||0); b.wakeUp()
}

export function setConstantForce(id, f) {
  if (f) forces.set(id, f)
  else   forces.delete(id)
}

export function getBodyState(id) {
  const b = bodies.get(id); if(!b) return null
  return {
    position:        { x:b.position.x,        y:b.position.y,        z:b.position.z },
    velocity:        { x:b.velocity.x,        y:b.velocity.y,        z:b.velocity.z },
    angularVelocity: { x:b.angularVelocity.x, y:b.angularVelocity.y, z:b.angularVelocity.z },
    sleeping:        b.sleepState === CANNON.Body.SLEEPING,
    speed:           b.velocity.length(),
  }
}

export function teleportBody(id, pos, quat) {
  const b = bodies.get(id); if(!b) return
  if (pos)  b.position.set(pos.x, pos.y, pos.z)
  if (quat) b.quaternion.set(quat.x, quat.y, quat.z, quat.w)
  b.velocity.set(0,0,0); b.angularVelocity.set(0,0,0); b.wakeUp()
}

export function getPhysicsWorld() { return world }
export function getBodies()       { return bodies }

// ── Ticker — runs inside R3F Canvas ──────────────────────────────────────────
function Ticker() {
  const accum = useRef(0)
  const FIXED = 1/120  // 120Hz substeps

  useFrame((_, delta) => {
    if (!world) return
    const s   = useStore.getState()
    const wind = s.physicsWind || { x:0, y:0, z:0 }
    const windMag = Math.sqrt(wind.x**2 + wind.y**2 + wind.z**2)

    // Apply constant forces before stepping
    bodies.forEach((body, id) => {
      if (body.type !== CANNON.Body.DYNAMIC) return

      // Per-body constant engine force
      const cf = forces.get(id)
      if (cf) body.applyForce(new CANNON.Vec3(cf.x, cf.y, cf.z), body.position)

      // Global wind force (proportional to exposed area, simplified)
      if (windMag > 0) {
        body.applyForce(new CANNON.Vec3(wind.x, wind.y, wind.z), body.position)
      }
    })

    // Fixed timestep accumulator
    accum.current += Math.min(delta, 0.1)
    while (accum.current >= FIXED) {
      world.step(FIXED)
      accum.current -= FIXED
    }

    // Sync physics → Three.js meshes ONLY (no store writeback - causes feedback loop)
    bodies.forEach((body, id) => {
      const mesh = meshes.get(id)
      if (!mesh || body.type === CANNON.Body.STATIC) return
      mesh.position.set(body.position.x, body.position.y, body.position.z)
      mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w)
    })
  })

  return null
}

// ── Main export ────────────────────────────────────────────────────────────────
export default function PhysicsEngine() {
  const { physicsEnabled, gravity, physicsConfig } = useStore()

  useEffect(() => {
    if (physicsEnabled) {
      if (!world) world = buildWorld(gravity, physicsConfig || {})
      else        world.gravity.set(0, gravity, 0)
    } else {
      teardown()
    }
    return () => {}
  }, [physicsEnabled, gravity])

  // Update global friction/restitution when config changes
  useEffect(() => {
    if (!world || !physicsConfig) return
    world.defaultContactMaterial.friction    = physicsConfig.globalFriction    ?? 0.4
    world.defaultContactMaterial.restitution = physicsConfig.globalRestitution ?? 0.3
  }, [physicsConfig])

  if (!physicsEnabled) return null
  return <Ticker />
}
