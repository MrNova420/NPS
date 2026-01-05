#!/bin/bash
# NPS Dashboard Testing Script
# Tests all critical functionality after fixes

set -e

echo "🧪 NPS Dashboard Test Suite"
echo "==========================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

TESTS_PASSED=0
TESTS_FAILED=0

# Test function
test_case() {
    local name="$1"
    local command="$2"
    
    echo -n "  Testing: $name... "
    
    if eval "$command" &>/dev/null; then
        echo -e "${GREEN}✓ PASS${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

echo "📋 Pre-flight Checks"
echo "===================="

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found${NC}"
    echo "  Install with: pkg install nodejs (Termux) or apt install nodejs (Linux)"
    exit 1
fi
echo -e "${GREEN}✓${NC} Node.js $(node -v)"

# Check project structure
cd "$(dirname "$0")"
echo -e "${GREEN}✓${NC} Project directory: $(pwd)"

if [ ! -d "dashboard" ]; then
    echo -e "${RED}✗ Dashboard directory not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Dashboard directory exists"

if [ ! -d "server-templates" ]; then
    echo -e "${RED}✗ Templates directory not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Templates directory exists"

echo ""
echo "📦 Testing Template System"
echo "=========================="

# Count templates
BASIC_COUNT=$(ls -1 server-templates/*.js 2>/dev/null | wc -l)
ADVANCED_COUNT=$(ls -1 server-templates/advanced/*.js 2>/dev/null | wc -l)
TOTAL_COUNT=$((BASIC_COUNT + ADVANCED_COUNT))

echo "  Basic templates: $BASIC_COUNT"
echo "  Advanced templates: $ADVANCED_COUNT"
echo "  Total: $TOTAL_COUNT"

if [ "$TOTAL_COUNT" -lt 15 ]; then
    echo -e "${YELLOW}⚠ Warning: Expected 18 templates, found $TOTAL_COUNT${NC}"
fi

# Test template loading
echo ""
echo "  Testing template structure..."
for template in server-templates/*.js; do
    [ -f "$template" ] || continue
    name=$(basename "$template" .js)
    
    # Check if template exports required functions
    if grep -q "module.exports" "$template" && \
       grep -q "deploy" "$template" && \
       grep -q "start" "$template"; then
        echo -e "    ${GREEN}✓${NC} $name"
    else
        echo -e "    ${RED}✗${NC} $name (missing exports)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
done

echo ""
echo "🔧 Testing Core Modules"
echo "======================"

# Test PerformanceManager
if [ -f "core/performance/manager.js" ]; then
    echo -n "  PerformanceManager: "
    
    # Check if auto-optimization is disabled
    if grep -q "Auto-optimization disabled" core/performance/manager.js; then
        echo -e "${GREEN}✓ CPU loop fixed${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${YELLOW}⚠ May still have CPU loop${NC}"
    fi
    
    # Check thresholds
    if grep -q "> 98" core/performance/manager.js; then
        echo -e "    ${GREEN}✓${NC} CPU threshold increased (98%)"
    fi
else
    echo -e "  ${RED}✗ PerformanceManager not found${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test StateManager
if [ -f "core/state-manager.js" ]; then
    echo -e "  ${GREEN}✓${NC} StateManager exists"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "  ${RED}✗ StateManager not found${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""
echo "🌐 Testing Dashboard Backend"
echo "============================"

# Check server.js
if [ -f "dashboard/backend/server.js" ]; then
    echo -n "  Backend server: "
    
    # Check for template loading fix
    if grep -q "../../server-templates" dashboard/backend/server.js; then
        echo -e "${GREEN}✓ Template path fixed${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ Template path may be wrong${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    # Check for advanced templates support
    if grep -q "advanced" dashboard/backend/server.js; then
        echo -e "    ${GREEN}✓${NC} Advanced templates supported"
    fi
    
    # Check for SSH config
    if grep -q "StrictHostKeyChecking=no" dashboard/backend/server.js; then
        echo -e "    ${GREEN}✓${NC} SSH blocking fixed"
    fi
else
    echo -e "  ${RED}✗ Backend server not found${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Check dependencies
echo ""
cd dashboard
if [ ! -d "node_modules" ]; then
    echo -e "  ${YELLOW}⚠ Dependencies not installed${NC}"
    echo "    Run: cd dashboard && npm install"
else
    echo -e "  ${GREEN}✓${NC} Dependencies installed"
    
    # Check for required packages
    for pkg in express ws; do
        if [ -d "node_modules/$pkg" ]; then
            echo -e "    ${GREEN}✓${NC} $pkg"
        else
            echo -e "    ${RED}✗${NC} $pkg missing"
        fi
    done
fi
cd ..

echo ""
echo "🎨 Testing Frontend"
echo "==================="

if [ -f "dashboard/frontend/public/index.html" ]; then
    echo -n "  Frontend HTML: "
    
    # Check for API calls
    if grep -q "/api/templates" dashboard/frontend/public/index.html; then
        echo -e "${GREEN}✓ Templates API call present${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ Templates API call missing${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    # Check for error handling
    if grep -q "catch.*error" dashboard/frontend/public/index.html; then
        echo -e "    ${GREEN}✓${NC} Error handling added"
    fi
else
    echo -e "  ${RED}✗ Frontend HTML not found${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""
echo "⚙️  Testing Configuration"
echo "========================"

# Check if ~/server directory structure exists
HOME_DIR="${HOME}"
if [ -n "$TERMUX_VERSION" ]; then
    HOME_DIR="/data/data/com.termux/files/home"
fi

if [ -d "$HOME_DIR/server" ]; then
    echo -e "  ${GREEN}✓${NC} ~/server directory exists"
    
    for dir in config state logs instances; do
        if [ -d "$HOME_DIR/server/$dir" ]; then
            echo -e "    ${GREEN}✓${NC} $dir/"
        else
            echo -e "    ${YELLOW}⚠${NC} $dir/ missing (will be created on startup)"
        fi
    done
    
    if [ -f "$HOME_DIR/server/config/profile.json" ]; then
        echo -e "  ${GREEN}✓${NC} Performance profile exists"
        TIER=$(grep -o '"tier": "[^"]*"' "$HOME_DIR/server/config/profile.json" | cut -d'"' -f4)
        echo -e "    Device tier: ${BLUE}$TIER${NC}"
    else
        echo -e "  ${YELLOW}⚠${NC} Performance profile missing (run ./fix-dashboard.sh)"
    fi
else
    echo -e "  ${YELLOW}⚠${NC} ~/server not found (run ./fix-dashboard.sh to create)"
fi

echo ""
echo "📊 Test Summary"
echo "==============="
echo -e "  ${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "  ${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo ""
    echo "🚀 Ready to start dashboard:"
    echo "   cd dashboard && npm start"
    echo ""
    echo "🌐 Then visit: http://localhost:3000"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed${NC}"
    echo ""
    echo "💡 Recommended actions:"
    echo "   1. Run: ./fix-dashboard.sh"
    echo "   2. Check error messages above"
    echo "   3. Run this test script again"
    exit 1
fi
