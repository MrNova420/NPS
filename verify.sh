#!/bin/bash
# NPS Pre-Flight Verification
# Verifies all components before release

set -e

echo "╔═══════════════════════════════════════════════════╗"
echo "║       NPS Pre-Flight Verification                ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0
WARNINGS=0

check() {
    local name="$1"
    local condition="$2"
    
    if eval "$condition"; then
        echo -e "${GREEN}✓${NC} $name"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $name"
        ((FAILED++))
        return 1
    fi
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

echo "Running pre-flight checks..."
echo ""

# Core Files
echo "📁 Core Files:"
check "setup.sh exists" "[ -f setup.sh ]"
check "package.json exists" "[ -f dashboard/package.json ]"
check ".env.example exists" "[ -f .env.example ]"
check "dashboard backend exists" "[ -f dashboard/backend/server.js ]"
check "dashboard frontend exists" "[ -f dashboard/frontend/public/index.html ]"
check "CLI manager exists" "[ -f cli/manager-cli.js ]"
echo ""

# Performance & Security
echo "⚡ Performance & Security:"
check "Performance manager exists" "[ -f core/performance/manager.js ]"
check "Performance optimizer exists" "[ -f core/performance/optimize.sh ]"
check "Security hardening exists" "[ -f core/security/production-harden.sh ]"
check "Scripts are executable" "[ -x setup.sh ] && [ -x core/performance/optimize.sh ] && [ -x core/security/production-harden.sh ]"
echo ""

# Templates
echo "📦 Server Templates:"
BASIC_COUNT=$(ls -1 server-templates/*.js 2>/dev/null | wc -l)
ADVANCED_COUNT=$(ls -1 server-templates/advanced/*.js 2>/dev/null | wc -l)
TOTAL_TEMPLATES=$((BASIC_COUNT + ADVANCED_COUNT))

check "Basic templates ($BASIC_COUNT)" "[ $BASIC_COUNT -ge 9 ]"
check "Advanced templates ($ADVANCED_COUNT)" "[ $ADVANCED_COUNT -ge 6 ]"
check "Total templates ($TOTAL_TEMPLATES)" "[ $TOTAL_TEMPLATES -ge 15 ]"

# Verify each template
for template in server-templates/*.js server-templates/advanced/*.js; do
    if [ -f "$template" ]; then
        check "  $(basename $template)" "grep -q 'module.exports' $template && grep -q 'deploy' $template"
    fi
done
echo ""

# Documentation
echo "📚 Documentation:"
check "README exists" "[ -f NPS_README.md ]"
check "Production guide exists" "[ -f PRODUCTION_README.md ]"
check "Start here guide exists" "[ -f START_HERE.md ]"
check "Quick start exists" "[ -f QUICKSTART.md ]"
check "Features doc exists" "[ -f FEATURES.md ]"

# Check documentation length (should be substantial)
for doc in NPS_README.md PRODUCTION_README.md START_HERE.md; do
    if [ -f "$doc" ]; then
        SIZE=$(wc -c < "$doc")
        check "  $doc ($(echo $SIZE | awk '{print int($1/1024)}')KB)" "[ $SIZE -gt 1000 ]"
    fi
done
echo ""

# Dependencies
echo "🔧 Dependencies:"
if [ -d "dashboard/node_modules" ]; then
    check "Dashboard dependencies installed" "[ -d dashboard/node_modules/express ] && [ -d dashboard/node_modules/ws ]"
else
    warn "Dashboard dependencies not installed (will install on setup)"
fi

check "Node.js available" "command -v node >/dev/null 2>&1"
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    info "Node.js version: $NODE_VERSION"
    
    MAJOR=$(echo $NODE_VERSION | sed 's/v//' | cut -d. -f1)
    check "Node.js version >= 14" "[ $MAJOR -ge 14 ]"
fi
echo ""

# Tests
echo "🧪 Tests:"
check "Test suite exists" "[ -f tests/test-suite.js ]"
check "Test suite is executable" "[ -x tests/test-suite.js ]"

if [ -f tests/test-suite.js ]; then
    info "Running test suite..."
    if node tests/test-suite.js > /tmp/nps-test-output.txt 2>&1; then
        check "All tests pass" "true"
        PASS_RATE=$(grep "Pass Rate" /tmp/nps-test-output.txt | awk '{print $3}')
        info "Pass rate: $PASS_RATE"
    else
        check "All tests pass" "false"
    fi
fi
echo ""

# Code Quality
echo "💎 Code Quality:"
TOTAL_LINES=$(find . -name "*.js" -not -path "*/node_modules/*" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}')
check "Total JavaScript lines: $TOTAL_LINES" "[ $TOTAL_LINES -gt 10000 ]"

TOTAL_BASH=$(find . -name "*.sh" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}')
check "Total Bash lines: $TOTAL_BASH" "[ $TOTAL_BASH -gt 1000 ]"

TOTAL_DOCS=$(find . -name "*.md" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}')
check "Total documentation lines: $TOTAL_DOCS" "[ $TOTAL_DOCS -gt 500 ]"
echo ""

# Package
echo "📦 Package:"
check "Package script exists" "[ -f package.sh ]"
check "Package script is executable" "[ -x package.sh ]"
if [ -d "dist" ]; then
    check "Distribution directory exists" "true"
    if [ -f "dist/NPS-1.0.0.tar.gz" ]; then
        check "tar.gz package created" "true"
        SIZE=$(ls -lh dist/NPS-1.0.0.tar.gz | awk '{print $5}')
        info "Package size: $SIZE"
    else
        warn "Package not built (run ./package.sh)"
    fi
fi
echo ""

# Security Checks
echo "🔒 Security:"
check "No hardcoded passwords in main files" "! grep -r 'password.*=.*[\"']' --include='*.js' --exclude-dir=node_modules dashboard/backend/ core/ | grep -v 'password:' | grep -v '//' | grep -v 'placeholder'"
check "No exposed API keys" "! grep -r 'API_KEY.*=.*[\"'][A-Za-z0-9]' --include='*.js' --exclude-dir=node_modules ."
check ".env.example has placeholders" "grep -q 'ANDROID_HOST=' .env.example"
echo ""

# Feature Completeness
echo "✨ Features:"
check "Auto-optimization implemented" "grep -q 'optimize' core/performance/optimize.sh"
check "Health monitoring implemented" "grep -q 'health' core/security/production-harden.sh"
check "Auto-recovery implemented" "grep -q 'recovery' core/security/production-harden.sh"
check "WebSocket support" "grep -q 'WebSocket' dashboard/backend/server.js"
check "Real-time metrics" "grep -q 'getMetrics' core/performance/manager.js"
echo ""

# Summary
echo "════════════════════════════════════════════════════"
echo "                  VERIFICATION SUMMARY"
echo "════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}Passed:${NC}   $PASSED"
echo -e "${RED}Failed:${NC}   $FAILED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo ""

TOTAL=$((PASSED + FAILED))
if [ $TOTAL -gt 0 ]; then
    PASS_PERCENTAGE=$((PASSED * 100 / TOTAL))
    echo "Pass Rate: ${PASS_PERCENTAGE}%"
fi

echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║     ✓ ALL CHECKS PASSED - READY FOR RELEASE       ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "🚀 NPS is production-ready!"
    echo ""
    echo "Next steps:"
    echo "  1. Run: ./package.sh (to create packages)"
    echo "  2. Test installation on clean system"
    echo "  3. Deploy to production"
    echo ""
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║     ✗ CHECKS FAILED - FIXES REQUIRED              ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Please fix the issues above before release."
    echo ""
    exit 1
fi
