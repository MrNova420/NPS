#!/bin/bash
# NPS Package Creator - Creates distributable packages
# Supports: tar.gz, zip, deb, installer script

set -e

VERSION="1.0.0"
PROJECT_NAME="NPS"
PROJECT_DIR=$(pwd)
BUILD_DIR="$PROJECT_DIR/build"
DIST_DIR="$PROJECT_DIR/dist"

echo "╔═══════════════════════════════════════════════════╗"
echo "║         NPS Package Creator v${VERSION}             ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Clean previous builds
echo -e "${BLUE}Cleaning previous builds...${NC}"
rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$BUILD_DIR" "$DIST_DIR"

# Create package directory
PACKAGE_DIR="$BUILD_DIR/NPS-${VERSION}"
mkdir -p "$PACKAGE_DIR"

echo -e "${BLUE}Copying files...${NC}"

# Copy essential files
cp -r dashboard "$PACKAGE_DIR/"
cp -r server-templates "$PACKAGE_DIR/"
cp -r core "$PACKAGE_DIR/"
cp -r cli "$PACKAGE_DIR/"
cp -r setup "$PACKAGE_DIR/"
cp -r services "$PACKAGE_DIR/"
cp -r monitoring "$PACKAGE_DIR/"
cp -r automation "$PACKAGE_DIR/"
cp -r orchestrator "$PACKAGE_DIR/"
cp -r utils "$PACKAGE_DIR/"
cp -r docs "$PACKAGE_DIR/"
cp -r tests "$PACKAGE_DIR/"

# Copy configuration and documentation
cp .env.example "$PACKAGE_DIR/"
cp .gitignore "$PACKAGE_DIR/"
cp setup.sh "$PACKAGE_DIR/"
cp *.md "$PACKAGE_DIR/"
cp *.txt "$PACKAGE_DIR/" 2>/dev/null || true

# Remove node_modules to reduce size
find "$PACKAGE_DIR" -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true

# Create README for package
cat > "$PACKAGE_DIR/README_INSTALL.md" << 'EOF'
# NPS (Nova's Private Server) - Installation Guide

## Quick Start

### 1. Extract Package
Already done if you're reading this!

### 2. Run Setup

**On Android (Termux):**
```bash
bash setup.sh
```

**On PC/Linux:**
```bash
bash setup.sh
```

### 3. Configure
Edit `.env` file with your Android device IP address:
```bash
nano .env
```

### 4. Start Dashboard
```bash
./start-dashboard.sh
```

Or with npm:
```bash
cd dashboard
npm start
```

### 5. Access Dashboard
Open browser: http://localhost:3000

## Full Documentation

- `START_HERE.md` - Quick start guide
- `NPS_README.md` - Complete documentation
- `PRODUCTION_README.md` - Production deployment
- `QUICKSTART.md` - Quick reference
- `FEATURES.md` - Feature list

## System Requirements

**Android (Termux):**
- Android 7.0+
- 2GB+ RAM (4GB+ recommended)
- 2GB+ free storage
- Termux (F-Droid version)

**PC/Control Station:**
- Linux, macOS, or Windows WSL
- Node.js 14+
- SSH client
- 1GB+ RAM

## Support

For issues and questions, check the documentation in `docs/` folder.

## Version

NPS ${VERSION} - Production Ready
EOF

echo -e "${GREEN}✓ Files copied${NC}"

# Create installer script
echo -e "${BLUE}Creating installer script...${NC}"

cat > "$PACKAGE_DIR/install.sh" << 'INSTALLER_EOF'
#!/bin/bash
# NPS Automated Installer

set -e

echo "╔═══════════════════════════════════════════════════╗"
echo "║         NPS Installation Wizard                   ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Detect platform
if [ -d "/data/data/com.termux" ]; then
    PLATFORM="android"
else
    PLATFORM="pc"
fi

echo "Platform detected: $PLATFORM"
echo ""

if [ "$PLATFORM" = "android" ]; then
    echo "=== Android (Termux) Installation ==="
    echo ""
    
    # Install prerequisites
    echo "Installing prerequisites..."
    pkg update -y
    pkg upgrade -y
    pkg install -y nodejs python git openssh
    
    # Run setup
    bash setup.sh
    
    # Install dashboard dependencies
    echo "Installing dashboard dependencies..."
    cd dashboard
    npm install
    cd ..
    
    echo ""
    echo "✓ Installation complete!"
    echo ""
    echo "Next steps:"
    echo "1. Start SSH: sshd"
    echo "2. Find your IP: ifconfig"
    echo "3. On PC, connect to this device"
    
