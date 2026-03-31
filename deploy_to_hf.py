"""
GLB Studio → HF Spaces Deployer
Run this in Google Colab: https://colab.research.google.com
Copy this entire file, paste into a new Colab notebook, Run All.
"""

import subprocess, sys, os, shutil, time

# ── Install ────────────────────────────────────────────────────────────────────
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "huggingface_hub>=0.23.0"])
from huggingface_hub import HfApi, upload_folder
from huggingface_hub.utils import RepositoryNotFoundError

# ── Config ─────────────────────────────────────────────────────────────────────
HF_TOKEN    = "YOUR_HF_TOKEN_HERE"  # get from huggingface.co/settings/tokens
HF_USERNAME = "varunm2004"
SPACE_NAME  = "glb-studio"
GITHUB_URL  = "https://github.com/varunmulay-droid/glb-studio.git"
SPACE_ID    = f"{HF_USERNAME}/{SPACE_NAME}"
SPACE_URL   = f"https://huggingface.co/spaces/{SPACE_ID}"

print(f"Target: {SPACE_URL}\n")

# ── Authenticate ───────────────────────────────────────────────────────────────
api = HfApi(token=HF_TOKEN)
try:
    user = api.whoami()
    print(f"✅ Logged in as @{user['name']}")
except Exception as e:
    raise SystemExit(f"❌ Auth failed: {e}\nGet a token at: huggingface.co/settings/tokens")

# ── Ensure Space exists ────────────────────────────────────────────────────────
try:
    api.space_info(SPACE_ID)
    print("✅ Space found")
except RepositoryNotFoundError:
    print(f"Creating Space: {SPACE_ID}")
    api.create_repo(repo_id=SPACE_NAME, repo_type="space", space_sdk="docker", private=False)
    time.sleep(5)
    print("✅ Space created")

# ── Clone latest source ────────────────────────────────────────────────────────
SRC = "/content/glb_src"
if os.path.exists(SRC):
    shutil.rmtree(SRC)

print("📥 Cloning from GitHub...")
r = subprocess.run(["git","clone","--depth=1", GITHUB_URL, SRC], capture_output=True, text=True)
if r.returncode != 0:
    raise SystemExit(f"❌ Clone failed:\n{r.stderr}")

# Show what we cloned
log = subprocess.run(["git","-C",SRC,"log","--oneline","-3"], capture_output=True, text=True)
print(f"Latest commits:\n{log.stdout}")

# Verify dist/ present
dist_path = os.path.join(SRC, "dist")
if os.path.isdir(dist_path):
    assets = os.listdir(os.path.join(dist_path, "assets"))
    print(f"✅ dist/ found — {len(assets)} pre-built assets (no npm needed on HF)")
else:
    print("⚠️  dist/ missing from repo")

# ── Overwrite README with valid HF front-matter ────────────────────────────────
readme = """\
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

Professional browser-based 3D animation studio for GLB/GLTF models.

## Features
- GLB/GLTF loading · Transform controls · Keyframe animation with easing
- Multi-camera system with fly controls · Camera path animation
- Cannon.js physics: gravity, mass, damping, impulse
- AI scene controller (OpenRouter free models)
- Material editor · Undo/Redo · Project save/load
- Clean render mode: grid/gizmos/rings hidden during export
- Video export (WebM) · PNG sequence
- Mobile optimised

## Tech Stack
React 18 · Vite · Three.js · React Three Fiber · Zustand · nginx · Docker
"""
with open(os.path.join(SRC, "README.md"), "w") as f:
    f.write(readme)
print("✅ README.md written")

# ── Upload ─────────────────────────────────────────────────────────────────────
print("\n🚀 Uploading to HF Space...")
print("   (includes pre-built dist/ — HF build takes ~20 seconds)\n")

try:
    commit = upload_folder(
        folder_path     = SRC,
        repo_id         = SPACE_ID,
        repo_type       = "space",
        token           = HF_TOKEN,
        commit_message  = "🎬 GLB Studio: pre-built, nginx-only, all bugs fixed",
        ignore_patterns = [
            ".git", ".git/**",
            "node_modules/**",
            "*.log", ".DS_Store",
            ".github/**",
            "standalone.html",
            "deployer_app.py",
            "docker-compose.yml",
            "Dockerfile.dev",
            "DEPLOY.md",
            "deploy_to_hf.py",
        ],
    )
    print(f"""
╔══════════════════════════════════════════════╗
║           ✅ DEPLOYED SUCCESSFULLY!          ║
╠══════════════════════════════════════════════╣
║  🔗  {SPACE_URL:<36} ║
║  ⏱   HF Docker build: ~20 seconds           ║
║  📋  Watch: Logs tab → Build subtab          ║
║                                              ║
║  The Dockerfile just runs nginx to serve     ║
║  the pre-built files — no npm install!       ║
╚══════════════════════════════════════════════╝
""")
except Exception as e:
    err = str(e)
    print(f"\n❌ Upload failed:\n{err}")
    if "401" in err or "403" in err:
        print("\n💡 Token fix:")
        print("   → huggingface.co/settings/tokens")
        print("   → Edit token → Repository access")
        print(f"   → Add {SPACE_ID} with Write permission")
    raise
