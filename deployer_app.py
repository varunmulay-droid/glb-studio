"""
GLB Studio → Hugging Face Spaces Deployer
Single file — run in Google Colab, local machine, or any Python 3.9+ env

  Colab:  !python app.py   → click the public gradio.live URL
  Local:  python app.py    → open http://localhost:7860
"""

# ── Auto-install ────────────────────────────────────────────────────────────
import subprocess, sys

for pkg in ("gradio", "requests"):
    try:
        __import__(pkg)
    except ImportError:
        print(f"Installing {pkg}...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", pkg])

# ── Imports ─────────────────────────────────────────────────────────────────
import os, shutil, tempfile, threading, queue, time
import gradio as gr
import requests

# ── Defaults ────────────────────────────────────────────────────────────────
DEFAULT_TOKEN    = "hf_YOUR_TOKEN_HERE"
DEFAULT_USERNAME = "varunm2004"
DEFAULT_SPACE    = "glb-studio"
GITHUB_REPO      = "https://github.com/varunmulay-droid/glb-studio.git"

# ════════════════════════════════════════════════════════════════════════════
# DEPLOY LOGIC
# ════════════════════════════════════════════════════════════════════════════

def run_git(args, cwd=None, extra_env=None):
    env = {k: v for k, v in os.environ.items()
           if k.upper() not in ("HTTP_PROXY","HTTPS_PROXY","ALL_PROXY",
                                "http_proxy","https_proxy","all_proxy")}
    env.update({
        "GIT_TERMINAL_PROMPT": "0",
        "GIT_AUTHOR_NAME":     "GLB Studio Deploy",
        "GIT_AUTHOR_EMAIL":    "deploy@glbstudio.dev",
        "GIT_COMMITTER_NAME":  "GLB Studio Deploy",
        "GIT_COMMITTER_EMAIL": "deploy@glbstudio.dev",
        **(extra_env or {}),
    })
    r = subprocess.run(["git"]+args, cwd=cwd,
                       capture_output=True, text=True, env=env)
    return r.returncode, r.stdout.strip(), r.stderr.strip()


def hf_session(token):
    s = requests.Session()
    s.trust_env = False
    s.proxies   = {"http": None, "https": None}
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


def validate_token(token):
    """Returns (ok, username_or_error). ok=None means network unreachable."""
    try:
        r = hf_session(token).get(
            "https://huggingface.co/api/whoami", timeout=15)
        if r.status_code == 200:
            return True, r.json().get("name", "unknown")
        return False, f"HTTP {r.status_code} — token invalid or expired"
    except Exception as e:
        return None, str(e)


def ensure_space(token, username, space):
    """Create space if it doesn't exist. Returns (ok, msg)."""
    try:
        r = hf_session(token).get(
            f"https://huggingface.co/api/spaces/{username}/{space}",
            timeout=15)
        if r.status_code == 200:
            return True, "exists"
        # Create it
        r2 = hf_session(token).post(
            "https://huggingface.co/api/repos/create",
            json={"type":"space","name":space,"sdk":"docker","private":False},
            timeout=30)
        if r2.status_code in (200, 201):
            return True, "created"
        return False, f"({r2.status_code}) {r2.text[:200]}"
    except Exception as e:
        return None, str(e)


def patch_readme(path, space_name):
    fm = (
        "---\n"
        f"title: {space_name.replace('-',' ').title()}\n"
        "emoji: 🎬\n"
        "colorFrom: cyan\n"
        "colorTo: indigo\n"
        "sdk: docker\n"
        "app_port: 7860\n"
        "pinned: false\n"
        "license: mit\n"
        "short_description: GLB 3D Animation Studio — Three.js + React\n"
        "---\n\n"
    )
    body = ""
    if os.path.exists(path):
        body = open(path).read()
        if body.startswith("---"):
            end = body.find("---", 3)
            if end != -1: body = body[end+3:].lstrip("\n")
    open(path,"w").write(fm + body)


