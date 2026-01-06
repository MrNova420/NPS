#!/bin/bash
# Integration test for NPS installation
# Tests the complete setup without actually running services

set -e

echo "╔════════════════════════════════════════════════════╗"
echo "║     NPS Installation Integration Test             ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0

# Test function
test_step() {
    echo -n "Testing: $1... "
    if eval "$2" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        PASS=$((PASS + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        FAIL=$((FAIL + 1))
        return 1
    fi
}

# Run tests
echo "Running integration tests..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_step "install.sh exists and is executable" "[ -x install.sh ]"
test_step "setup.sh exists and is executable" "[ -x setup.sh ]"
test_step "verify-install.sh exists and is executable" "[ -x verify-install.sh ]"
test_step "requirements.txt exists" "[ -f requirements.txt ]"

test_step "Dashboard package.json exists" "[ -f dashboard/package.json ]"
test_step "Dashboard server.js exists" "[ -f dashboard/backend/server.js ]"
test_step "Dashboard can parse package.json" "node -e 'require(\"./dashboard/package.json\")'"

test_step "CLI package.json exists" "[ -f cli/package.json ]"
test_step "CLI manager-cli.js exists" "[ -f cli/manager-cli.js ]"
test_step "CLI can parse package.json" "node -e 'require(\"./cli/package.json\")'"

test_step "Dashboard dependencies can install" "(cd dashboard && npm install --dry-run)"
test_step "CLI dependencies can install" "(cd cli && npm install --dry-run)"

test_step "Dashboard server.js syntax is valid" "node --check dashboard/backend/server.js"
test_step "CLI manager-cli.js syntax is valid" "node --check cli/manager-cli.js"

test_step "Android setup script exists" "[ -f setup/android/termux-setup.sh ]"
test_step "PC client script exists" "[ -f setup/pc/pc-client.py ]"
test_step "Python client syntax is valid" "python3 -m py_compile setup/pc/pc-client.py"

test_step "Automation scheduler exists" "[ -f automation/task-scheduler.py ]"

test_step "README.md exists and has content" "[ -s README.md ]"
test_step "START_HERE.md exists" "[ -f START_HERE.md ]"
test_step "QUICKSTART.md exists" "[ -f QUICKSTART.md ]"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test Results:"
echo ""
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "╔════════════════════════════════════════════════════╗"
    echo "║         ✅ All Tests Passed!                       ║"
    echo "╚════════════════════════════════════════════════════╝"
    echo ""
    echo "The installation is ready to use!"
    exit 0
else
    echo "╔════════════════════════════════════════════════════╗"
    echo "║         ❌ Some Tests Failed                       ║"
    echo "╚════════════════════════════════════════════════════╝"
    echo ""
    echo "Please review the failures above."
    exit 1
fi
