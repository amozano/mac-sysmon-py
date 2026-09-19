#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export PATH="/opt/homebrew/bin:$PATH"

PYTHON_BIN="/opt/homebrew/bin/python3"
if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="python3"
fi

# Ensure dependencies are available
if ! "$PYTHON_BIN" -c "import aiohttp, psutil, websockets" 2>/dev/null; then
  echo "Installing Python dependencies (aiohttp, psutil, websockets)..."
  "$PYTHON_BIN" -m pip install --break-system-packages -r requirements.txt
fi

# If dist directory is empty or missing, compile the frontend
if [ ! -f "$SCRIPT_DIR/dist/index.html" ] || [ ! -f "$SCRIPT_DIR/dist/bundle.js" ]; then
  echo "Frontend bundle not found in dist/. Compiling Vanilla TypeScript frontend..."
  cd "$SCRIPT_DIR/frontend"
  if [ ! -d "node_modules" ]; then
    npm install --silent
  fi
  node build.js
  cd "$SCRIPT_DIR"
fi

exec "$PYTHON_BIN" -m mac_sysmon.app "$@"
