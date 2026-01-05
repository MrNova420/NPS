#!/bin/bash
# NPS Quick Start - Run this first!

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║   🚀 NPS Dashboard - Quick Start                              ║"
echo "║   Nova's Private Server - Production Ready                    ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "This script will:"
echo "  1. Apply all critical bug fixes"
echo "  2. Verify the installation"
echo "  3. Start the dashboard"
echo ""
read -p "Press Enter to continue..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "Step 1/3: Applying fixes..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./fix-dashboard.sh

echo ""
echo "Step 2/3: Verifying installation..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./test-dashboard.sh

if [ $? -ne 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Tests failed. Please check the errors above.${NC}"
    exit 1
fi

echo ""
echo "Step 3/3: Starting dashboard..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✅ NPS Dashboard is ready!${NC}"
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                     DASHBOARD STARTING                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${BLUE}🌐 Access URL:${NC} http://localhost:3000"
echo -e "${BLUE}📚 Features:${NC}"
echo "   • 18 Server Templates (Basic + Advanced)"
echo "   • Live System Metrics"
echo "   • Real-time Server Management"
echo "   • WebSocket Updates"
echo ""
echo -e "${YELLOW}💡 Tip:${NC} Press Ctrl+C to stop the dashboard"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start dashboard
cd dashboard && npm start
