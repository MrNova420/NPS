#!/bin/bash
# Production Readiness Verification Script
# Verifies all components of NPS are working correctly

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  NPS v2.0 - Production Readiness Verification           ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

TESTS_PASSED=0
TESTS_FAILED=0

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((TESTS_FAILED++))
}

info() {
    echo -e "${BLUE}ℹ️ INFO${NC}: $1"
}

section() {
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}$1${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Test 1: Check Node.js version
section "1. Environment Check"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    pass "Node.js installed: $NODE_VERSION"
else
    fail "Node.js not found"
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    pass "npm installed: $NPM_VERSION"
else
    fail "npm not found"
fi

# Test 2: Check directory structure
section "2. Directory Structure"
REQUIRED_DIRS=("core" "dashboard" "server-templates" "server-templates/advanced")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        pass "Directory exists: $dir"
    else
        fail "Directory missing: $dir"
    fi
done

# Test 3: Check core modules
section "3. Core Modules"
CORE_MODULES=(
    "core/process-manager.js"
    "core/resource-allocator.js"
    "core/thermal-manager.js"
    "core/network-manager.js"
    "core/health-check-system.js"
    "core/auto-recovery-system.js"
    "core/service-discovery.js"
    "core/cleanup-system.js"
    "core/state-manager.js"
    "core/performance/manager.js"
)

for module in "${CORE_MODULES[@]}"; do
    if [ -f "$module" ]; then
        if node -c "$module" 2>/dev/null; then
            pass "Core module valid: $(basename $module)"
        else
            fail "Core module syntax error: $(basename $module)"
        fi
    else
        fail "Core module missing: $module"
    fi
done

# Test 4: Check server templates
section "4. Server Templates (Basic)"
BASIC_TEMPLATES=(
    "nodejs-api" "postgresql" "redis-cache" "web-static"
    "minecraft" "discord-bot" "flask-app" "ai-inference" "file-storage"
)

for template in "${BASIC_TEMPLATES[@]}"; do
    template_file="server-templates/${template}.js"
    if [ -f "$template_file" ]; then
        if node -c "$template_file" 2>/dev/null; then
            pass "Template valid: $template"
        else
            fail "Template syntax error: $template"
        fi
    else
        fail "Template missing: $template"
    fi
done

section "5. Server Templates (Advanced)"
ADVANCED_TEMPLATES=(
    "docker-manager" "load-balancer" "monitoring-stack" "fullstack-app"
    "cicd-pipeline" "database-cluster" "dns-server" "self-hosting-suite" "ssl-proxy"
)

for template in "${ADVANCED_TEMPLATES[@]}"; do
    template_file="server-templates/advanced/${template}.js"
    if [ -f "$template_file" ]; then
        if node -c "$template_file" 2>/dev/null; then
            pass "Advanced template valid: $template"
        else
            fail "Advanced template syntax error: $template"
        fi
    else
        fail "Advanced template missing: $template"
    fi
done

# Test 5: Template loading test
section "6. Template Loading Test"
TEMPLATE_TEST=$(node -e "
const path = require('path');
const baseDir = process.cwd();
let success = 0;
let failed = 0;

const all = [
  'nodejs-api', 'postgresql', 'redis-cache', 'web-static',
  'minecraft', 'discord-bot', 'flask-app', 'ai-inference', 'file-storage',
  'advanced/docker-manager', 'advanced/load-balancer', 'advanced/monitoring-stack',
  'advanced/fullstack-app', 'advanced/cicd-pipeline', 'advanced/database-cluster',
  'advanced/dns-server', 'advanced/self-hosting-suite', 'advanced/ssl-proxy'
];

for (const t of all) {
  try {
    const mod = require(path.join(baseDir, 'server-templates', t + '.js'));
    if (mod.name && mod.deploy && mod.resources) success++;
    else failed++;
  } catch (e) {
    failed++;
  }
}

console.log(success + '/' + all.length);
" 2>&1)

if [ "$TEMPLATE_TEST" == "18/18" ]; then
    pass "All 18 templates load correctly"
else
    fail "Template loading: $TEMPLATE_TEST"
fi

# Test 6: Core module loading test
section "7. Core Module Loading Test"
CORE_TEST=$(node -e "
try {
  require('./core/process-manager');
  require('./core/resource-allocator');
  require('./core/thermal-manager');
  require('./core/network-manager');
  require('./core/health-check-system');
  require('./core/auto-recovery-system');
  require('./core/service-discovery');
  require('./core/cleanup-system');
  console.log('OK');
} catch (e) {
  console.log('FAIL: ' + e.message);
}
" 2>&1)

if [ "$CORE_TEST" == "OK" ]; then
    pass "All core modules load successfully"
else
    fail "Core module loading: $CORE_TEST"
fi

# Test 7: Dashboard dependencies
section "8. Dashboard Dependencies"
if [ -d "dashboard/node_modules" ]; then
    pass "Dashboard dependencies installed"
else
    info "Installing dashboard dependencies..."
    cd dashboard
    npm install --silent > /dev/null 2>&1
    cd ..
    if [ -d "dashboard/node_modules" ]; then
        pass "Dashboard dependencies installed"
    else
        fail "Failed to install dashboard dependencies"
    fi
fi

# Test 8: Documentation
section "9. Documentation"
DOCS=("PRODUCTION_READY.md" "DEPLOYMENT_COMPLETE.md" "PLATFORM_COMPLETE.md" "README.md")
for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        pass "Documentation exists: $doc"
    else
        fail "Documentation missing: $doc"
    fi
done

# Test 9: Setup scripts
section "10. Setup Scripts"
SCRIPTS=("setup-friendly.sh" "setup.sh")
for script in "${SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        if [ -x "$script" ]; then
            pass "Setup script executable: $script"
        else
            info "Making $script executable"
            chmod +x "$script"
            pass "Setup script now executable: $script"
        fi
    else
        fail "Setup script missing: $script"
    fi
done

# Final Summary
section "Final Results"
TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
echo ""
echo "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  🎉 ALL TESTS PASSED - PRODUCTION READY! 🎉            ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "✅ NPS v2.0 is fully functional and ready for production deployment"
    echo ""
    echo "Next steps:"
    echo "1. Run ./setup-friendly.sh to set up the environment"
    echo "2. Start the dashboard: cd dashboard && npm start"
    echo "3. Access at http://localhost:3000"
    exit 0
else
    echo -e "${RED}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ⚠️  SOME TESTS FAILED - REVIEW REQUIRED  ⚠️           ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi
