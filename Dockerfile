# ═══════════════════════════════════════════════════════════════════════════════
# GLB Animation Studio — Hugging Face Spaces Docker Deployment
# HF Spaces requires: port 7860, non-root user (uid 1000)
# ═══════════════════════════════════════════════════════════════════════════════

# ── Stage 1: Node builder ──────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json ./

# Install all dependencies
RUN npm install --legacy-peer-deps

# Copy all source files
COPY . .

# Build the Vite React app
RUN npm run build

# Verify build output exists
RUN ls -la dist/ && echo "✓ Build successful"

# ── Stage 2: nginx production server ──────────────────────────────────────────
FROM nginx:1.25-alpine AS runner

# Create non-root user for HF Spaces (uid 1000 required)
RUN addgroup -g 1000 appgroup && \
    adduser -u 1000 -G appgroup -s /bin/sh -D appuser

# Remove default nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy built React app from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create required nginx dirs and fix permissions for non-root
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

# Switch to non-root user (HF Spaces requirement)
USER appuser

# HF Spaces listens on port 7860
EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget -qO- http://localhost:7860/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