def deploy(hf_token, space_name, username, emit=None):
    """
    Full pipeline. Calls emit(msg) for live log streaming.
    Returns (success: bool, result: str)
    """
    def log(msg):
        print(msg)
        if emit: emit(msg)

    hf_token   = hf_token.strip()
    space_name = space_name.strip().lower().replace(" ","-")
    username   = username.strip()

    if not all([hf_token, space_name, username]):
        return False, "Token, username and space name are all required."

    # 1. Validate token
    log("🔑 Validating token with Hugging Face...")
    ok, res = validate_token(hf_token)
    if ok is True:
        log(f"✅ Authenticated as: @{res}")
    elif ok is False:
        return False, (
            f"Token rejected: {res}\n\n"
            "Fix: huggingface.co/settings/tokens\n"
            "→ New token → Role: Write → paste new hf_... token"
        )
    else:
        log(f"⚠️  HF API unreachable ({res}) — skipping validation, trying push...")

    # 2. Ensure space exists
    log(f"🔍 Checking space '{username}/{space_name}'...")
    ok, msg = ensure_space(hf_token, username, space_name)
    if ok is True:
        log(f"📦 Space {msg}.")
        if msg == "created": time.sleep(3)
    elif ok is False:
        log(f"⚠️  Space check failed: {msg} — attempting push anyway...")
    else:
        log(f"⚠️  Network issue checking space — attempting push anyway...")

    tmp = tempfile.mkdtemp(prefix="glb_")
    try:
        # 3. Clone GitHub source
        src = os.path.join(tmp, "src")
        log("📥 Cloning source from GitHub...")
        code, _, err = run_git(["clone","--depth=1", GITHUB_REPO, src])
        if code != 0: return False, f"GitHub clone failed:\n{err}"
        log("✅ GitHub source cloned.")

        # 4. Clone / init HF Space repo
        hf  = os.path.join(tmp, "hf")
        url = f"https://user:{hf_token}@huggingface.co/spaces/{username}/{space_name}"
        log("📥 Cloning HF Space repo...")
        code, _, err = run_git(["clone", url, hf])
        if code != 0:
            log("⚠️  HF clone failed — initialising empty repo...")
            os.makedirs(hf, exist_ok=True)
            run_git(["init","-b","main"], cwd=hf)
            run_git(["remote","add","origin", url], cwd=hf)
        log("✅ HF repo ready.")

        # 5. Sync files
        log("📋 Syncing project files...")
        for item in os.listdir(hf):
            if item == ".git": continue
            p = os.path.join(hf, item)
            shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
        for item in os.listdir(src):
            if item == ".git": continue
            s, d = os.path.join(src,item), os.path.join(hf,item)
            shutil.copytree(s,d) if os.path.isdir(s) else shutil.copy2(s,d)
        n = sum(len(fs) for r,_,fs in os.walk(hf) if ".git" not in r)
        log(f"✅ {n} files synced.")

        # 6. Patch README
        patch_readme(os.path.join(hf,"README.md"), space_name)
        log("✅ README.md front-matter set.")

        # 7. Commit
        run_git(["config","user.email","deploy@glbstudio.dev"], cwd=hf)
        run_git(["config","user.name","GLB Studio Deploy"],     cwd=hf)
        run_git(["add","-A"], cwd=hf)
        _, out, _ = run_git(["status","--porcelain"], cwd=hf)
        if not out.strip():
            log("ℹ️  No changes — Space already up to date.")
            return True, f"https://huggingface.co/spaces/{username}/{space_name}"
        log("💾 Committing...")
        code, _, err = run_git(
            ["commit","-m","🎬 Deploy GLB Animation Studio (Three.js + React + Docker)"],
            cwd=hf)
        if code != 0: return False, f"Commit failed:\n{err}"

        # 8. Push
        log("🚀 Pushing to Hugging Face Spaces...")
        code, _, err = run_git(["push","origin","main","--force"], cwd=hf)
        if code != 0:
            code, _, err2 = run_git(
                ["push","origin","HEAD:main","--force"], cwd=hf)
            if code != 0:
                return False, (
                    f"Push failed:\n{err}\n{err2}\n\n"
                    "💡 Ensure the token has WRITE access to the Space.\n"
                    "   huggingface.co/settings/tokens → edit token → add Write scope"
                )

        space_url = f"https://huggingface.co/spaces/{username}/{space_name}"
        log(f"🎉 Push complete!")
        log(f"🔗 {space_url}")
        log("⏱  Docker build starts now (~3–5 min). Check the Logs tab.")
        return True, space_url

    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ════════════════════════════════════════════════════════════════════════════
