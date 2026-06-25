#!/bin/sh
# Writes runtime JS config from Railway env vars.
# Nginx Docker image runs all scripts in /docker-entrypoint.d/ before starting.
cat > /usr/share/nginx/html/js/config.js <<EOF
window.HEATMAP_API_BASE = '${HEATMAP_API_BASE:-}';
EOF
