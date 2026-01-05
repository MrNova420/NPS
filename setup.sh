#!/bin/bash
# Master Setup Script for Android Server Manager v2.0

set -e

echo "╔═══════════════════════════════════════════════════╗"
echo "║  Android Server Manager v2.0 - Master Setup      ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running on PC or Android
if [ -d "/data/data/com.termux" ]; then
    PLATFORM="android"
else
    PLATFORM="pc"
fi

echo -e "${BLUE}Detected platform: ${PLATFORM}${NC}"
echo ""

if [ "$PLATFORM" = "android" ]; then
    echo "=== Android Setup ==="
    echo ""
    
    # Run Android setup
    bash setup/android/termux-setup.sh
    
    # Additional setup for dashboard
    echo "Creating instances directory..."
    mkdir -p ~/server/instances
    
    # Install Node.js and Python packages
    echo "Installing additional packages..."
    pkg install -y nodejs python

    npm -y
    pip install flask onnxruntime numpy
    
    echo ""
    echo -e "${GREEN}✓ Android setup complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Find your IP: ifconfig"
    echo "2. Start SSH: sshd"
    echo "3. On your PC, connect to this IP"
    echo ""
    
else
    echo "=== PC Setup ==="
    echo ""
    
    # Check prerequisites
    echo "Checking prerequisites..."
    
    command -v node >/dev/null 2>&1 || { echo -e "${RED}Node.js is required but not installed.${NC}"; exit 1; }
    command -v npm >/dev/null 2>&1 || { echo -e "${RED}npm is required but not installed.${NC}"; exit 1; }
    command -v ssh >/dev/null 2>&1 || { echo -e "${RED}SSH client is required but not installed.${NC}"; exit 1; }
    
    echo -e "${GREEN}✓ Prerequisites check passed${NC}"
    echo ""
    
    # Install dashboard dependencies
    echo "Installing dashboard dependencies..."
    cd dashboard
    npm install
    cd ..
    
    # Install CLI dependencies
    echo "Installing CLI dependencies..."
    cd cli
    npm install node-fetch
    cd ..
    
    # Make scripts executable
    echo "Setting up scripts..."
    chmod +x setup/pc/pc-client.py
    chmod +x cli/manager-cli.js
    chmod +x monitoring/monitor.sh
    chmod +x automation/task-scheduler.py
    
    # Create config file
    echo "Creating configuration..."
    cat > .env << EOF
# Android Server Manager Configuration
# Edit these values to match your Android device

# Android device connection
ANDROID_HOST=192.168.1.100
ANDROID_PORT=8022
ANDROID_USER=u0_a

# Dashboard settings
PORT=3000
NODE_ENV=development

# Optional: API security
# API_KEY=your-secret-key
# ENABLE_AUTH=false
EOF
    
    echo -e "${GREEN}✓ Configuration file created (.env)${NC}"
    echo ""
    
    # Create launcher scripts
    cat > start-dashboard.sh << 'EOF'
#!/bin/bash
source .env
cd dashboard
echo "Starting Android Server Manager Dashboard..."
echo "Dashboard: http://localhost:${PORT}"
echo "Android: ${ANDROID_USER}@${ANDROID_HOST}:${ANDROID_PORT}"
echo ""
node backend/server.js
EOF
    
    cat > start-cli.sh << 'EOF'
#!/bin/bash
source .env
cd cli
node manager-cli.js
EOF
    
    chmod +x start-dashboard.sh start-cli.sh
    
    echo -e "${GREEN}✓ Launcher scripts created${NC}"
    echo ""
    
    # Success message
    echo "╔═══════════════════════════════════════════════════╗"
    echo "║           ✓ Setup Complete!                      ║"
    echo "╚═══════════════════════════════════════════════════╝"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo ""
    echo "1. Edit .env file with your Android device IP"
    echo "   nano .env"
    echo ""
    echo "2. Make sure Android device is running and SSH is enabled"
    echo ""
    echo "3. Test connection:"
    echo "   ssh -p 8022 user@<android-ip>"
    echo ""
    echo "4. Start the dashboard:"
    echo "   ./start-dashboard.sh"
    echo "   or: cd dashboard && npm start"
    echo ""
    echo "5. Open in browser:"
    echo "   http://localhost:3000"
    echo ""
    echo "6. Or use CLI:"
    echo "   ./start-cli.sh"
    echo ""
    echo -e "${GREEN}Documentation:${NC}"
    echo "  • ADVANCED_README.md - Full feature guide"
    echo "  • QUICKSTART.md - Quick start guide"
    echo "  • docs/ - Complete documentation"
    echo ""
    echo -e "${BLUE}Happy server managing! 🚀${NC}"
    echo ""
fi
