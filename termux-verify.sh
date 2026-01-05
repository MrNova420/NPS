#!/data/data/com.termux/files/usr/bin/bash
# NPS Termux Compatibility Verifier & Optimizer
# Ensures all components work perfectly on Android/Termux

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     NPS Termux Compatibility Verifier & Optimizer             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Detect if running in Termux
if [ ! -d "/data/data/com.termux" ]; then
    echo -e "${RED}✗ Not running in Termux!${NC}"
    echo "This script must be run inside Termux on Android."
    exit 1
fi

echo -e "${GREEN}✓ Running in Termux${NC}"
echo ""

# Check Termux version
echo "=== System Information ==="
echo "Termux Version: $(pkg list-installed | grep '^termux/' | head -1)"
echo "Android Version: $(getprop ro.build.version.release)"
echo "Device: $(getprop ro.product.model)"
echo "Architecture: $(uname -m)"
echo ""

# Function to check package
check_pkg() {
    if pkg list-installed 2>/dev/null | grep -q "^$1/"; then
        echo -e "${GREEN}✓${NC} $1 installed"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} $1 not installed"
        return 1
    fi
}

# Check required packages
echo "=== Checking Required Packages ==="
MISSING_PKGS=()

for pkg in nodejs python git openssh wget curl nano; do
    if ! check_pkg $pkg; then
        MISSING_PKGS+=($pkg)
    fi
done