# GRADIO UI
# ════════════════════════════════════════════════════════════════════════════

CSS = """
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Space+Mono:wght@400;700&display=swap');
body,.gradio-container{background:#080810!important;font-family:'Space Mono',monospace!important;color:#c0c8d8!important}
.hdr{text-align:center;padding:28px 16px 10px;border-bottom:1px solid rgba(0,245,255,.08);margin-bottom:8px}
.hdr-title{font-family:'Orbitron',monospace;font-size:1.9rem;font-weight:900;letter-spacing:.1em;background:linear-gradient(135deg,#00f5ff 0%,#0077ff 55%,#ff40a0 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin:0 0 6px}
.hdr-sub{color:#2a3a4a;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;margin:0}
label>span{color:#3a5577!important;font-size:10px!important;font-family:'Space Mono',monospace!important;letter-spacing:.18em!important;text-transform:uppercase!important;font-weight:700!important}
input[type=text],input[type=password],textarea{background:rgba(0,10,30,.8)!important;border:1px solid rgba(0,245,255,.2)!important;border-radius:8px!important;color:#d0e8ff!important;font-family:'Space Mono',monospace!important;font-size:13px!important;transition:border-color .2s,box-shadow .2s!important}
input[type=text]:focus,input[type=password]:focus,textarea:focus{border-color:#00f5ff!important;box-shadow:0 0 0 3px rgba(0,245,255,.1)!important;outline:none!important}
#deploy-btn button{background:linear-gradient(135deg,#00c6ff 0%,#0055ff 60%,#7a00ff 100%)!important;border:none!important;border-radius:10px!important;color:#fff!important;font-family:'Orbitron',monospace!important;font-size:13px!important;font-weight:700!important;letter-spacing:.15em!important;padding:15px 0!important;box-shadow:0 4px 28px rgba(0,100,255,.4)!important;transition:opacity .2s,transform .15s!important;cursor:pointer!important}
#deploy-btn button:hover{opacity:.88!important;transform:translateY(-2px)!important}
#status-out textarea{background:rgba(0,15,35,.95)!important;border:1px solid rgba(0,245,255,.22)!important;border-radius:10px!important;color:#00f5cc!important;font-family:'Space Mono',monospace!important;font-size:13px!important;font-weight:700!important;text-align:center!important;min-height:90px!important}
#log-out textarea{background:#020210!important;border:1px solid rgba(0,245,255,.1)!important;border-radius:10px!important;color:#22cc99!important;font-family:'Courier New',monospace!important;font-size:12px!important;line-height:1.85!important;min-height:300px!important}
.ic{background:rgba(0,245,255,.025);border:1px solid rgba(0,245,255,.09);border-radius:9px;padding:12px 14px;font-size:12px;color:#3a4a5a;line-height:1.75;margin-bottom:10px}
.ic b{color:#008baa}.ic a{color:#006688;text-decoration:none}.ic a:hover{color:#00ccff}
.ftr{text-align:center;padding:12px;color:#111122;font-size:10px;border-top:1px solid rgba(255,255,255,.03);margin-top:10px;letter-spacing:.06em}
.ftr a{color:#1a2233;text-decoration:none}
"""


def run_deploy(hf_token, hf_username, space_name):
    """Gradio generator streaming (log, status) tuples."""
    for field, label in [(hf_token,"Token"),(hf_username,"Username"),(space_name,"Space name")]:
        if not field.strip():
            yield "", f"❌ {label} is required."
            return

    log_lines, q = [], queue.Queue()
    result = {}

    threading.Thread(
        target=lambda: (
            result.__setitem__("r", deploy(hf_token, space_name, hf_username,
                                           emit=q.put)),
            q.put(None)
        ),
        daemon=True
    ).start()

    yield "", "⏳ Starting..."

    while True:
        try:
            msg = q.get(timeout=0.5)
        except queue.Empty:
            continue
        if msg is None:
            break
        log_lines.append(msg)
        yield "\n".join(log_lines), f"⏳ {msg}"

    ok, res = result.get("r", (False, "No result"))
    log_text = "\n".join(log_lines)

    if ok:
        yield (log_text + "\n\n✅ COMPLETE",
               f"🎉 SUCCESS!\n\n🔗 {res}\n\n⏱  Docker build: ~3–5 min")
    else:
        yield (log_text + "\n\n❌ FAILED",
               f"❌ FAILED\n\n{res}")


