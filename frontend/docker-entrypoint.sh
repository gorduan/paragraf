#!/bin/sh
# Runtime API_BASE_URL injection:
# Ersetzt den Platzhalter in den gebauten JS-Dateien, falls API_BASE_URL gesetzt ist.
# Standard (leer) = nginx proxied /api/* zum Backend.

if [ -n "$API_BASE_URL" ]; then
  echo "Injecting API_BASE_URL=$API_BASE_URL"
  # Erstelle config script
  cat > /usr/share/nginx/html/config.js << EOF
window.__PARAGRAF_API_BASE_URL__ = "${API_BASE_URL}";
EOF
  # Fuege config.js vor dem App-Script ein
  sed -i 's|</head>|<script src="/config.js"></script></head>|' /usr/share/nginx/html/index.html
fi

exec nginx -g "daemon off;"
