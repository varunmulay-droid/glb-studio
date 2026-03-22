# 🚀 Deploying GLB Animation Studio to Hugging Face Spaces

## Method 1 — HF Spaces Git Push (Recommended)

### Prerequisites
- Hugging Face account at https://huggingface.co
- `git` and `git-lfs` installed locally

### Step-by-step

1. **Create a new Space**
   - Go to https://huggingface.co/new-space
   - Space name: `glb-animation-studio` (or your preferred name)
   - **SDK: Docker** ← important
   - Hardware: CPU Basic (free) is enough
   - Visibility: Public or Private
   - Click **Create Space**

2. **Clone the empty Space repo**
   ```bash
   git clone https://huggingface.co/spaces/YOUR_USERNAME/glb-animation-studio
   cd glb-animation-studio
   ```

3. **Copy all project files into the cloned repo**
   ```bash
   # Copy everything from this project
   cp -r /path/to/glb-studio/* .
   cp -r /path/to/glb-studio/src .
   ```
   
   Make sure these files are present:
   ```
   README.md          ← HF Space config (YAML frontmatter required)
   Dockerfile         ← Must expose port 7860
   nginx.conf         ← nginx listening on 7860
   package.json
   vite.config.js
   index.html
   src/
     main.jsx
     App.jsx
     store/useStore.js
     components/
       Scene.jsx
       ModelManager.jsx
       Timeline.jsx
       PropertiesPanel.jsx
       ModelsPanel.jsx
       ExportPanel.jsx
       Toolbar.jsx
   ```

4. **Push to Hugging Face**
   ```bash
   git add .
   git commit -m "Initial deployment of GLB Animation Studio"
   git push
   ```

5. **Watch the build**
   - Go to your Space URL: `https://huggingface.co/spaces/YOUR_USERNAME/glb-animation-studio`
   - Click the **Logs** tab to watch Docker build progress
   - Build takes ~3–5 minutes (npm install + Vite build + nginx setup)
   - When you see "Running on port 7860" the Space is live ✓

---

## Method 2 — HF Spaces Web UI Upload

1. Create a Space (SDK: Docker) as above
2. In the Space's **Files** tab, upload each file manually
3. The Space will rebuild automatically after each push

---

## Method 3 — Local Docker Test First

Test the exact same image locally before pushing:

```bash
# Build
docker build -t glb-studio .

# Run (port 7860 matches HF Spaces)
docker run --rm -p 7860:7860 glb-studio

# Open browser
open http://localhost:7860
```

---

## Method 4 — docker-compose (local dev + prod)

```bash
# Production (port 7860, mirrors HF Spaces)
docker-compose up app

# Development with hot-reload (port 5173)
docker-compose --profile dev up dev
```

---

## Key HF Spaces Docker Rules

| Requirement | How we satisfy it |
|---|---|
| Port must be `7860` | nginx listens on 7860, `EXPOSE 7860` in Dockerfile |
| Non-root user | `USER appuser` (uid 1000) in Dockerfile |
| `app_port: 7860` | Set in README.md YAML frontmatter |
| `sdk: docker` | Set in README.md YAML frontmatter |
| No secrets in image | All config is static, no API keys needed |

---

## Troubleshooting

**Build fails: npm install error**
- Check that `package.json` is in the repo root
- The `--legacy-peer-deps` flag handles peer dep conflicts

**App loads blank**
- Check browser console for errors
- Ensure `index.html` is present in repo root (Vite entry point)

**Port error / won't start**
- Verify nginx.conf says `listen 7860;` not `listen 80;`
- Verify Dockerfile says `EXPOSE 7860`

**Models fail to load**
- Three.js CDN GLTFLoader requires CORS-open URLs
- Use the built-in demo models first to confirm the scene works
- For custom models: host on GitHub raw / HF datasets with `Access-Control-Allow-Origin: *`

**Nginx permission denied**
- The non-root user setup in Dockerfile handles this
- All required dirs are chown'd to `appuser` (uid 1000)
