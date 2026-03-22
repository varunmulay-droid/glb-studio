---
title: Glb Studio
emoji: 🎬
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: GLB 3D Animation Studio — Three.js + React
---

# 🎬 GLB Animation Studio

A fully browser-based **3D animation studio** for creating animations with GLB/GLTF models.

## Features
- GLB/GLTF model loading (URL, file upload, demo models)
- Three.js scene with shadows, lighting presets
- Transform controls: Move / Rotate / Scale
- Built-in GLB animation playback with speed control
- Keyframe animation system with linear interpolation
- 300-frame timeline editor
- Video export (WebM, in-browser download)
- Mobile-optimised UI

## Quick Start
1. Click **◈ DEMO** → pick a sample model
2. Click model in scene to select it
3. Use toolbar to Move / Rotate / Scale
4. Press **◆ ADD KF** to add a keyframe
5. Scrub to another frame, transform, add another keyframe
6. Press **▶** to preview, then **EXPORT** to download

## Controls
| Input | Action |
|-------|--------|
| Left-drag | Orbit camera |
| Right-drag | Pan |
| Scroll / pinch | Zoom |
| Click model | Select |
| Double-click keyframe dot | Delete keyframe |

## Tech Stack
React 18 · Vite · Three.js · React Three Fiber · Zustand · nginx · Docker