else
    echo "=== PC Installation ==="
    echo ""
    
    # Check prerequisites
    if ! command -v node &> /dev/null; then
        echo "Error: Node.js not found. Please install Node.js 14+ first."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo "Error: npm not found. Please install npm first."
        exit 1
    fi
    
    # Run setup
    bash setup.sh
    
    echo ""
    echo "✓ Installation complete!"
    echo ""
    echo "Next steps:"
    echo "1. Edit .env with your Android device IP"
    echo "2. Run: ./start-dashboard.sh"
    echo "3. Open: http://localhost:3000"
fi
INSTALLER_EOF

chmod +x "$PACKAGE_DIR/install.sh"

echo -e "${GREEN}✓ Installer created${NC}"

# Create launcher scripts
cat > "$PACKAGE_DIR/start-dashboard.sh" << 'LAUNCHER_EOF'
#!/bin/bash
cd "$(dirname "$0")/dashboard"
echo "Starting NPS Dashboard..."
echo "Dashboard: http://localhost:3000"
echo ""
node backend/server.js
LAUNCHER_EOF

cat > "$PACKAGE_DIR/start-cli.sh" << 'CLI_EOF'
#!/bin/bash
cd "$(dirname "$0")/cli"
node manager-cli.js
CLI_EOF

chmod +x "$PACKAGE_DIR/start-dashboard.sh"
chmod +x "$PACKAGE_DIR/start-cli.sh"

echo -e "${GREEN}✓ Launchers created${NC}"

# Package 1: tar.gz (Universal)
echo -e "${BLUE}Creating tar.gz package...${NC}"
cd "$BUILD_DIR"
tar -czf "$DIST_DIR/NPS-${VERSION}.tar.gz" "NPS-${VERSION}"
cd "$PROJECT_DIR"
echo -e "${GREEN}✓ Created: NPS-${VERSION}.tar.gz${NC}"

# Package 2: zip (Windows-friendly)
echo -e "${BLUE}Creating zip package...${NC}"
cd "$BUILD_DIR"
zip -r -q "$DIST_DIR/NPS-${VERSION}.zip" "NPS-${VERSION}"
cd "$PROJECT_DIR"
echo -e "${GREEN}✓ Created: NPS-${VERSION}.zip${NC}"

# Package 3: Self-extracting installer
echo -e "${BLUE}Creating self-extracting installer...${NC}"
cat > "$DIST_DIR/NPS-${VERSION}-installer.sh" << 'SELFEXTRACT_EOF'
#!/bin/bash
# NPS Self-Extracting Installer
# This script extracts and installs NPS automatically

ARCHIVE_LINE=$(awk '/^__ARCHIVE__/ {print NR + 1; exit 0; }' "$0")
TEMP_DIR=$(mktemp -d)

echo "╔═══════════════════════════════════════════════════╗"
echo "║     NPS Self-Extracting Installer                ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
echo "Extracting files..."

tail -n +$ARCHIVE_LINE "$0" | tar xz -C "$TEMP_DIR"

cd "$TEMP_DIR/NPS-${VERSION}"

echo "Running installer..."
bash install.sh

echo ""
echo "Installation complete!"
echo "Files installed in: $(pwd)"

exit 0

__ARCHIVE__
SELFEXTRACT_EOF

cat "$DIST_DIR/NPS-${VERSION}.tar.gz" >> "$DIST_DIR/NPS-${VERSION}-installer.sh"
chmod +x "$DIST_DIR/NPS-${VERSION}-installer.sh"
echo -e "${GREEN}✓ Created: NPS-${VERSION}-installer.sh${NC}"

# Create checksums
echo -e "${BLUE}Generating checksums...${NC}"
cd "$DIST_DIR"
sha256sum NPS-${VERSION}.tar.gz > NPS-${VERSION}.tar.gz.sha256
sha256sum NPS-${VERSION}.zip > NPS-${VERSION}.zip.sha256
sha256sum NPS-${VERSION}-installer.sh > NPS-${VERSION}-installer.sh.sha256
cd "$PROJECT_DIR"
echo -e "${GREEN}✓ Checksums created${NC}"

