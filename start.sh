#!/bin/bash
# NPS - Quick and Easy Startup Script
# Handles all initialization and starts dashboard

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  NPS - Nova's Private Server                               ║"
echo "║  Quick Start                                               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Kill any existing dashboard processes
echo "Checking for running processes..."
if lsof -ti:3000 >/dev/null 2>&1; then
    PID=$(lsof -ti:3000 | head -1)
    echo "  Stopping existing process on port 3000 (PID: $PID)"
    kill $PID 2>/dev/null || true
    sleep 2
fi

# Get home directory
if [ -n "$TERMUX_VERSION" ]; then
    HOME_DIR="/data/data/com.termux/files/home"
else
    HOME_DIR="$HOME"
fi

echo "Creating directories..."
mkdir -p "$HOME_DIR/server/config"
mkdir -p "$HOME_DIR/server/state"
mkdir -p "$HOME_DIR/server/logs"
mkdir -p "$HOME_DIR/server/instances"
mkdir -p "$HOME_DIR/server/backups"

# Create minimal config if needed
if [ ! -f "$HOME_DIR/server/config/profile.json" ]; then
    echo "Creating default configuration..."
    cat > "$HOME_DIR/server/config/profile.json" << 'EOF'
{
  "device": {
    "tier": "medium",
    "cpu_cores": 4,
    "ram_mb": 4096,
    "storage_gb": "unknown"
  },
  "limits": {
    "max_servers": 8,
    "max_memory_per_server_mb": 512,
    "max_cpu_per_server_percent": 25,
    "worker_processes": 2
  },
  "optimization": {
    "swap_enabled": false,
    "cache_size_mb": 409,
    "tcp_window_kb": 1024,
    "max_connections": 40960
  },
  "thermal": {
    "max_temp_c": 75,
    "throttle_temp_c": 70,
    "critical_temp_c": 80
  }
}
EOF
fi

# Check dependencies
echo ""
echo "Checking dependencies..."
cd "$(dirname "$0")/dashboard"

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies (first time only)..."
    npm install --production
else
    echo "  ✓ Dependencies installed"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Starting NPS Dashboard...                                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📍 URL: http://localhost:3000"
echo "📱 Mobile: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start the server
npm start
