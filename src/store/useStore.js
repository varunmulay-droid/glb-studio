import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

const generateId = () => Math.random().toString(36).substr(2, 9)

// ── Undo/Redo snapshot helpers ────────────────────────────────────────────────
const SNAPSHOT_KEYS = ['models','keyframes','cameras','lightingPreset','skybox','physicsEnabled','gravity','modelPhysics']
function snapshot(state) {
  const s = {}
  SNAPSHOT_KEYS.forEach(k => { s[k] = JSON.parse(JSON.stringify(state[k])) })
  return s
}

const useStore = create(
  immer((set, get) => ({

    // ── Models ─────────────────────────────────────────────────────────
    models: [],
    selectedModelId: null,

    addModel: (url, name) => set(state => {
      const prev = snapshot(state)
      const id = generateId()
      state.models.push({
        id, url, name: name || url.split('/').pop().split('?')[0],
        position: [0,0,0], rotation: [0,0,0], scale: [1,1,1],
        visible: true, animations: [], activeAnimation: null,
        animationSpeed: 1, animationPlaying: false,
        // Material overrides
        materialOverride: null, // { color, roughness, metalness, wireframe, opacity }
        castShadow: true, receiveShadow: true,
      })
      state.selectedModelId = id
      state.lastSelectedModelId = id
      state.undoStack.push(prev); state.redoStack = []
    }),

    removeModel: (id) => set(state => {
      const prev = snapshot(state)
      state.models = state.models.filter(m => m.id !== id)
      if (state.selectedModelId === id) state.selectedModelId = null
      Object.keys(state.keyframes).forEach(frame => {
        if (state.keyframes[frame]) delete state.keyframes[frame][id]
      })
      state.undoStack.push(prev); state.redoStack = []
    }),

    duplicateModel: (id) => set(state => {
      const prev = snapshot(state)
      const src  = state.models.find(m => m.id === id)
      if (!src) return
      const newId = generateId()
      const copy  = JSON.parse(JSON.stringify(src))
      copy.id       = newId
      copy.name     = src.name + ' Copy'
      copy.position = [src.position[0]+1, src.position[1], src.position[2]+1]
      state.models.push(copy)
      state.selectedModelId     = newId
      state.lastSelectedModelId = newId
      state.undoStack.push(prev); state.redoStack = []
    }),

    selectModel: (id) => set(state => {
      state.selectedModelId     = id
      if (id !== null) state.lastSelectedModelId = id
    }),

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

    setModelAnimPlaying: (id, playing) => set(state => {
      const m = state.models.find(m => m.id === id)
      if (m) m.animationPlaying = playing
    }),

    setModelAnimSpeed: (id, speed) => set(state => {
      const m = state.models.find(m => m.id === id)
      if (m) m.animationSpeed = speed
    }),

    toggleModelVisibility: (id) => set(state => {
      const m = state.models.find(m => m.id === id)
      if (m) m.visible = !m.visible
    }),

    setModelMaterial: (id, props) => set(state => {
      const m = state.models.find(m => m.id === id)
      if (m) m.materialOverride = { ...(m.materialOverride || {}), ...props }
    }),

    resetModelMaterial: (id) => set(state => {
      const m = state.models.find(m => m.id === id)
      if (m) m.materialOverride = null
    }),

    // ── Transform Mode + Snap ──────────────────────────────────────────
    transformMode: 'translate',
    snapEnabled:   false,
    snapTranslate: 0.5,
    snapRotate:    15,   // degrees
    snapScale:     0.1,
    setTransformMode: (mode) => set(state => { state.transformMode = mode }),
    setSnapEnabled:   (v)    => set(state => { state.snapEnabled   = v }),
    setSnapTranslate: (v)    => set(state => { state.snapTranslate = v }),
    setSnapRotate:    (v)    => set(state => { state.snapRotate    = v }),
    setSnapScale:     (v)    => set(state => { state.snapScale     = v }),

    // ── Timeline ───────────────────────────────────────────────────────
    totalFrames: 300,
    currentFrame: 0,
    fps: 30,
    isPlaying: false,
    isRecording: false,
    isRenderMode: false,      // hides ALL editor UI - grid, gizmos, selection rings, helpers
    showGrid:      true,
    showGizmo:     true,
    showCameraObjects: true,
    showContactShadows: true,
    setIsRenderMode:        (v) => set(state => { state.isRenderMode        = v }),
    setShowGrid:            (v) => set(state => { state.showGrid            = v }),
    setShowGizmo:           (v) => set(state => { state.showGizmo           = v }),
    setShowCameraObjects:   (v) => set(state => { state.showCameraObjects   = v }),
    setShowContactShadows:  (v) => set(state => { state.showContactShadows  = v }),
    loopPlayback: false,

    setCurrentFrame: (f) => set(state => {
      state.currentFrame = Math.max(0, Math.min(f, state.totalFrames - 1))
    }),
    setIsPlaying:    (v) => set(state => { state.isPlaying    = v }),
    setTotalFrames:  (v) => set(state => { state.totalFrames  = v }),
    setFps:          (v) => set(state => { state.fps          = v }),
    setLoopPlayback: (v) => set(state => { state.loopPlayback = v }),

    // ── Keyframes ──────────────────────────────────────────────────────
    // { [frameIndex]: { [modelId]: { position, rotation, scale, animation, easing } } }
    keyframes: {},

    addKeyframe: (frameIndex, modelId, easing = 'linear') => set(state => {
      const model = state.models.find(m => m.id === modelId)
      if (!model) return
      if (!state.keyframes[frameIndex]) state.keyframes[frameIndex] = {}
      state.keyframes[frameIndex][modelId] = {
        position:      [...model.position],
        rotation:      [...model.rotation],
        scale:         [...model.scale],
        animation:     model.activeAnimation,
        animationSpeed:model.animationSpeed,
        easing,
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

    clearAllKeyframes: () => set(state => {
      const prev = snapshot(state)
      state.keyframes = {}
      state.undoStack.push(prev); state.redoStack = []
    }),

    // ── Lighting ───────────────────────────────────────────────────────
    lightingPreset: 'studio',
    setLightingPreset: (p) => set(state => { state.lightingPreset = p }),

    skybox: { type:'preset', value:null, bgColor:'#080810', showBg:false },
    setSkybox: (s) => set(state => { state.skybox = { ...state.skybox, ...s } }),

    // ── Camera ─────────────────────────────────────────────────────────
    cameraPosition: [5,3,5],
    setCameraPosition: (pos) => set(state => { state.cameraPosition = pos }),

    cameras: [
      { id:'cam_1', name:'Camera 1', position:[5,3,5], target:[0,0,0], fov:50, near:0.01, far:1000 }
    ],
    activeCameraId: null,
    inCameraView:   false,

    addCamera: (cam) => set(state => ({ cameras: [...state.cameras, cam] })),
    removeCamera: (id) => set(state => ({
      cameras:       state.cameras.filter(c => c.id !== id),
      activeCameraId:state.activeCameraId === id ? null  : state.activeCameraId,
      inCameraView:  state.activeCameraId === id ? false : state.inCameraView,
    })),
    updateCamera: (id, props) => set(state => ({
      cameras: state.cameras.map(c => c.id === id ? { ...c, ...props } : c)
    })),
    setActiveCameraId: (id) => set(() => ({ activeCameraId: id })),
    setInCameraView:   (v)  => set(() => ({ inCameraView:   v })),

    // ── Recording / Export ─────────────────────────────────────────────
    recordedFrames:  [],
    isExporting:     false,
    exportProgress:  0,
    exportedVideoUrl:null,
    addRecordedFrame:   (d)   => set(state => { state.recordedFrames.push(d) }),
    clearRecordedFrames:()    => set(state => { state.recordedFrames = [] }),
    setIsExporting:     (v)   => set(state => { state.isExporting    = v }),
    renderWidth:  1920,
    renderHeight: 1080,
    setRenderWidth:  (v) => set(state => { state.renderWidth  = v }),
    setRenderHeight: (v) => set(state => { state.renderHeight = v }),
    setExportProgress:  (v)   => set(state => { state.exportProgress  = v }),
    setExportedVideoUrl:(url) => set(state => { state.exportedVideoUrl = url }),

    // ── UI State ────────────────────────────────────────────────────────
    activePanel:    'models',
    showTimeline:    true,
    setActivePanel:  (p) => set(state => { state.activePanel  = p }),
    setShowTimeline: (v) => set(state => { state.showTimeline = v }),

    // ── Physics ─────────────────────────────────────────────────────────
    physicsEnabled: false,
    gravity:        -9.82,
    modelPhysics:   {},
    setPhysicsEnabled: (v) => set(state => { state.physicsEnabled = v }),
    setGravity:        (v) => set(state => { state.gravity        = v }),
    setModelPhysics: (id, props) => set(state => {
      state.modelPhysics[id] = { ...state.modelPhysics[id], ...props }
    }),

    // ── AI ──────────────────────────────────────────────────────────────
    aiMessages:         [],
    aiThinking:         false,
    openrouterKey:      '',
    lastSelectedModelId:null,
    aiCommandHistory:   [],
    setOpenrouterKey:   (k)   => set(state => { state.openrouterKey      = k }),
    setAiThinking:      (v)   => set(state => { state.aiThinking         = v }),
    addAiMessage:       (msg) => set(state => { state.aiMessages = [...state.aiMessages, msg] }),
    clearAiMessages:    ()    => set(state => { state.aiMessages         = [] }),
    setLastSelectedModelId:(id)=>set(state=>{ state.lastSelectedModelId = id }),
    addAiCommandHistory:(e)   => set(state => {
      state.aiCommandHistory = [...state.aiCommandHistory.slice(-49), e]
    }),

    // ── Undo / Redo ─────────────────────────────────────────────────────
    undoStack: [],
    redoStack: [],

    pushUndo: () => set(state => {
      state.undoStack.push(snapshot(state))
      state.redoStack = []
    }),

    undo: () => set(state => {
      if (!state.undoStack.length) return
      const prev = state.undoStack.pop()
      state.redoStack.push(snapshot(state))
      SNAPSHOT_KEYS.forEach(k => { state[k] = prev[k] })
    }),

    redo: () => set(state => {
      if (!state.redoStack.length) return
      const next = state.redoStack.pop()
      state.undoStack.push(snapshot(state))
      SNAPSHOT_KEYS.forEach(k => { state[k] = next[k] })
    }),

    // ── Project Save / Load ─────────────────────────────────────────────
    projectName: 'Untitled Project',
    setProjectName: (n) => set(state => { state.projectName = n }),

    saveProject: () => {
      const s = get()
      const data = {
        version: 2,
        projectName: s.projectName,
        models: s.models.map(m => ({
          id:m.id, url:m.url, name:m.name,
          position:m.position, rotation:m.rotation, scale:m.scale,
          visible:m.visible, activeAnimation:m.activeAnimation,
          animationSpeed:m.animationSpeed, animationPlaying:m.animationPlaying,
          materialOverride:m.materialOverride,
        })),
        keyframes:   s.keyframes,
        cameras:     s.cameras,
        totalFrames: s.totalFrames,
        fps:         s.fps,
        lightingPreset:s.lightingPreset,
        skybox:      s.skybox,
        physicsEnabled:s.physicsEnabled,
        gravity:     s.gravity,
        modelPhysics:s.modelPhysics,
      }
      try {
        localStorage.setItem('glb_studio_project', JSON.stringify(data))
        return true
      } catch(e) { console.error('Save failed', e); return false }
    },

    loadProject: () => {
      try {
        const raw  = localStorage.getItem('glb_studio_project')
        if (!raw) return false
        const data = JSON.parse(raw)
        set(state => {
          state.projectName  = data.projectName  || 'Untitled'
          state.models       = data.models       || []
          state.keyframes    = data.keyframes    || {}
          state.cameras      = data.cameras      || [{ id:'cam_1',name:'Camera 1',position:[5,3,5],target:[0,0,0],fov:50,near:0.01,far:1000 }]
          state.totalFrames  = data.totalFrames  || 300
          state.fps          = data.fps          || 30
          state.lightingPreset=data.lightingPreset||'studio'
          state.skybox       = data.skybox       || { type:'preset', value:null, bgColor:'#080810', showBg:false }
          state.physicsEnabled=data.physicsEnabled||false
          state.gravity      = data.gravity      ?? -9.82
          state.modelPhysics = data.modelPhysics || {}
          state.undoStack    = []
          state.redoStack    = []
        })
        return true
      } catch(e) { console.error('Load failed', e); return false }
    },

    // Export project JSON (metadata only, no model blobs)
    exportProjectJSON: () => {
      const s = get()
      const data = {
        version: 3,
        projectName: s.projectName,
        models: s.models.map(m => ({
          id:m.id, url:m.url, name:m.name,
          position:m.position, rotation:m.rotation, scale:m.scale,
          visible:m.visible, activeAnimation:m.activeAnimation,
          animationSpeed:m.animationSpeed, animationPlaying:m.animationPlaying,
          materialOverride:m.materialOverride,
          castShadow:m.castShadow, receiveShadow:m.receiveShadow,
        })),
        keyframes:      s.keyframes,
        cameras:        s.cameras,
        totalFrames:    s.totalFrames,
        fps:            s.fps,
        loopPlayback:   s.loopPlayback,
        lightingPreset: s.lightingPreset,
        skybox:         s.skybox,
        physicsEnabled: s.physicsEnabled,
        gravity:        s.gravity,
        modelPhysics:   s.modelPhysics,
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href=url; a.download=`${s.projectName.replace(/\s+/g,'_')}.glbstudio`; a.click()
      URL.revokeObjectURL(url)
    },

    // ── Safe base64 encode — handles large buffers without stack overflow ──
    _arrayBufferToBase64: (buffer) => {
      const bytes  = new Uint8Array(buffer)
      const CHUNK  = 8192
      let   result = ''
      for (let i = 0; i < bytes.length; i += CHUNK) {
        result += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
      }
      return btoa(result)
    },

    // ── Fetch a URL and return { b64, mime, size } or null on failure ────────
    _fetchAsB64: async (url, arrayBufferToBase64) => {
      try {
        const res  = await fetch(url, { mode: 'cors' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buf  = await res.arrayBuffer()
        const ext  = url.split('?')[0].split('.').pop().toLowerCase()
        const mime = ext === 'glb' ? 'model/gltf-binary' :
                     ext === 'gltf' ? 'model/gltf+json' :
                     'application/octet-stream'
        return { b64: arrayBufferToBase64(buf), mime, size: buf.byteLength }
      } catch(e) {
        console.warn('[Bundle] fetch failed for', url, e.message)
        return null
      }
    },

    // ── Export full bundle — safely embeds model GLBs as base64 ─────────────
    exportProjectBundle: async (onProgress, embedOptions = {}) => {
      const s   = get()
      const a2b = get()._arrayBufferToBase64
      const fb  = get()._fetchAsB64
      onProgress?.('Preparing…', 2)

      const modelEntries = []
      let   totalBytes   = 0

      for (let i = 0; i < s.models.length; i++) {
        const m      = s.models[i]
        const pct    = 5 + Math.round((i / s.models.length) * 70)
        const skip   = embedOptions.skip?.includes(m.id)
        onProgress?.(`${skip?'Skipping':'Packing'} model ${i+1}/${s.models.length}: ${m.name}`, pct)

        const entry = {
          id:m.id, url:m.url, name:m.name,
          position:m.position, rotation:m.rotation, scale:m.scale,
          visible:m.visible, activeAnimation:m.activeAnimation,
          animationSpeed:m.animationSpeed, animationPlaying:m.animationPlaying,
          materialOverride:m.materialOverride,
          castShadow:m.castShadow, receiveShadow:m.receiveShadow,
        }

        if (!skip && m.url && !m.url.startsWith('data:')) {
          const fetched = await fb(m.url, a2b)
          if (fetched) {
            entry.embeddedBlob = `data:${fetched.mime};base64,${fetched.b64}`
            entry.embeddedSize = fetched.size
            totalBytes += fetched.size
          } else {
            entry.embedError = 'fetch_failed'
          }
        } else if (m.url?.startsWith('data:')) {
          // Already a data URL (local file upload) — keep as-is
          entry.embeddedBlob = m.url
        }
        modelEntries.push(entry)
      }

      onProgress?.('Building bundle JSON…', 80)
      const bundle = {
        version:        4,
        appVersion:     'GLB Studio 2.0',
        bundleDate:     new Date().toISOString(),
        projectName:    s.projectName,
        models:         modelEntries,
        keyframes:      s.keyframes,
        cameras:        s.cameras,
        totalFrames:    s.totalFrames,
        fps:            s.fps,
        loopPlayback:   s.loopPlayback,
        lightingPreset: s.lightingPreset,
        skybox:         s.skybox,
        physicsEnabled: s.physicsEnabled,
        gravity:        s.gravity,
        modelPhysics:   s.modelPhysics,
        stats: {
          modelCount:    modelEntries.length,
          keyframeCount: Object.keys(s.keyframes).length,
          cameraCount:   s.cameras.length,
          embeddedModels:modelEntries.filter(m=>m.embeddedBlob).length,
          embeddedBytes: totalBytes,
        }
      }

      onProgress?.('Saving file…', 92)
      const json     = JSON.stringify(bundle)
      const fileBlob = new Blob([json], { type:'application/json' })
      const fileUrl  = URL.createObjectURL(fileBlob)
      const a        = document.createElement('a')
      const safeName = s.projectName.replace(/[^a-z0-9_\-]/gi,'_') || 'project'
      a.href = fileUrl
      a.download = `${safeName}_bundle.glbstudio`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(fileUrl), 5000)
      onProgress?.('Done!', 100)

      // Save to recent projects in localStorage
      try {
        const recent = JSON.parse(localStorage.getItem('glb_recent') || '[]')
        const entry  = { name:s.projectName, date:new Date().toISOString(), type:'bundle', models:modelEntries.length }
        localStorage.setItem('glb_recent', JSON.stringify([entry, ...recent.slice(0,9)]))
      } catch {}

      return {
        modelCount:    modelEntries.length,
        embeddedCount: modelEntries.filter(m=>m.embeddedBlob).length,
        failedCount:   modelEntries.filter(m=>m.embedError).length,
        size:          fileBlob.size,
      }
    },

    // ── Parse a .glbstudio file — returns preview WITHOUT loading ────────────
    previewBundle: (file) => new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = e => {
        try {
          const data = JSON.parse(e.target.result)
          resolve({
            ok:             true,
            projectName:    data.projectName   || 'Unknown',
            version:        data.version       || 1,
            bundleDate:     data.bundleDate    || null,
            modelCount:     (data.models || []).length,
            keyframeCount:  Object.keys(data.keyframes || {}).length,
            cameraCount:    (data.cameras || []).length,
            totalFrames:    data.totalFrames   || 0,
            fps:            data.fps           || 30,
            lightingPreset: data.lightingPreset|| 'studio',
            embeddedModels: (data.models || []).filter(m=>m.embeddedBlob).length,
            models:         (data.models || []).map(m=>({ id:m.id, name:m.name, hasBlob:!!m.embeddedBlob })),
            stats:          data.stats || null,
            _raw:           data,   // keep for actual load
          })
        } catch(err) { resolve({ ok:false, error: err.message }) }
      }
      reader.readAsText(file)
    }),

    // ── Load a bundle that was already parsed by previewBundle ───────────────
    loadBundle: (parsedData) => {
      const data   = parsedData._raw || parsedData
      const a2blob = (dataUrl) => {
        if (!dataUrl) return null
        try {
          const [header, b64] = dataUrl.split(',')
          const mime   = header.match(/data:([^;]+)/)?.[1] || 'model/gltf-binary'
          const binary = atob(b64)
          const bytes  = new Uint8Array(binary.length)
          for (let i=0; i<binary.length; i++) bytes[i] = binary.charCodeAt(i)
          return URL.createObjectURL(new Blob([bytes], { type: mime }))
        } catch { return null }
      }

      const models = (data.models || []).map(m => {
        const blobUrl = m.embeddedBlob ? a2blob(m.embeddedBlob) : null
        return { ...m, url: blobUrl || m.url, embeddedBlob: undefined, embeddedSize: undefined, embedError: undefined }
      })

      set(state => {
        state.projectName    = data.projectName    || 'Imported'
        state.models         = models
        state.keyframes      = data.keyframes      || {}
        state.cameras        = data.cameras?.length ? data.cameras : [{ id:'cam_1',name:'Camera 1',position:[5,3,5],target:[0,0,0],fov:50,near:0.01,far:1000 }]
        state.totalFrames    = data.totalFrames    || 300
        state.fps            = data.fps            || 30
        state.loopPlayback   = data.loopPlayback   || false
        state.lightingPreset = data.lightingPreset || 'studio'
        state.skybox         = data.skybox         || { type:'preset', value:null, bgColor:'#080810', showBg:false }
        state.physicsEnabled = data.physicsEnabled || false
        state.gravity        = data.gravity        ?? -9.82
        state.modelPhysics   = data.modelPhysics   || {}
        state.selectedModelId = null
        state.undoStack      = []
        state.redoStack      = []
      })

      // Track recent
      try {
        const recent = JSON.parse(localStorage.getItem('glb_recent') || '[]')
        const entry  = { name:data.projectName, date:new Date().toISOString(), type: models.some(m=>m.url?.startsWith('blob:'))?'bundle':'url', models:models.length }
        localStorage.setItem('glb_recent', JSON.stringify([entry, ...recent.slice(0,9)]))
      } catch {}

      return { ok:true, modelCount:models.length, embeddedCount:models.filter(m=>m.url?.startsWith('blob:')).length }
    },

    // ── importProjectJSON: convenience wrapper (preview + load) ─────────────
    importProjectJSON: (file) => new Promise(async (resolve) => {
      const store = get()
      const preview = await store.previewBundle(file)
      if (!preview.ok) { resolve({ ok:false, error: preview.error }); return }
      const result = store.loadBundle(preview)
      resolve(result)
    }),

    // ── Recent projects (from localStorage) ─────────────────────────────────
    getRecentProjects: () => {
      try { return JSON.parse(localStorage.getItem('glb_recent') || '[]') }
      catch { return [] }
    },
    clearRecentProjects: () => {
      try { localStorage.removeItem('glb_recent') } catch {}
    },

    // ── Helpers ────────────────────────────────────────────────────────
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

    // Easing functions
    _easeIn:    (t) => t * t,
    _easeOut:   (t) => t * (2 - t),
    _easeInOut: (t) => t < 0.5 ? 2*t*t : -1+(4-2*t)*t,

    interpolateAtFrame: (modelId, frame) => {
      const { keyframes, _easeIn, _easeOut, _easeInOut } = get()
      const frames      = Object.keys(keyframes).map(Number).sort((a,b)=>a-b)
      const modelFrames = frames.filter(f => keyframes[f]?.[modelId])
      if (!modelFrames.length) return null

      const before = modelFrames.filter(f => f <= frame)
      const after  = modelFrames.filter(f => f > frame)
      if (!before.length) return keyframes[modelFrames[0]][modelId]
      if (!after.length)  return keyframes[modelFrames[modelFrames.length-1]][modelId]

      const f0  = before[before.length-1], f1 = after[0]
      let   t   = (frame - f0) / (f1 - f0)
      const kf1 = keyframes[f1][modelId]

      // Apply easing from the next keyframe
      const easing = kf1.easing || 'linear'
      if (easing === 'ease-in')    t = _easeIn(t)
      if (easing === 'ease-out')   t = _easeOut(t)
      if (easing === 'ease-in-out') t = _easeInOut(t)

      const kf0 = keyframes[f0][modelId]
      const lerp = (a,b,t) => a + (b-a)*t
      const lerpArr = (a,b,t) => a.map((v,i) => lerp(v,b[i],t))
      return {
        position:      lerpArr(kf0.position, kf1.position, t),
        rotation:      lerpArr(kf0.rotation, kf1.rotation, t),
        scale:         lerpArr(kf0.scale,    kf1.scale,    t),
        animation:     t < 0.5 ? kf0.animation : kf1.animation,
        animationSpeed:lerp(kf0.animationSpeed||1, kf1.animationSpeed||1, t),
      }
    },
  }))
)

export default useStore
