#!/bin/bash
# PC-side installer script

echo "========================================="
echo "Android Server Control - PC Setup"
echo "========================================="
echo ""

# Check prerequisites
command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required but not installed. Aborting." >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v ssh >/dev/null 2>&1 || { echo "SSH client is required but not installed. Aborting." >&2; exit 1; }

echo "✓ Prerequisites check passed"
echo ""

# Make scripts executable
chmod +x setup/pc/pc-client.py
chmod +x monitoring/monitor.sh
chmod +x automation/task-scheduler.py

echo "✓ Made scripts executable"
echo ""

# Install Node dependencies
echo "Installing Node.js dependencies..."
cd control-panel
npm install
cd ..

echo "✓ Node.js dependencies installed"
echo ""

# Create convenience aliases
echo "Creating convenience aliases..."
cat >> ~/.bashrc << 'EOF'

# Android Server Control aliases
alias android-shell='ssh -p 8022'
alias android-info='./setup/pc/pc-client.py'
EOF

echo "✓ Aliases added to ~/.bashrc"
echo ""

# Create desktop launcher (Linux only)
if [ "$(uname)" == "Linux" ]; then
    mkdir -p ~/.local/share/applications
    cat > ~/.local/share/applications/android-server-control.desktop << EOF
[Desktop Entry]
Type=Application
Name=Android Server Control
Comment=Control panel for Android server
Exec=bash -c "cd $(pwd)/control-panel && npm start"
Icon=phone
Terminal=true
Categories=Development;System;
EOF
    echo "✓ Desktop launcher created"
fi

echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "Quick Start:"
echo "1. Get your Android phone's IP address"
echo "2. Test connection: ssh -p 8022 <user>@<phone-ip>"
echo "3. Use Python client: ./setup/pc/pc-client.py <phone-ip> info"
echo "4. Launch web UI:"
echo "   cd control-panel"
echo "   export ANDROID_HOST=<phone-ip>"
echo "   export ANDROID_USER=<username>"
echo "   npm start"
echo ""
echo "Documentation:"
echo "  - QUICKSTART.md - Quick start guide"
echo "  - docs/SETUP_GUIDE.md - Complete setup"
echo "  - docs/SERVICE_EXAMPLES.md - Service configs"
echo ""