# Create release notes
cat > "$DIST_DIR/RELEASE_NOTES.txt" << EOF
═══════════════════════════════════════════════════════════════
  NPS (Nova's Private Server) v${VERSION} - Release Notes
═══════════════════════════════════════════════════════════════

Release Date: $(date +"%Y-%m-%d")
Build Date: $(date +"%Y-%m-%d %H:%M:%S")

OVERVIEW
--------
NPS transforms Android phones into production-grade servers with
enterprise features, beautiful web dashboard, and 15 ready-to-deploy
server templates.

FEATURES
--------
✓ 15 Production-Ready Server Templates
  - 9 Basic: Web, Node.js, Python, PostgreSQL, Redis, Minecraft,
    Discord Bot, File Storage, AI Inference
  - 6 Advanced: Docker Manager, Full-Stack Apps, Load Balancer,
    CI/CD Pipeline, Monitoring Stack, Database Cluster

✓ Auto-Performance Optimization
  - Device tier detection (High/Medium/Low/Minimal)
  - Automatic kernel tuning
  - Thermal management
  - Predictive resource analysis

✓ Enterprise Security
  - SSH hardening
  - Firewall configuration
  - Automated backups
  - Disaster recovery

✓ Real-Time Monitoring
  - WebSocket dashboard updates
  - 5-second metric collection
  - Alert system (critical/warning)
  - Performance recommendations

✓ Auto-Recovery
  - 30-second health checks
  - Automatic service restart
  - Failover support
  - Self-healing capabilities

SYSTEM REQUIREMENTS
-------------------
Android (Termux):
  - Android 7.0+
  - 2GB+ RAM (4GB+ recommended)
  - 2GB+ storage
  - Termux (F-Droid version)

PC/Control Station:
  - Linux, macOS, or Windows WSL
  - Node.js 14+
  - SSH client

INSTALLATION
------------
Option 1: Self-extracting installer (Recommended)
  bash NPS-${VERSION}-installer.sh

Option 2: Manual installation
  tar -xzf NPS-${VERSION}.tar.gz
  cd NPS-${VERSION}
  bash install.sh

Option 3: From ZIP
  unzip NPS-${VERSION}.zip
  cd NPS-${VERSION}
  bash install.sh

QUICK START
-----------
1. Install on Android device:
   bash install.sh

2. Install on PC:
   bash install.sh
   Edit .env with Android IP

3. Start dashboard:
   ./start-dashboard.sh

4. Access: http://localhost:3000

PACKAGE CONTENTS
----------------
- Dashboard (Web UI + Backend)
- 15 Server Templates
- Performance Optimization
- Security Hardening
- Auto-Recovery System
- Monitoring & Alerting
- Complete Documentation

DOCUMENTATION
-------------
- START_HERE.md - Getting started
- NPS_README.md - Full documentation
- PRODUCTION_README.md - Production guide
- QUICKSTART.md - Quick reference
- FEATURES.md - Feature details

FILE SIZES
----------
$(ls -lh "$DIST_DIR" | grep -v "^total" | grep -v "^d" | awk '{print $9, ":", $5}')

CHECKSUMS (SHA256)
------------------
$(cat "$DIST_DIR"/*.sha256)

VERSION HISTORY
---------------
v1.0.0 ($(date +"%Y-%m-%d"))
  - Initial production release
  - 15 server templates
  - Auto-optimization
  - Enterprise security
  - Real-time monitoring
  - Auto-recovery
  - Complete documentation

SUPPORT & RESOURCES
-------------------
For help, check the documentation in docs/ folder.

LICENSE
-------
MIT License - See LICENSE file for details

═══════════════════════════════════════════════════════════════
  Thank you for using NPS!
═══════════════════════════════════════════════════════════════
EOF

echo -e "${GREEN}✓ Release notes created${NC}"

# Generate summary
echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║              Build Summary                        ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Build complete!${NC}"
echo ""
echo "Packages created in: $DIST_DIR"
echo ""
ls -lh "$DIST_DIR" | grep -v "^total" | grep -v "^d" | awk '{print "  • " $9, "-", $5}'
echo ""
echo "Files ready for distribution!"
echo ""
