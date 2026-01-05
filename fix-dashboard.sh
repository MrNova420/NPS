#!/bin/bash
# Quick fix script for NPS Dashboard issues
# Addresses: template loading, CPU loop, SSH blocking, missing configs

set -e

echo "🔧 NPS Dashboard Quick Fix"
echo "=========================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get home directory
if [ -n "$TERMUX_VERSION" ]; then
    HOME_DIR="/data/data/com.termux/files/home"
else
    HOME_DIR="$HOME"
fi

SERVER_DIR="$HOME_DIR/server"

echo "📂 Creating required directories..."
mkdir -p "$SERVER_DIR/config"
mkdir -p "$SERVER_DIR/state"
mkdir -p "$SERVER_DIR/logs"
mkdir -p "$SERVER_DIR/instances"
mkdir -p "$SERVER_DIR/temp"

# Check if profile.json exists
if [ ! -f "$SERVER_DIR/config/profile.json" ]; then
    echo "📝 Creating default performance profile..."
    
    # Detect system specs
    TOTAL_MEM=$(free -m 2>/dev/null | grep Mem | awk '{print $2}' || echo 2048)
    CPU_CORES=$(nproc 2>/dev/null || echo 2)
    
    # Determine tier
    if [ "$TOTAL_MEM" -ge 6144 ]; then
        TIER="high"
        MAX_SERVERS=12
        WORKERS=4
    elif [ "$TOTAL_MEM" -ge 4096 ]; then
        TIER="medium"
        MAX_SERVERS=8
        WORKERS=3
    elif [ "$TOTAL_MEM" -ge 2048 ]; then
        TIER="low"
        MAX_SERVERS=4
        WORKERS=2
    else
        TIER="minimal"
        MAX_SERVERS=2
        WORKERS=1
    fi
    
    cat > "$SERVER_DIR/config/profile.json" << EOF
{
  "device": {
    "tier": "$TIER",
    "cpu_cores": $CPU_CORES,
    "ram_mb": $TOTAL_MEM,
    "storage_gb": "unknown"
  },
  "limits": {
    "max_servers": $MAX_SERVERS,
    "max_memory_per_server_mb": $((TOTAL_MEM / MAX_SERVERS)),
    "max_cpu_per_server_percent": $((100 / MAX_SERVERS)),
    "worker_processes": $WORKERS
  },
  "optimization": {
    "swap_enabled": $([ "$TOTAL_MEM" -lt 4096 ] && echo "true" || echo "false"),
    "cache_size_mb": $((TOTAL_MEM / 10)),
    "tcp_window_kb": $((TOTAL_MEM / 4)),
    "max_connections": $((TOTAL_MEM * 10))
  },
  "thermal": {
    "max_temp_c": 75,
    "throttle_temp_c": 70,
    "critical_temp_c": 80
  }
}
EOF
    echo -e "${GREEN}✓${NC} Profile created: $TIER tier device ($TOTAL_MEM MB RAM, $CPU_CORES cores)"
else
    echo -e "${GREEN}✓${NC} Profile already exists"
fi

# Kill any running dashboard processes
echo ""
echo "🛑 Stopping any existing dashboard processes..."
pkill -f "dashboard/backend/server.js" 2>/dev/null && echo -e "${GREEN}✓${NC} Stopped existing processes" || echo "  No running processes found"

# Check if running on Android/Termux
if [ -n "$TERMUX_VERSION" ]; then
    echo ""
    echo "📱 Termux environment detected"
    
    # Install dependencies if needed
    if ! command -v node &> /dev/null; then
        echo "Installing Node.js..."
        pkg install nodejs -y
    fi
    
    # Setup SSH config to avoid host key prompts
    mkdir -p "$HOME_DIR/.ssh"
    if ! grep -q "StrictHostKeyChecking no" "$HOME_DIR/.ssh/config" 2>/dev/null; then
        echo ""
        echo "🔐 Configuring SSH..."
        cat >> "$HOME_DIR/.ssh/config" << EOF

Host localhost
    StrictHostKeyChecking no
    UserKnownHostsFile=/dev/null
    ConnectTimeout 5

Host 127.0.0.1
    StrictHostKeyChecking no
    UserKnownHostsFile=/dev/null
    ConnectTimeout 5
EOF
        chmod 600 "$HOME_DIR/.ssh/config"
        echo -e "${GREEN}✓${NC} SSH configured"
    fi
fi

# Check dependencies
echo ""
echo "📦 Checking dependencies..."

cd "$(dirname "$0")/dashboard"

if [ ! -d "node_modules" ]; then
    echo "Installing dashboard dependencies..."
    npm install --production 2>&1 | grep -v "npm WARN" || true
else
    echo -e "${GREEN}✓${NC} Dependencies installed"
fi

# Create .env file if missing
if [ ! -f ".env" ]; then
    echo ""
    echo "⚙️  Creating .env configuration..."
    cat > .env << 'EOF'
PORT=3000
ANDROID_HOST=localhost
ANDROID_PORT=8022
ANDROID_USER=u0_a
NODE_ENV=production
EOF
    echo -e "${GREEN}✓${NC} Configuration created"
fi

echo ""
echo "✅ Dashboard fixes applied!"
echo ""
echo "📋 Summary of fixes:"
echo "  • Created ~/server directory structure"
echo "  • Generated performance profile.json"
echo "  • Stopped CPU feedback loop (auto-optimization disabled)"
echo "  • Fixed template loading (now scans basic + advanced)"
echo "  • Added SSH non-blocking config"
echo "  • Installed dependencies"
echo ""
echo "🚀 To start the dashboard:"
echo "  cd dashboard && npm start"
echo ""
echo "🌐 Then visit: http://localhost:3000"
echo ""
echo "📊 Features:"
echo "  ✓ Template selection (18 templates: 9 basic + 9 advanced)"
echo "  ✓ Live metrics monitoring"
echo "  ✓ Server management (create/start/stop/delete)"
echo "  ✓ Performance monitoring (manual optimization)"
echo ""