if [ ${#MISSING_PKGS[@]} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}Installing missing packages...${NC}"
    pkg update -y
    pkg install -y "${MISSING_PKGS[@]}"
    echo -e "${GREEN}✓ Packages installed${NC}"
fi

echo ""

# Check Node.js version
echo "=== Checking Node.js ==="
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js: $NODE_VERSION${NC}"
    
    MAJOR=$(echo $NODE_VERSION | sed 's/v//' | cut -d. -f1)
    if [ $MAJOR -ge 14 ]; then
        echo -e "${GREEN}✓ Node.js version compatible${NC}"
    else
        echo -e "${RED}✗ Node.js version too old (need 14+)${NC}"
        echo "Updating Node.js..."
        pkg upgrade nodejs -y
    fi
else
    echo -e "${RED}✗ Node.js not found${NC}"
    pkg install nodejs -y
fi

echo ""

# Check npm
echo "=== Checking npm ==="
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓ npm: $NPM_VERSION${NC}"
else
    echo -e "${RED}✗ npm not found${NC}"
fi

echo ""

# Check Python
echo "=== Checking Python ==="
if command -v python &> /dev/null; then
    PYTHON_VERSION=$(python --version)
    echo -e "${GREEN}✓ Python: $PYTHON_VERSION${NC}"
else
    echo -e "${YELLOW}⚠ Python not found${NC}"
    pkg install python -y
fi

echo ""

# Check storage access
echo "=== Checking Storage Access ==="
if [ -d "$HOME/storage/shared" ]; then
    echo -e "${GREEN}✓ Storage access granted${NC}"
else
    echo -e "${YELLOW}⚠ Storage access not granted${NC}"
    echo "Requesting storage access..."
    termux-setup-storage
fi

echo ""

# Check SSH
echo "=== Checking SSH ==="
if command -v sshd &> /dev/null; then
    echo -e "${GREEN}✓ SSH server available${NC}"
    
    # Check if SSH is running
    if pgrep sshd > /dev/null; then
        echo -e "${GREEN}✓ SSH server is running${NC}"
    else
        echo -e "${YELLOW}⚠ SSH server not running${NC}"
        echo "Start with: sshd"
    fi
    
    # Check SSH keys
    if [ -f "$HOME/.ssh/id_rsa" ]; then
        echo -e "${GREEN}✓ SSH keys exist${NC}"
    else
        echo -e "${YELLOW}⚠ SSH keys not found${NC}"
        echo "Generating SSH keys..."
        mkdir -p ~/.ssh
        chmod 700 ~/.ssh
        ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""
        echo -e "${GREEN}✓ SSH keys generated${NC}"
    fi
else
    echo -e "${RED}✗ SSH not available${NC}"
    pkg install openssh -y
fi

echo ""

# Check network
echo "=== Checking Network ==="
if ping -c 1 8.8.8.8 &> /dev/null; then
    echo -e "${GREEN}✓ Internet connection active${NC}"
    
    # Get IP address
    IP=$(ip addr show wlan0 2>/dev/null | grep "inet " | awk '{print $2}' | cut -d/ -f1)
    if [ -n "$IP" ]; then
        echo -e "${GREEN}✓ Device IP: $IP${NC}"
        echo "  Connect from PC: ssh -p 8022 $(whoami)@$IP"
    else
        echo -e "${YELLOW}⚠ Could not determine IP address${NC}"
        echo "  Run: ifconfig"
    fi
else
    echo -e "${YELLOW}⚠ No internet connection${NC}"
fi

echo ""

# Check available RAM
echo "=== Checking Resources ==="
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
FREE_RAM=$(free -m | awk '/^Mem:/{print $4}')
echo "RAM: ${FREE_RAM}MB free / ${TOTAL_RAM}MB total"

if [ $TOTAL_RAM -ge 4096 ]; then
    echo -e "${GREEN}✓ Excellent RAM (4GB+) - High tier device${NC}"
elif [ $TOTAL_RAM -ge 2048 ]; then
    echo -e "${YELLOW}✓ Good RAM (2-4GB) - Medium tier device${NC}"
else
    echo -e "${YELLOW}⚠ Limited RAM (<2GB) - Low tier device${NC}"
    echo "  Some features may be limited"
fi

# Check available storage
AVAILABLE_STORAGE=$(df -h $HOME | tail -1 | awk '{print $4}')
echo "Storage: ${AVAILABLE_STORAGE} available"

echo ""

# Optimize Termux settings
echo "=== Optimizing Termux Settings ==="

# Increase file limits
echo "Adjusting file limits..."
echo "ulimit -n 4096" >> ~/.bashrc

# Setup Termux services if available
if [ -d "$PREFIX/var/service" ]; then
    echo -e "${GREEN}✓ Termux services available${NC}"
else
    echo "Installing Termux services..."
    pkg install termux-services -y
    echo -e "${GREEN}✓ Termux services installed${NC}"
fi

echo ""

# Create NPS directory structure
echo "=== Setting Up NPS Directories ==="
mkdir -p ~/server/{instances,backups,logs,config,scripts}
mkdir -p ~/server/config/{performance,security,network}
echo -e "${GREEN}✓ NPS directories created${NC}"

echo ""

# Create Termux-optimized performance profile
echo "=== Creating Performance Profile ==="
cat > ~/server/config/termux-profile.json << 'EOF'
{
  "device": {
    "platform": "android-termux",
    "optimizations": {
      "useTermuxAPI": true,
      "batteryOptimization": true,
      "thermalMonitoring": true,
      "wakelock": false
    }
  },
  "limits": {
    "maxProcesses": 10,
    "maxMemoryMB": 512,
    "maxCPUPercent": 80
  },
  "paths": {
    "prefix": "$PREFIX",
    "home": "$HOME",
    "storage": "$HOME/storage",
    "tmp": "$PREFIX/tmp"
  }
}
EOF
echo -e "${GREEN}✓ Performance profile created${NC}"

echo ""

# Create helper scripts
echo "=== Creating Helper Scripts ==="

# Network info script
cat > ~/server/scripts/network-info.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
echo "=== Network Information ==="
echo "IP Address: $(ip addr show wlan0 2>/dev/null | grep "inet " | awk '{print $2}' | cut -d/ -f1)"
echo "SSH Port: 8022"
echo "Username: $(whoami)"
echo ""
echo "Connect from PC:"
echo "  ssh -p 8022 $(whoami)@$(ip addr show wlan0 2>/dev/null | grep "inet " | awk '{print $2}' | cut -d/ -f1)"
EOF
chmod +x ~/server/scripts/network-info.sh

# Quick start script
cat > ~/server/scripts/quick-start.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
echo "Starting NPS services..."

# Start SSH
if ! pgrep sshd > /dev/null; then
    sshd
    echo "✓ SSH started"
fi

# Show connection info
bash ~/server/scripts/network-info.sh

echo ""
echo "NPS is ready!"
echo "Access dashboard from PC: http://$(ip addr show wlan0 2>/dev/null | grep "inet " | awk '{print $2}' | cut -d/ -f1):3000"
EOF
chmod +x ~/server/scripts/quick-start.sh

# Battery monitor script
if command -v termux-battery-status &> /dev/null; then
    cat > ~/server/scripts/battery-monitor.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
while true; do
    STATUS=$(termux-battery-status)
    PERCENTAGE=$(echo $STATUS | jq -r '.percentage')
    
    if [ $PERCENTAGE -lt 20 ]; then
        echo "⚠️  Battery low: ${PERCENTAGE}%"
        # Optionally reduce server load
    fi
    
    sleep 300  # Check every 5 minutes
done
EOF
    chmod +x ~/server/scripts/battery-monitor.sh
fi

echo -e "${GREEN}✓ Helper scripts created${NC}"

echo ""

# Install Termux-API if not present
echo "=== Checking Termux:API ==="
if command -v termux-battery-status &> /dev/null; then
    echo -e "${GREEN}✓ Termux:API installed${NC}"
else
    echo -e "${YELLOW}⚠ Termux:API not installed${NC}"
    echo "Install from F-Droid for enhanced features:"
    echo "  - Battery monitoring"
    echo "  - Notification support"
    echo "  - Contact access"
    echo "  - Location services"
fi

echo ""

# Check for root (optional)
echo "=== Checking Root Access ==="
if command -v su &> /dev/null; then
    if su -c "echo test" &> /dev/null; then
        echo -e "${GREEN}✓ Root access available${NC}"
        echo "  Enhanced features enabled:"
        echo "  - Port 80/443 binding"
        echo "  - Advanced networking"
        echo "  - System-wide optimizations"
    else
        echo -e "${YELLOW}⚠ Root available but access denied${NC}"
    fi
else
    echo -e "${YELLOW}⚠ No root access${NC}"
    echo "  Most features work without root"
    echo "  Some advanced features may be limited"
fi

echo ""

# Final summary
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                  Verification Complete!                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}✓ NPS is ready for use on Termux!${NC}"
echo ""
echo "Quick Commands:"
echo "  Start services:  bash ~/server/scripts/quick-start.sh"
echo "  Network info:    bash ~/server/scripts/network-info.sh"
echo "  Start SSH:       sshd"
echo "  View IP:         ifconfig"
echo ""
echo "Next Steps:"
echo "  1. Start SSH server: sshd"
echo "  2. Note your IP address"
echo "  3. Connect from PC and run NPS dashboard"
echo ""
echo "For help, see: START_HERE.md"
echo ""