with gr.Blocks(
    title="GLB Studio Deployer",
    theme=gr.themes.Base(
        primary_hue=gr.themes.colors.cyan,
        secondary_hue=gr.themes.colors.blue,
        neutral_hue=gr.themes.colors.slate,
    ),
    css=CSS,
) as demo:

    gr.HTML("""
    <div class="hdr">
      <h1 class="hdr-title">🎬 GLB STUDIO DEPLOYER</h1>
      <p class="hdr-sub">GitHub → Hugging Face Spaces · Docker · One Click</p>
    </div>""")

    with gr.Row(equal_height=False):
        with gr.Column(scale=2, min_width=270):
            gr.HTML("""
            <div class="ic"><b>SOURCE REPO</b><br>
            github.com/varunmulay-droid/glb-studio<br>
            Three.js · React 18 · Vite · nginx · Docker</div>
            <div class="ic"><b>PIPELINE</b><br>
            1 · Validate token → HF API<br>
            2 · Create Docker Space (if needed)<br>
            3 · Clone source from GitHub<br>
            4 · Sync & push to HF Space repo<br>
            5 · HF auto-builds Docker image</div>
            <div class="ic">Need a Write token?<br>
            <a href="https://huggingface.co/settings/tokens" target="_blank">
            huggingface.co/settings/tokens ↗</a><br>
            → New token → Role: <b>Write</b></div>""")

            tok = gr.Textbox(label="🔑 HF Write Token",
                             value=DEFAULT_TOKEN, type="password",
                             placeholder="hf_xxxxxxxxxxxxxxxxxxxx",
                             info="Hugging Face write-access token")
            usr = gr.Textbox(label="👤 HF Username",
                             value=DEFAULT_USERNAME,
                             placeholder="your-hf-username",
                             info="Your username on huggingface.co")
            spc = gr.Textbox(label="🚀 Space Name",
                             value=DEFAULT_SPACE,
                             placeholder="glb-studio",
                             info="huggingface.co/spaces/USERNAME/SPACE-NAME")
            btn = gr.Button("🚀  DEPLOY TO HF SPACES",
                            variant="primary", elem_id="deploy-btn", size="lg")

        with gr.Column(scale=3, min_width=360):
            status = gr.Textbox(label="📡 Status", interactive=False,
                                elem_id="status-out", lines=4,
                                placeholder="Status will appear here...")
            logs   = gr.Textbox(label="📜 Live Deploy Log", interactive=False,
                                elem_id="log-out", lines=20, max_lines=40,
                                placeholder="Step-by-step log streams here...")

    gr.HTML("""
    <div class="ftr">
      <a href="https://github.com/varunmulay-droid/glb-studio">github source</a>
      &nbsp;·&nbsp; tokens are never stored
      &nbsp;·&nbsp;
      <a href="https://huggingface.co/spaces/varunm2004/glb-studio">view space ↗</a>
    </div>""")

    btn.click(fn=run_deploy, inputs=[tok, usr, spc],
              outputs=[logs, status], show_progress=True)


# ════════════════════════════════════════════════════════════════════════════
# LAUNCH
# ════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    try:
        import google.colab  # noqa
        IN_COLAB = True
    except ImportError:
        IN_COLAB = False

    print("\n" + "═"*52)
    print("  🎬 GLB Studio → HF Spaces Deployer")
    print("  Colab: click the public gradio.live URL ↓" if IN_COLAB
          else "  Local: http://localhost:7860")
    print("═"*52 + "\n")

    demo.launch(
        share=True,           # share=True gives public URL in Colab
        server_name="0.0.0.0",
        server_port=7860,
        show_error=True,
    )
