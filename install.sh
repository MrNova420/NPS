#!/bin/bash
# NPS - Nova's Private Server - Installation Script
# This script provides a simple installation process for the NPS project

set -e

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "╔═══════════════════════════════════════════════════╗"
echo "║     NPS - Nova's Private Server Installer        ║"
echo "║              Version 1.0.0-beta                   ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Detect platform
if [ -d "/data/data/com.termux" ]; then
    PLATFORM="android"
    echo -e "${BLUE}✓ Detected platform: Android (Termux)${NC}"
else
    PLATFORM="pc"
    echo -e "${BLUE}✓ Detected platform: PC/Linux${NC}"
fi
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites based on platform
echo "Checking prerequisites..."
if [ "$PLATFORM" = "android" ]; then
    # For Android/Termux
    if ! command_exists pkg; then
        echo -e "${RED}✗ Error: This script must be run in Termux${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Termux environment detected${NC}"
else
    # For PC
    if ! command_exists git; then
        echo -e "${RED}✗ Error: git is not installed${NC}"
        exit 1
    fi
    if ! command_exists node; then
        echo -e "${RED}✗ Error: Node.js is not installed${NC}"
        echo "  Please install Node.js 14+ from https://nodejs.org"
        exit 1
    fi
    if ! command_exists npm; then
        echo -e "${RED}✗ Error: npm is not installed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Prerequisites check passed${NC}"
fi
echo ""

# Run the appropriate setup script
echo "Starting installation..."
echo ""

if [ "$PLATFORM" = "android" ]; then
    # Android installation
    echo -e "${YELLOW}Running Android setup...${NC}"
    echo ""
    bash setup.sh
else
    # PC installation
    echo -e "${YELLOW}Running PC setup...${NC}"
    echo ""
    bash setup.sh
fi

# Final message
echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║         ✓ Installation Complete!                 ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

if [ "$PLATFORM" = "android" ]; then
    echo -e "${GREEN}Next Steps (Android):${NC}"
    echo "1. Find your IP address:"
    echo "   ${BLUE}ifconfig${NC}"
    echo ""
    echo "2. Start services:"
    echo "   ${BLUE}~/server/scripts/service-manager.sh start${NC}"
    echo ""
    echo "3. Check status:"
    echo "   ${BLUE}~/server/scripts/service-manager.sh status${NC}"
    echo ""
    echo "4. View system info:"
    echo "   ${BLUE}~/server/scripts/system-info.sh${NC}"
    echo ""
    echo "5. On your PC, connect via SSH:"
    echo "   ${BLUE}ssh -p 8022 $(whoami)@<your-phone-ip>${NC}"
else
    echo -e "${GREEN}Next Steps (PC):${NC}"
    echo "1. Edit .env file with your Android device IP:"
    echo "   ${BLUE}nano .env${NC}"
    echo ""
    echo "2. Start the dashboard:"
    echo "   ${BLUE}./start-dashboard.sh${NC}"
    echo "   or: ${BLUE}cd dashboard && npm start${NC}"
    echo ""
    echo "3. Open in browser:"
    echo "   ${BLUE}http://localhost:3000${NC}"
    echo ""
    echo "4. Or use CLI:"
    echo "   ${BLUE}./start-cli.sh${NC}"
fi

echo ""
echo -e "${BLUE}For more information, see:${NC}"
echo "  • README.md - Project overview"
echo "  • START_HERE.md - Getting started guide"
echo "  • QUICKSTART.md - Quick start guide"
echo ""
echo -e "${GREEN}Happy server managing! 🚀${NC}"
echo ""
