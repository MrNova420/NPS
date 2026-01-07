#!/bin/bash
# NPS Quick Setup Script
# Automates the setup process for NPS

set -e

echo "╔══════════════════════════════════════════════════╗"
echo "║       NPS - Nova's Private Server Setup         ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Detect environment
IS_TERMUX=false
if [ -n "$TERMUX_VERSION" ] || [ -n "$PREFIX" ]; then
    IS_TERMUX=true
fi

if $IS_TERMUX; then
    echo "✓ Detected Termux environment"
    echo "  Running in LOCAL mode (no SSH needed)"
else
    echo "✓ Detected PC environment"
    echo "  Will set up for REMOTE mode (SSH to Android)"
fi
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command_exists node; then
    echo "❌ Node.js not found"
    if $IS_TERMUX; then
        echo "   Installing Node.js..."
        pkg install -y nodejs
    else
        echo "   Please install Node.js 14+ from https://nodejs.org"
        exit 1
    fi
else
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 14 ]; then
        echo "❌ Node.js version too old ($NODE_VERSION). Need 14+"
        exit 1
    fi
    echo "✓ Node.js $(node --version)"
fi

if ! command_exists npm; then
    echo "❌ npm not found"
    if $IS_TERMUX; then
        echo "   Installing npm..."
        pkg install -y nodejs-lts
    else
        echo "   Please install npm"
        exit 1
    fi
else
    echo "✓ npm $(npm --version)"
fi

if ! command_exists git; then
    echo "❌ git not found"
    if $IS_TERMUX; then
        echo "   Installing git..."
        pkg install -y git
    else
        echo "   Please install git"
        exit 1
    fi
else
    echo "✓ git $(git --version | head -1)"
fi

echo ""

# Create necessary directories
echo "📁 Creating directory structure..."
mkdir -p ~/server/{instances,logs,config,backups,state,temp}
echo "✓ Directories created"
echo ""

# Install dashboard dependencies
echo "📦 Installing dashboard dependencies..."
cd dashboard
if ! npm list express >/dev/null 2>&1; then
    npm install --production
    echo "✓ Dependencies installed"
else
    echo "✓ Dependencies already installed"
fi
cd ..
echo ""

# Create default config if needed
if [ ! -f ~/server/config/profile.json ]; then
    echo "⚙️  Creating default configuration..."
    
    # Detect system specs
    if command -v free >/dev/null 2>&1; then
        TOTAL_MEM=$(free -m 2>/dev/null | awk '/Mem:/ {print $2}' || echo "2048")
    elif [ -f /proc/meminfo ]; then
        TOTAL_MEM=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
    else
        TOTAL_MEM=2048
    fi
    
    if command -v nproc >/dev/null 2>&1; then
        CPU_CORES=$(nproc)
    elif [ -f /proc/cpuinfo ]; then
        CPU_CORES=$(grep -c ^processor /proc/cpuinfo)
    else
        CPU_CORES=2
    fi
    
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
    
    cat > ~/server/config/profile.json << EOF
{
  "device": {
    "tier": "$TIER",
    "cpu_cores": $CPU_CORES,
    "ram_mb": $TOTAL_MEM
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
    echo "✓ Configuration created (tier: $TIER)"
else
    echo "✓ Configuration already exists"
fi
echo ""

# Set up environment file for remote mode
if ! $IS_TERMUX; then
    if [ ! -f dashboard/.env ]; then
        echo "🔧 Setting up remote configuration..."
        echo ""
        echo "Please provide your Android device details:"
        echo ""
        
        # Get Android IP
        read -p "Android device IP (e.g., 192.168.1.100): " ANDROID_IP
        if [ -z "$ANDROID_IP" ]; then
            ANDROID_IP="192.168.1.100"
            echo "  Using default: $ANDROID_IP"
        fi
        
        # Get SSH port
        read -p "SSH port (default: 8022): " SSH_PORT
        if [ -z "$SSH_PORT" ]; then
            SSH_PORT="8022"
        fi
        
        # Get SSH user
        read -p "SSH username (run 'whoami' on Android): " SSH_USER
        if [ -z "$SSH_USER" ]; then
            SSH_USER="u0_a"
            echo "  Using default: $SSH_USER"
        fi
        
        # Create .env file
        cat > dashboard/.env << EOF
# NPS Configuration
ANDROID_HOST=$ANDROID_IP
ANDROID_PORT=$SSH_PORT
ANDROID_USER=$SSH_USER
PORT=3000
NODE_ENV=production
EOF
        echo ""
        echo "✓ Configuration saved to dashboard/.env"
        echo ""
        echo "📝 Note: Test SSH connection with:"
        echo "   ssh -p $SSH_PORT $SSH_USER@$ANDROID_IP"
    else
        echo "✓ Environment file already exists"
    fi
fi
echo ""

# SSH setup for remote mode
if ! $IS_TERMUX && command_exists ssh; then
    if [ -f dashboard/.env ]; then
        source dashboard/.env
        echo "🔐 Testing SSH connection..."
        if ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -p "$ANDROID_PORT" "$ANDROID_USER@$ANDROID_HOST" "echo 'Connection OK'" 2>/dev/null; then
            echo "✓ SSH connection successful"
        else
            echo "⚠️  SSH connection failed"
            echo ""
            echo "To set up password-free SSH:"
            echo "1. Generate SSH key (if needed): ssh-keygen -t rsa"
            echo "2. Copy to Android: ssh-copy-id -p $ANDROID_PORT $ANDROID_USER@$ANDROID_HOST"
            echo "3. Or use: bash setup-ssh-keys.sh"
            echo ""
            echo "On Android, make sure SSH is running:"
            echo "   sshd"
        fi
    fi
fi
echo ""

# Verify installation
echo "✅ Setup complete!"
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║              Ready to Start!                     ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "To start the dashboard:"
echo ""
if $IS_TERMUX; then
    echo "  cd ~/NPS/dashboard"
    echo "  npm start"
    echo ""
    echo "Then open in browser:"
    echo "  http://localhost:3000"
else
    echo "  cd dashboard"
    echo "  npm start"
    echo ""
    echo "Then open in browser:"
    echo "  http://localhost:3000"
    echo ""
    echo "Make sure SSH server is running on Android:"
    echo "  On Android: sshd"
fi
echo ""
echo "📚 For detailed guide, see: SETUP_GUIDE.md"
echo "🚀 For quick usage, see: QUICK_USAGE.md"
echo ""
