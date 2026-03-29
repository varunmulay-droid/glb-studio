# GLB Animation Studio — Hugging Face Spaces
# Port 7860, non-root user uid 1000

# ── Stage 1: Build ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools needed for native modules
RUN apk add --no-cache python3 make g++

# Copy lockfile + package for layer caching
COPY package.json package-lock.json* ./

# Install deps — use ci for reproducible builds, fall back to install
RUN npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps

# Copy source
COPY . .

# Build
RUN npm run build

# Verify
RUN test -d dist && echo "✓ dist/ exists" || (echo "✗ dist/ missing!" && exit 1)

# ── Stage 2: Serve ─────────────────────────────────────────────────────────────
FROM nginx:1.25-alpine AS runner

# Non-root user (HF Spaces requirement)
RUN addgroup -g 1000 appgroup && \
    adduser  -u 1000 -G appgroup -s /bin/sh -D appuser

# Deploy built assets
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Fix permissions for non-root nginx
RUN mkdir -p /var/cache/nginx/client_temp \
             /var/cache/nginx/proxy_temp \
             /var/cache/nginx/fastcgi_temp \
             /var/cache/nginx/uwsgi_temp \
             /var/cache/nginx/scgi_temp && \
    touch /var/run/nginx.pid && \
    chown -R appuser:appgroup \
        /var/cache/nginx \
        /var/run/nginx.pid \
        /var/log/nginx \
        /usr/share/nginx/html \
        /etc/nginx/conf.d

USER appuser
EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -qO- http://localhost:7860/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
