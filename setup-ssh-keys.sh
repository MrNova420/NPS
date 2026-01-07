#!/bin/bash
# Setup SSH key-based authentication for NPS
# This eliminates password prompts when deploying servers

set -e

echo "╔════════════════════════════════════════════════════╗"
echo "║     NPS - SSH Key Setup for Password-Free Auth    ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Detect environment
if [ -n "$TERMUX_VERSION" ] || [[ "$PREFIX" == *"com.termux"* ]]; then
    IS_TERMUX=true
    echo -e "${BLUE}Detected Termux environment${NC}"
else
    IS_TERMUX=false
    echo -e "${BLUE}Detected PC environment${NC}"
fi

# Load environment variables
if [ -f "dashboard/.env" ]; then
    source dashboard/.env
fi

# Get Android device info
if [ "$IS_TERMUX" = true ]; then
    ANDROID_HOST="localhost"
    ANDROID_USER=$(whoami)
    ANDROID_PORT="${ANDROID_PORT:-8022}"
else
    ANDROID_HOST="${ANDROID_HOST:-192.168.1.100}"
    ANDROID_USER="${ANDROID_USER:-u0_a}"
    ANDROID_PORT="${ANDROID_PORT:-8022}"
fi

echo ""
echo "Android Device Configuration:"
echo "  Host: $ANDROID_HOST"
echo "  Port: $ANDROID_PORT"
echo "  User: $ANDROID_USER"
echo ""

# Check if SSH key already exists
SSH_KEY="$HOME/.ssh/id_rsa"
if [ ! -f "$SSH_KEY" ]; then
    echo -e "${YELLOW}No SSH key found. Generating new SSH key...${NC}"
    mkdir -p ~/.ssh
    chmod 700 ~/.ssh
    
    # Generate SSH key without passphrase
    ssh-keygen -t rsa -b 4096 -f "$SSH_KEY" -N "" -C "nps@dashboard"
    
    echo -e "${GREEN}✓ SSH key generated${NC}"
else
    echo -e "${GREEN}✓ SSH key already exists${NC}"
fi

# Setup based on environment
if [ "$IS_TERMUX" = true ]; then
    echo ""
    echo "Running on Android/Termux - Setting up local SSH..."
    
    # Ensure SSH server is installed
    if ! command -v sshd &> /dev/null; then
        echo "Installing OpenSSH..."
        pkg install openssh -y
    fi
    
    # Setup SSH server
    if [ ! -f "$PREFIX/etc/ssh/sshd_config" ]; then
        echo "Configuring SSH server..."
    fi
    
    # Add key to authorized_keys
    mkdir -p ~/.ssh
    chmod 700 ~/.ssh
    
    if [ ! -f ~/.ssh/authorized_keys ]; then
        touch ~/.ssh/authorized_keys
    fi
    chmod 600 ~/.ssh/authorized_keys
    
    # Add public key if not already there
    if ! grep -q "$(cat ${SSH_KEY}.pub)" ~/.ssh/authorized_keys 2>/dev/null; then
        cat "${SSH_KEY}.pub" >> ~/.ssh/authorized_keys
        echo -e "${GREEN}✓ SSH key added to authorized_keys${NC}"
    else
        echo -e "${GREEN}✓ SSH key already in authorized_keys${NC}"
    fi
    
    # Start SSH server if not running
    if ! pgrep sshd > /dev/null; then
        echo "Starting SSH server..."
        sshd
        echo -e "${GREEN}✓ SSH server started${NC}"
    else
        echo -e "${GREEN}✓ SSH server already running${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}✅ SSH setup complete!${NC}"
    echo "You can now deploy servers without password prompts."

else
    echo ""
    echo "Running on PC - Setting up connection to Android device..."
    echo ""
    echo -e "${YELLOW}Manual setup required:${NC}"
    echo ""
    echo "1. Copy your SSH public key to Android device:"
    echo -e "${BLUE}   cat ~/.ssh/id_rsa.pub${NC}"
    echo ""
    echo "2. On your Android device (in Termux), run:"
    echo -e "${BLUE}   mkdir -p ~/.ssh${NC}"
    echo -e "${BLUE}   echo '<paste-your-public-key-here>' >> ~/.ssh/authorized_keys${NC}"
    echo -e "${BLUE}   chmod 600 ~/.ssh/authorized_keys${NC}"
    echo ""
    echo "3. Or use this one-liner to copy the key (requires password once):"
    echo -e "${BLUE}   ssh-copy-id -p $ANDROID_PORT $ANDROID_USER@$ANDROID_HOST${NC}"
    echo ""
    echo "4. Test the connection:"
    echo -e "${BLUE}   ssh -p $ANDROID_PORT $ANDROID_USER@$ANDROID_HOST${NC}"
    echo ""
    echo "Once setup, you won't need to enter a password again!"
    echo ""
    
    # Try to copy key automatically
    echo -e "${YELLOW}Attempting automatic setup...${NC}"
    if command -v ssh-copy-id &> /dev/null; then
        echo "This will prompt for your Android device password ONE TIME:"
        if ssh-copy-id -p "$ANDROID_PORT" "$ANDROID_USER@$ANDROID_HOST" 2>/dev/null; then
            echo -e "${GREEN}✅ SSH key copied successfully!${NC}"
            echo ""
            echo "Testing connection..."
            if ssh -o StrictHostKeyChecking=no -p "$ANDROID_PORT" "$ANDROID_USER@$ANDROID_HOST" "echo 'Connection test successful'" 2>/dev/null; then
                echo -e "${GREEN}✅ SSH setup complete! No more password prompts.${NC}"
            fi
        else
            echo -e "${YELLOW}Automatic setup failed. Please follow manual steps above.${NC}"
        fi
    else
        echo -e "${YELLOW}ssh-copy-id not available. Please follow manual steps above.${NC}"
    fi
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "Setup complete! Start the dashboard with:"
echo -e "${BLUE}  cd dashboard && npm start${NC}"
echo "═══════════════════════════════════════════════════"
