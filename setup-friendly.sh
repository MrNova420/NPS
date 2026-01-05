#!/bin/bash
#
# NPS - Nova Private Server - Setup Script
# User-friendly setup for Android/Termux and PC
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Detect environment
TERMUX_ENV=false
if [ -n "$TERMUX_VERSION" ] || [ -n "$PREFIX" ]; then
    TERMUX_ENV=true
fi

# Banner
print_banner() {
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║   NPS - Nova Private Server                                   ║"
    echo "║   Transform Your Android Into a Production Server             ║"
    echo "║                                                                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Print step
print_step() {
    echo -e "${BLUE}▶${NC} $1"
}

# Print success
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Print warning
print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Print error
print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Print info
print_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detect system specs
detect_system() {
    print_step "Detecting system specifications..."
    
    # CPU info
    CPU_CORES=$(nproc 2>/dev/null || echo "unknown")
    CPU_ARCH=$(uname -m)
    
    # Memory info
    if command_exists free; then
        TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
        TOTAL_SWAP=$(free -m | awk '/^Swap:/{print $2}')
    else
        TOTAL_RAM="unknown"
        TOTAL_SWAP="unknown"
    fi
    
    # Disk info
    DISK_AVAIL=$(df -h $HOME | tail -1 | awk '{print $4}')
    
    echo ""
    print_info "System Specifications:"
    echo "  CPU: $CPU_CORES cores ($CPU_ARCH)"
    echo "  RAM: ${TOTAL_RAM}MB"
    echo "  Swap: ${TOTAL_SWAP}MB"
    echo "  Disk Available: $DISK_AVAIL"
    echo ""
}

# Install dependencies for Termux
install_termux_deps() {
    print_step "Installing Termux dependencies..."
    
    # Update package lists
    pkg update -y
    
    # Essential packages
    PACKAGES="git nodejs openssh python postgresql redis"
    
    for pkg in $PACKAGES; do
        if ! pkg list-installed 2>/dev/null | grep -q "^$pkg/"; then
            print_step "Installing $pkg..."
            pkg install -y $pkg
            print_success "$pkg installed"
        else
            print_info "$pkg already installed"
        fi
    done
    
    print_success "Termux dependencies installed"
}

# Install dependencies for PC (Debian/Ubuntu)
install_pc_deps() {
    print_step "Installing PC dependencies..."
    
    # Check if running as root or has sudo
    if [ "$EUID" -ne 0 ] && ! command_exists sudo; then
        print_error "This script needs sudo access to install dependencies"
        exit 1
    fi
    
    SUDO=""
    if [ "$EUID" -ne 0 ]; then
        SUDO="sudo"
    fi
    
    # Update package lists
    $SUDO apt-get update -y
    
    # Essential packages
    $SUDO apt-get install -y git nodejs npm openssh-client python3 python3-pip
    
    print_success "PC dependencies installed"
}

# Setup NPS directory structure
setup_directories() {
    print_step "Creating directory structure..."
    
    mkdir -p $HOME/server/{instances,logs,backups,state,config,temp}
    
    print_success "Directory structure created"
}

# Create default configuration
create_config() {
    print_step "Creating default configuration..."
    
    # Device profile
    cat > $HOME/server/config/profile.json << EOF
{
  "device": {
    "tier": "auto-detect",
    "cpu_cores": $CPU_CORES,
    "ram_mb": $TOTAL_RAM,
    "storage_gb": "auto-detect"
  },
  "limits": {
    "max_servers": "auto",
    "max_memory_per_server_mb": "auto",
    "max_cpu_per_server_percent": "auto",
    "worker_processes": "auto"
  },
  "optimization": {
    "swap_enabled": true,
    "cache_size_mb": "auto",
    "tcp_window_kb": "auto",
    "max_connections": "auto"
  },
  "thermal": {
    "max_temp_c": 75,
    "throttle_temp_c": 70,
    "critical_temp_c": 80
  }
}
EOF

    # Monitoring config
    cat > $HOME/server/config/monitoring.json << EOF
{
  "thresholds": {
    "cpu": { "warning": 70, "critical": 90 },
    "memory": { "warning": 80, "critical": 95 },
    "disk": { "warning": 85, "critical": 95 },
    "network": { "warning": 80, "critical": 95 },
    "temperature": { "warning": 70, "critical": 85 }
  },
  "alertChannels": [],
  "checkInterval": 5000
}
EOF

    print_success "Configuration files created"
}

# Setup SSH for Termux
setup_ssh() {
    if [ "$TERMUX_ENV" = true ]; then
        print_step "Setting up SSH server..."
        
        # Generate SSH keys if they don't exist
        if [ ! -f "$HOME/.ssh/id_rsa" ]; then
            ssh-keygen -t rsa -b 2048 -f $HOME/.ssh/id_rsa -N ""
            print_success "SSH keys generated"
        fi
        
        # Start SSH server
        sshd
        print_success "SSH server started on port 8022"
        
        # Get IP address
        IP=$(ifconfig 2>/dev/null | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -1)
        
        if [ -n "$IP" ]; then
            echo ""
            print_info "Your device IP: $IP"
            print_info "SSH connection: ssh -p 8022 $(whoami)@$IP"
            echo ""
        fi
    fi
}

# Install dashboard dependencies
install_dashboard() {
    print_step "Installing dashboard dependencies..."
    
    cd dashboard
    npm install --production
    cd ..
    
    print_success "Dashboard dependencies installed"
}

# Create startup script
create_startup_script() {
    print_step "Creating startup script..."
    
    cat > $HOME/server/start-nps.sh << 'EOF'
#!/bin/bash
# NPS Startup Script

cd "$(dirname "$0")/.."

# Start SSH if in Termux
if [ -n "$TERMUX_VERSION" ]; then
    sshd 2>/dev/null
    echo "SSH server started"
fi

# Start dashboard
echo "Starting NPS Dashboard..."
cd dashboard
node backend/server.js &
DASHBOARD_PID=$!

echo "NPS Dashboard started (PID: $DASHBOARD_PID)"
echo "Access at: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop"

# Wait for interrupt
trap "kill $DASHBOARD_PID 2>/dev/null; echo 'NPS stopped'; exit" INT TERM

wait $DASHBOARD_PID
EOF

    chmod +x $HOME/server/start-nps.sh
    
    print_success "Startup script created"
}

# Create convenience scripts
create_convenience_scripts() {
    print_step "Creating convenience scripts..."
    
    # Status script
    cat > $HOME/server/status.sh << 'EOF'
#!/bin/bash
echo "=== NPS Status ==="
echo ""
echo "System Resources:"
echo "  CPU: $(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1"%"}')"
echo "  Memory: $(free -h | awk '/^Mem:/{printf "%s / %s (%.1f%%)", $3, $2, ($3/$2)*100}')"
echo "  Disk: $(df -h $HOME | tail -1 | awk '{print $3 " / " $2 " (" $5 ")"}')"
echo ""

if pgrep -f "node.*server.js" > /dev/null; then
    echo "Dashboard: Running ✓"
else
    echo "Dashboard: Stopped ✗"
fi

echo ""
echo "Servers:"
ls -1 $HOME/server/instances 2>/dev/null | wc -l | xargs echo "  Total instances:"
EOF

    chmod +x $HOME/server/status.sh
    
    # Cleanup script
    cat > $HOME/server/cleanup.sh << 'EOF'
#!/bin/bash
echo "=== NPS Cleanup ==="
echo ""
echo "This will:"
echo "  - Remove old logs (>7 days)"
echo "  - Remove old backups (>30 days)"
echo "  - Clean temporary files"
echo "  - Clean npm cache"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Clean old logs
    find $HOME/server/instances/*/logs -name "*.log" -mtime +7 -delete 2>/dev/null
    echo "✓ Cleaned old logs"
    
    # Clean old backups
    find $HOME/server/backups -mtime +30 -delete 2>/dev/null
    echo "✓ Cleaned old backups"
    
    # Clean temp
    rm -rf $HOME/server/temp/*
    echo "✓ Cleaned temp files"
    
    # Clean npm cache
    npm cache clean --force 2>/dev/null
    echo "✓ Cleaned npm cache"
    
    echo ""
    echo "Cleanup complete!"
fi
EOF

    chmod +x $HOME/server/cleanup.sh
    
    print_success "Convenience scripts created"
}

# Create quick reference
create_quick_reference() {
    cat > $HOME/server/QUICK_START.txt << 'EOF'
╔════════════════════════════════════════════════════════════════╗
║           NPS - QUICK START GUIDE                              ║
╚════════════════════════════════════════════════════════════════╝

🚀 START NPS
  ~/server/start-nps.sh

📊 CHECK STATUS
  ~/server/status.sh

🧹 CLEANUP
  ~/server/cleanup.sh

🌐 DASHBOARD
  URL: http://localhost:3000
  The dashboard provides a visual interface to manage all servers

📱 ON ANDROID/TERMUX
  SSH: sshd
  Get IP: ifconfig
  Connect from PC: ssh -p 8022 user@phone-ip

💻 FROM PC
  cd dashboard
  npm start

🔧 COMMON TASKS

  Create a server:
    - Open dashboard
    - Click a template
    - Fill in details
    - Click Create

  View server logs:
    - Dashboard → Servers → Click server → Logs
    - Or: tail -f ~/server/instances/<id>/logs/server.log

  Stop a server:
    - Dashboard → Servers → Click server → Stop

  System info:
    - Dashboard → System tab

📚 DOCUMENTATION
  README.md - Full documentation
  START_HERE.md - Detailed setup guide
  docs/ - Additional guides

🆘 TROUBLESHOOTING
  - Check ~/server/logs/ for error logs
  - Run ~/server/status.sh to see system state
  - Ensure SSH is running (sshd)
  - Check network connectivity
  - Verify port availability

💡 TIPS
  - Keep at least 2GB free disk space
  - Monitor temperature on intensive workloads
  - Use cleanup.sh weekly
  - Check dashboard health endpoint

EOF

    print_success "Quick reference created"
}

# Run system tests
run_tests() {
    print_step "Running system tests..."
    
    TESTS_PASSED=0
    TESTS_FAILED=0
    
    # Test Node.js
    if command_exists node; then
        NODE_VERSION=$(node --version)
        print_success "Node.js: $NODE_VERSION"
        ((TESTS_PASSED++))
    else
        print_error "Node.js not found"
        ((TESTS_FAILED++))
    fi
    
    # Test npm
    if command_exists npm; then
        NPM_VERSION=$(npm --version)
        print_success "npm: $NPM_VERSION"
        ((TESTS_PASSED++))
    else
        print_error "npm not found"
        ((TESTS_FAILED++))
    fi
    
    # Test directory structure
    if [ -d "$HOME/server/instances" ]; then
        print_success "Directory structure OK"
        ((TESTS_PASSED++))
    else
        print_error "Directory structure incomplete"
        ((TESTS_FAILED++))
    fi
    
    echo ""
    echo "Tests: $TESTS_PASSED passed, $TESTS_FAILED failed"
}

# Main installation
main() {
    clear
    print_banner
    
    echo -e "${CYAN}Welcome to NPS Setup!${NC}"
    echo ""
    
    if [ "$TERMUX_ENV" = true ]; then
        print_info "Detected: Termux/Android"
        echo ""
    else
        print_info "Detected: Linux/PC"
        echo ""
    fi
    
    # System detection
    detect_system
    
    # Install dependencies
    if [ "$TERMUX_ENV" = true ]; then
        install_termux_deps
    else
        install_pc_deps
    fi
    
    # Setup
    setup_directories
    create_config
    setup_ssh
    install_dashboard
    create_startup_script
    create_convenience_scripts
    create_quick_reference
    
    # Run tests
    echo ""
    run_tests
    
    # Success message
    echo ""
    print_success "Setup complete!"
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  NPS is ready to use!                                         ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Start NPS:"
    echo -e "   ${CYAN}~/server/start-nps.sh${NC}"
    echo ""
    echo "2. Open dashboard:"
    echo -e "   ${CYAN}http://localhost:3000${NC}"
    echo ""
    echo "3. Read the quick start guide:"
    echo -e "   ${CYAN}cat ~/server/QUICK_START.txt${NC}"
    echo ""
    
    if [ "$TERMUX_ENV" = true ]; then
        IP=$(ifconfig 2>/dev/null | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -1)
        if [ -n "$IP" ]; then
            echo "4. Connect from PC (optional):"
            echo -e "   ${CYAN}ssh -p 8022 $(whoami)@$IP${NC}"
            echo ""
        fi
    fi
}

# Run main
main
