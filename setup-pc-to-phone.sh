#!/bin/bash
# PC to Android Phone Connection Setup

echo "╔════════════════════════════════════════════════════╗"
echo "║  NPS - PC to Android Phone Connection Setup       ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "This script helps you connect your PC to your Android phone."
echo ""

# Step 1: Get phone's IP
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Find your phone's IP address"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "On your Android phone (in Termux):"
echo "  1. Open Termux"
echo "  2. Run: ifconfig"
echo "  3. Look for 'wlan0' and find 'inet' address"
echo "     Example: inet 192.168.1.50"
echo ""
read -p "Enter your phone's IP address: " PHONE_IP

if [ -z "$PHONE_IP" ]; then
    echo -e "${RED}Error: IP address required${NC}"
    exit 1
fi

# Validate IP format
if ! [[ $PHONE_IP =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    echo -e "${RED}Error: Invalid IP address format${NC}"
    echo "Expected format: 192.168.1.50"
    exit 1
fi

# Step 2: Get SSH username
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Get SSH username"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "On your Android phone (in Termux):"
echo "  Run: whoami"
echo ""
read -p "Enter the username (or press Enter for 'u0_a'): " SSH_USER
SSH_USER=${SSH_USER:-u0_a}

# Step 3: SSH port
SSH_PORT=8022
echo ""
echo "Using SSH port: $SSH_PORT (Termux default)"

# Step 4: Test SSH connection
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Ensure SSH server is running on phone"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "On your Android phone (in Termux):"
echo "  1. Install SSH: pkg install openssh"
echo "  2. Start SSH: sshd"
echo "  3. Set password: passwd"
echo ""
read -p "Have you done the above steps? (y/n): " SSH_READY

if [[ ! $SSH_READY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Please complete the steps on your phone first${NC}"
    exit 0
fi

# Test connection
echo ""
echo "Testing SSH connection..."
if ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -p $SSH_PORT $SSH_USER@$PHONE_IP "echo 'SSH OK'" 2>/dev/null | grep -q "SSH OK"; then
    echo -e "${GREEN}✅ SSH connection successful!${NC}"
else
    echo -e "${RED}❌ SSH connection failed${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check phone and PC are on same WiFi network"
    echo "  2. Verify SSH server is running: sshd"
    echo "  3. Try manually: ssh -p $SSH_PORT $SSH_USER@$PHONE_IP"
    echo "  4. Check firewall isn't blocking port 8022"
    echo ""
    read -p "Continue anyway? (y/n): " CONTINUE
    if [[ ! $CONTINUE =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create .env file
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4: Creating configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd dashboard

cat > .env << EOF
# NPS Dashboard Configuration - PC to Android Connection
ANDROID_HOST=$PHONE_IP
ANDROID_PORT=$SSH_PORT
ANDROID_USER=$SSH_USER
PORT=3000
NODE_ENV=production
EOF

echo -e "${GREEN}✅ Configuration saved to dashboard/.env${NC}"

# Check dependencies
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5: Checking dependencies"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi

# All done
echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║              Setup Complete! 🎉                    ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""
echo "Configuration:"
echo "  Phone IP:  $PHONE_IP"
echo "  SSH Port:  $SSH_PORT"
echo "  Username:  $SSH_USER"
echo ""
echo "To start the dashboard:"
echo "  cd dashboard && npm start"
echo ""
echo "Then visit:"
echo "  http://localhost:3000"
echo ""
echo -e "${YELLOW}Keep your phone on the same WiFi network!${NC}"
echo ""
