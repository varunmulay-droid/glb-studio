---
title: GLB Animation Studio
emoji: 🎬
colorFrom: cyan
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Browser-based 3D animation studio for GLB/GLTF models
tags:
  - 3d
  - animation
  - three.js
  - react
  - webgl
---

# 🎬 GLB Animation Studio

A fully browser-based **3D animation studio** for creating animations with GLB/GLTF models — no install required.

## ✨ Features

| Feature | Details |
|---|---|
| **GLB Loading** | Paste a URL, upload a `.glb`/`.gltf` file, or load demo models (Fox, Robot, Soldier…) |
| **3D Scene** | Real-time WebGL rendering — shadows, fog, grid, axis gizmo |
| **Lighting Presets** | Studio 💡 · Outdoor ☀️ · Dramatic 🎭 · Neon 🌀 |
| **Transform Controls** | Move ✛ · Rotate ↻ · Scale ⤡ — click a model, drag its gizmo |
| **Built-in Animations** | Auto-detects animations inside GLB, play/pause, speed control |
| **Keyframe System** | Add keyframes per model per frame — linear interpolation between keys |
| **300-frame Timeline** | Scrub, drag keyframe dots, double-click dots to delete |
| **Video Export** | Frame capture → WebM video (MediaRecorder), download in browser |
| **Mobile Optimised** | Touch orbit/pinch-zoom, bottom-drawer UI on phones |

## 🚀 Quick Start

1. Click **◈ DEMO** in the Models panel and pick a sample model
2. Click the model in the 3D scene to select it
3. Use **✛ Move** / **↻ Rotate** / **⤡ Scale** in the toolbar to transform it
4. Press **◆ ADD KF** to record a keyframe at the current frame
5. Scrub to a different frame, move the model, add another keyframe
6. Press **▶** to preview the animation
7. Go to **EXPORT** → **▶ RENDER & EXPORT** → **⬇ DOWNLOAD VIDEO**

## 🎮 Controls

| Input | Action |
|-------|--------|
| Left-drag (mouse / touch) | Orbit camera |
| Right-drag (mouse) | Pan camera |
| Scroll / pinch | Zoom |
| Click model | Select |
| Click empty space | Deselect |
| Drag keyframe dot | Move keyframe in time |
| Double-click keyframe dot | Delete keyframe |

## 🛠 Tech Stack

- **React 18** + Vite
- **Three.js** + React Three Fiber + @react-three/drei
- **Zustand** — state management
- **MediaRecorder API** — video export
- **nginx** — static file serving (Docker)

## 🐳 Local Docker

```bash
# Build and run
docker build -t glb-studio .
docker run -p 7860:7860 glb-studio

# Open http://localhost:7860
```

## 💻 Local Dev

```bash
npm install
npm run dev
# Open http://localhost:5173
```
