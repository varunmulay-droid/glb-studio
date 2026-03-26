import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

const generateId = () => Math.random().toString(36).substr(2, 9)

const useStore = create(
  immer((set, get) => ({
    // ── Models ──────────────────────────────────────────────────────────
    models: [],
    selectedModelId: null,

    addModel: (url, name) => set(state => {
      const id = generateId()
      state.models.push({
        id, url, name: name || url.split('/').pop(),
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        visible: true,
        animations: [],
        activeAnimation: null,
        animationSpeed: 1,
        animationPlaying: false,
      })
      state.selectedModelId = id
    }),

    removeModel: (id) => set(state => {
      state.models = state.models.filter(m => m.id !== id)
      if (state.selectedModelId === id) state.selectedModelId = null
      // Remove keyframes for this model
      Object.keys(state.keyframes).forEach(frame => {
        delete state.keyframes[frame][id]
      })
    }),

    selectModel: (id) => set(state => { state.selectedModelId = id }),

    updateModelTransform: (id, type, value) => set(state => {
      const m = state.models.find(m => m.id === id)
      if (m) m[type] = value
    }),

    setModelAnimations: (id, animations) => set(state => {
      const m = state.models.find(m => m.id === id)
      if (m) {
        m.animations = animations
        if (animations.length > 0 && !m.activeAnimation) m.activeAnimation = animations[0]
      }
    }),

    setModelActiveAnimation: (id, animName) => set(state => {
      const m = state.models.find(m => m.id === id)
      if (m) m.activeAnimation = animName
    }),

    setModelAnimPlaying: (id, playing) => set(state => ({
      models: state.models.map(m => m.id === id ? { ...m, animationPlaying: playing } : m)
    })),
    setModelAnimSpeed: (id, speed) => set(state => {
      const m = state.models.find(m => m.id === id)
      if (m) m.animationSpeed = speed
    }),

    toggleModelVisibility: (id) => set(state => {
      const m = state.models.find(m => m.id === id)
      if (m) m.visible = !m.visible
    }),

    // ── Transform Mode ────────────────────────────────────────────────
    transformMode: 'translate', // translate | rotate | scale
    setTransformMode: (mode) => set(state => { state.transformMode = mode }),

    // ── Timeline ─────────────────────────────────────────────────────
    totalFrames: 300,
    currentFrame: 0,
    fps: 30,
    isPlaying: false,
    isRecording: false,

    setCurrentFrame: (f) => set(state => {
      state.currentFrame = Math.max(0, Math.min(f, state.totalFrames - 1))
    }),

    setIsPlaying: (v) => set(state => { state.isPlaying = v }),
    setTotalFrames: (v) => set(state => { state.totalFrames = v }),
    setFps: (v) => set(state => { state.fps = v }),

    // ── Keyframes ─────────────────────────────────────────────────────
    // { [frameIndex]: { [modelId]: { position, rotation, scale, animation } } }
    keyframes: {},

    addKeyframe: (frameIndex, modelId) => set(state => {
      const model = state.models.find(m => m.id === modelId)
      if (!model) return
      if (!state.keyframes[frameIndex]) state.keyframes[frameIndex] = {}
      state.keyframes[frameIndex][modelId] = {
        position: [...model.position],
        rotation: [...model.rotation],
        scale: [...model.scale],
        animation: model.activeAnimation,
        animationSpeed: model.animationSpeed,
      }
    }),

    removeKeyframe: (frameIndex, modelId) => set(state => {
      if (state.keyframes[frameIndex]) {
        delete state.keyframes[frameIndex][modelId]
        if (Object.keys(state.keyframes[frameIndex]).length === 0)
          delete state.keyframes[frameIndex]
      }
    }),

    moveKeyframe: (oldFrame, newFrame, modelId) => set(state => {
      if (!state.keyframes[oldFrame]?.[modelId]) return
      const data = state.keyframes[oldFrame][modelId]
      if (!state.keyframes[newFrame]) state.keyframes[newFrame] = {}
      state.keyframes[newFrame][modelId] = data
      delete state.keyframes[oldFrame][modelId]
      if (Object.keys(state.keyframes[oldFrame]).length === 0)
        delete state.keyframes[oldFrame]
    }),

    // ── Lighting ─────────────────────────────────────────────────────
    lightingPreset: 'studio', // studio | outdoor | dramatic | neon
    setLightingPreset: (p) => set(state => { state.lightingPreset = p }),

    // Skybox: type='preset'|'color'|'image'|'hdr', value=url/color, showBg=bool
    skybox: { type: 'preset', value: null, bgColor: '#080810', showBg: false },
    setSkybox: (s) => set(state => { state.skybox = { ...state.skybox, ...s } }),

    // ── Camera ───────────────────────────────────────────────────────
    cameraPosition: [5, 3, 5],
    setCameraPosition: (pos) => set(state => { state.cameraPosition = pos }),

    // ── Camera System (multi-camera) ─────────────────────────────────
    cameras: [
      { id:'cam_1', name:'Camera 1', position:[5,3,5], target:[0,0,0], fov:50, near:0.01, far:1000 }
    ],
    activeCameraId: null,
    inCameraView: false,
    addCamera: (cam) => set(state => ({ cameras: [...state.cameras, cam] })),
    removeCamera: (id) => set(state => ({
      cameras: state.cameras.filter(c => c.id !== id),
      activeCameraId: state.activeCameraId === id ? null : state.activeCameraId,
      inCameraView: state.activeCameraId === id ? false : state.inCameraView,
    })),
    updateCamera: (id, props) => set(state => ({
      cameras: state.cameras.map(c => c.id === id ? { ...c, ...props } : c)
    })),
    setActiveCameraId: (id) => set(() => ({ activeCameraId: id })),
    setInCameraView: (v) => set(() => ({ inCameraView: v })),

    // ── Recording ────────────────────────────────────────────────────
    recordedFrames: [],
    isExporting: false,
    exportProgress: 0,
    exportedVideoUrl: null,

    addRecordedFrame: (dataUrl) => set(state => { state.recordedFrames.push(dataUrl) }),
    clearRecordedFrames: () => set(state => { state.recordedFrames = [] }),
    setIsExporting: (v) => set(state => { state.isExporting = v }),
    setExportProgress: (v) => set(state => { state.exportProgress = v }),
    setExportedVideoUrl: (url) => set(state => { state.exportedVideoUrl = url }),

    // ── UI State ─────────────────────────────────────────────────────
    activePanel: 'models', // models | properties | keyframes | export
    setActivePanel: (p) => set(state => { state.activePanel = p }),
    showTimeline: true,
    setShowTimeline: (v) => set(state => { state.showTimeline = v }),
    urlInputVisible: false,
    setUrlInputVisible: (v) => set(state => { state.urlInputVisible = v }),


    // ── Physics ──────────────────────────────────────────────────────────
    physicsEnabled: false,
    gravity: -9.82,
    setPhysicsEnabled: (v) => set(state => { state.physicsEnabled = v }),
    setGravity: (v) => set(state => { state.gravity = v }),
    // Per-model physics props
    modelPhysics: {},  // { [id]: { mass, damping, angularDamping, type:'dynamic'|'static'|'kinematic', friction, restitution } }
    setModelPhysics: (id, props) => set(state => {
      state.modelPhysics[id] = { ...state.modelPhysics[id], ...props }
    }),

    // ── AI Controller ─────────────────────────────────────────────────────
    aiMessages: [],   // chat history
    aiThinking: false,
    openrouterKey: '',
    setOpenrouterKey: (k) => set(state => { state.openrouterKey = k }),
    setAiThinking: (v) => set(state => { state.aiThinking = v }),
    addAiMessage: (msg) => set(state => { state.aiMessages = [...state.aiMessages, msg] }),
    clearAiMessages: () => set(state => { state.aiMessages = [] }),
    // AI context memory
    lastSelectedModelId: null,
    setLastSelectedModelId: (id) => set(state => { state.lastSelectedModelId = id }),
    aiCommandHistory: [],   // [{prompt, actions, timestamp}]
    addAiCommandHistory: (entry) => set(state => {
      state.aiCommandHistory = [...state.aiCommandHistory.slice(-49), entry]
    }),

    // ── Helpers ───────────────────────────────────────────────────────
    getSelectedModel: () => {
      const { models, selectedModelId } = get()
      return models.find(m => m.id === selectedModelId) || null
    },

    getKeyframesForModel: (modelId) => {
      const { keyframes } = get()
      return Object.entries(keyframes)
        .filter(([, kf]) => kf[modelId])
        .map(([frame, kf]) => ({ frame: parseInt(frame), data: kf[modelId] }))
        .sort((a, b) => a.frame - b.frame)
    },

    interpolateAtFrame: (modelId, frame) => {
      const { keyframes } = get()
      const frames = Object.keys(keyframes).map(Number).sort((a, b) => a - b)
      const modelFrames = frames.filter(f => keyframes[f]?.[modelId])
      if (modelFrames.length === 0) return null

      const before = modelFrames.filter(f => f <= frame)
      const after = modelFrames.filter(f => f > frame)

      if (before.length === 0) return keyframes[modelFrames[0]][modelId]
      if (after.length === 0) return keyframes[modelFrames[modelFrames.length - 1]][modelId]

      const f0 = before[before.length - 1]
      const f1 = after[0]
      const t = (frame - f0) / (f1 - f0)

      const kf0 = keyframes[f0][modelId]
      const kf1 = keyframes[f1][modelId]

      const lerp = (a, b, t) => a + (b - a) * t
      const lerpArr = (a, b, t) => a.map((v, i) => lerp(v, b[i], t))

      return {
        position: lerpArr(kf0.position, kf1.position, t),
        rotation: lerpArr(kf0.rotation, kf1.rotation, t),
        scale: lerpArr(kf0.scale, kf1.scale, t),
        animation: t < 0.5 ? kf0.animation : kf1.animation,
        animationSpeed: lerp(kf0.animationSpeed, kf1.animationSpeed, t),
      }
    },
  }))
)

export default useStore
