# GLB Animation Studio — Hugging Face Spaces
# Pre-built dist/ is committed — this just serves it with nginx
# Build time: < 30 seconds (no npm install needed)

FROM nginx:1.25-alpine

# Non-root user (HF Spaces requirement: uid 1000)
RUN addgroup -g 1000 appgroup && \
    adduser  -u 1000 -G appgroup -s /bin/sh -D appuser

# Copy pre-built React app
RUN rm -rf /usr/share/nginx/html/*
COPY dist/ /usr/share/nginx/html/
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

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:7860/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

