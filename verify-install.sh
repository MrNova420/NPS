#!/bin/bash
# Verify NPS Installation
# This script checks if all required components are properly set up

set -e

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

echo "╔═══════════════════════════════════════════════════╗"
echo "║     NPS Installation Verification                ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Function to check if command exists
check_command() {
    if command -v "$1" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $2"
        return 0
    else
        echo -e "${RED}✗${NC} $2"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Function to check if file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} $2 (optional)"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi
}

# Function to check if directory exists
check_directory() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} $2"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi
}

# Detect platform
if [ -d "/data/data/com.termux" ]; then
    PLATFORM="android"
    echo -e "${BLUE}Platform: Android (Termux)${NC}"
else
    PLATFORM="pc"
    echo -e "${BLUE}Platform: PC/Linux${NC}"
fi
echo ""

# Check basic prerequisites
echo "Checking Prerequisites:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$PLATFORM" = "android" ]; then
    check_command pkg "Termux package manager (pkg)"
    check_command sshd "SSH server (openssh)"
    check_command python "Python"
    check_command node "Node.js"
    check_command npm "npm"
    check_command git "Git"
else
    check_command git "Git"
    check_command node "Node.js"
    check_command npm "npm"
    check_command ssh "SSH client"
fi

echo ""

# Check project files
echo "Checking Project Files:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_file "setup.sh" "Setup script"
check_file "install.sh" "Install script"
check_file "README.md" "README"
check_file "requirements.txt" "Python requirements"
check_file "dashboard/package.json" "Dashboard package.json"
check_file "cli/package.json" "CLI package.json"
check_file "dashboard/backend/server.js" "Dashboard server"
check_file "cli/manager-cli.js" "CLI manager"

echo ""

# Check directories
echo "Checking Project Structure:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_directory "dashboard" "Dashboard directory"
check_directory "dashboard/backend" "Dashboard backend"
check_directory "dashboard/frontend" "Dashboard frontend"
check_directory "cli" "CLI directory"
check_directory "setup" "Setup directory"
check_directory "setup/android" "Android setup"
check_directory "setup/pc" "PC setup"
check_directory "automation" "Automation directory"
check_directory "monitoring" "Monitoring directory"

echo ""

# Check dependencies
echo "Checking Dependencies:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d "dashboard/node_modules" ]; then
    echo -e "${GREEN}✓${NC} Dashboard dependencies installed"
else
    echo -e "${YELLOW}⚠${NC} Dashboard dependencies not installed (run: cd dashboard && npm install)"
    WARNINGS=$((WARNINGS + 1))
fi

if [ -d "cli/node_modules" ]; then
    echo -e "${GREEN}✓${NC} CLI dependencies installed"
else
    echo -e "${YELLOW}⚠${NC} CLI dependencies not installed (run: cd cli && npm install)"
    WARNINGS=$((WARNINGS + 1))
fi

# Check Python packages (optional)
if command -v pip >/dev/null 2>&1 || command -v pip3 >/dev/null 2>&1; then
    PIP_CMD=$(command -v pip3 2>/dev/null || command -v pip)
    if $PIP_CMD show flask >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Python packages installed (flask)"
    else
        echo -e "${YELLOW}⚠${NC} Python packages not installed (optional: pip install -r requirements.txt)"
        WARNINGS=$((WARNINGS + 1))
    fi
fi

echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary:"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ All required components are present${NC}"
else
    echo -e "${RED}✗ Found $ERRORS critical issues${NC}"
fi

if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠ Found $WARNINGS warnings${NC}"
fi

echo ""

if [ $ERRORS -eq 0 ]; then
    echo "╔═══════════════════════════════════════════════════╗"
    echo "║         ✓ Installation Verified!                 ║"
    echo "╚═══════════════════════════════════════════════════╝"
    echo ""
    
    if [ "$PLATFORM" = "android" ]; then
        echo -e "${GREEN}Next Steps (Android):${NC}"
        echo "1. Start services: ~/server/scripts/service-manager.sh start"
        echo "2. Check status: ~/server/scripts/service-manager.sh status"
        echo "3. Find your IP: ifconfig"
    else
        echo -e "${GREEN}Next Steps (PC):${NC}"
        echo "1. Install dependencies:"
        echo "   cd dashboard && npm install"
        echo "   cd ../cli && npm install"
        echo ""
        echo "2. Configure your device IP:"
        echo "   Edit .env file (created by setup.sh)"
        echo ""
        echo "3. Start the dashboard:"
        echo "   ./start-dashboard.sh  # (created by setup.sh)"
        echo "   or: cd dashboard && npm start"
    fi
    echo ""
    exit 0
else
    echo "╔═══════════════════════════════════════════════════╗"
    echo "║         ✗ Installation Issues Found               ║"
    echo "╚═══════════════════════════════════════════════════╝"
    echo ""
    echo "Please run the setup script:"
    echo "  bash setup.sh"
    echo ""
    echo "Or use the install script:"
    echo "  bash install.sh"
    echo ""
    exit 1
fi
