# NPS - Nova's Private Server

Transform your Android phone into a powerful, production-ready server with enterprise features.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0--beta-green.svg)](https://github.com/MrNova420/NPS)
[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20Termux-orange.svg)](https://termux.dev)
[![Status](https://img.shields.io/badge/status-Production%20Ready-brightgreen.svg)](FINAL_STATUS.md)
[![Tests](https://img.shields.io/badge/tests-21%2F21%20passing-brightgreen.svg)](test-install.sh)

> **⚡ Latest Update:** All setup issues fixed! Project is now fully functional with comprehensive documentation. [See what was fixed](FIXES_SUMMARY.md) | [Final Status Report](FINAL_STATUS.md)

## Overview

NPS turns any Android device into a professional server platform with automatic optimization, real-time monitoring, and 18 production-ready templates.

### Key Features

- **18 Server Templates** - Web servers, databases, DNS, VPN, email, and more
- **Auto-Optimization** - Adapts to your device's RAM, CPU, and storage
- **Zero Configuration** - Works out of the box
- **Real-Time Monitoring** - Track performance with live dashboards
- **Auto-Recovery** - Automatic failure detection and restart
- **Enterprise Security** - SSL/TLS, firewalls, automated backups
- **Termux Optimized** - Runs perfectly on Android

## 🚀 Quick Start - Get Running in 5 Minutes

### Option 1: Automated Setup (Easiest)

```bash
git clone https://github.com/MrNova420/NPS.git
cd NPS
bash setup-complete.sh
```

The script will:
- ✅ Detect your environment (Termux or PC)
- ✅ Install dependencies automatically
- ✅ Create necessary directories
- ✅ Configure settings
- ✅ Guide you through SSH setup (if on PC)

Then start the dashboard:
```bash
cd dashboard
npm start
```

Open `http://localhost:3000` in your browser and start deploying servers!

### Option 2: Manual Setup

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed step-by-step instructions.

## 📚 Documentation

**Start Here:**
- 📘 [**SETUP_GUIDE.md**](SETUP_GUIDE.md) - Complete setup guide with troubleshooting
- 🚀 [**QUICK_USAGE.md**](QUICK_USAGE.md) - 5-minute quick start guide
- 📖 [**USAGE_GUIDE.md**](USAGE_GUIDE.md) - Complete in-depth usage guide

**Additional Guides:**
- [START_HERE.md](START_HERE.md) - Feature overview
- [QUICKSTART.md](QUICKSTART.md) - Deploy your first server
- [ADVANCED_README.md](ADVANCED_README.md) - Advanced features
- [PRODUCTION_README.md](PRODUCTION_README.md) - Production deployment

## Detailed Installation Options

### Option 1: Automated Installation (Recommended)

```bash
# Clone the repository
git clone https://github.com/MrNova420/NPS.git
cd NPS

# Run the installer (works on both Android/Termux and PC)
bash install.sh

# For Android: The script will guide you through Termux setup
# For PC: The script will set up dashboard and CLI
```

### Option 2: Running on Android (Termux)

```bash
# 1. Install Termux from F-Droid (NOT Play Store!)
# Download: https://f-droid.org/packages/com.termux/

# 2. Install prerequisites
pkg update && pkg upgrade
pkg install git nodejs openssh python

# 3. Clone and setup
git clone https://github.com/MrNova420/NPS.git
cd NPS
bash setup.sh

# 4. Find your Android device IP:
bash get-ip.sh
# Or manually: ip addr show wlan0 | grep "inet "

# 5. Start SSH server
sshd

# 6. Start services
~/server/scripts/service-manager.sh start
```

### Option 3: Controlling Android from PC

```bash
# On PC:
git clone https://github.com/MrNova420/NPS.git
cd NPS

# Run setup
bash setup.sh

# Edit .env with your Android device IP
nano .env  # Or use any text editor

# Start the dashboard
./start-dashboard.sh
# Or manually: cd dashboard && npm start
```

Access dashboard at `http://localhost:3000`

### Manual PC Setup

```bash
# 1. Find phone IP (on Android): 
bash get-ip.sh
# Or: ip addr show wlan0 | grep "inet "

# 2. Create dashboard/.env:
cat > dashboard/.env << EOF
ANDROID_HOST=192.168.1.50  # Your phone's IP
ANDROID_PORT=8022
ANDROID_USER=u0_a  # Run 'whoami' on Android
EOF

# 3. Start dashboard
cd dashboard && npm install && npm start
```

## Server Templates

### Basic Templates
- Static Web Server
- Node.js API
- Python Flask App
- PostgreSQL Database
- Redis Cache
- Minecraft Server
- Discord Bot
- File Storage Server
- AI Inference Server

### Advanced Templates
- Docker Manager
- Full-Stack Applications (MERN/PERN)
- Load Balancer
- CI/CD Pipeline
- Monitoring Stack (Grafana/Prometheus)
- Database Cluster
- DNS Server
- SSL Reverse Proxy
- Self-Hosting Suite (VPN/Email/Git/Cloud)

## Documentation

- [Quick Start Guide](QUICKSTART.md)
- [Getting Started](START_HERE.md)
- [Production Deployment](PRODUCTION_README.md)
- [Advanced Features](ADVANCED_README.md)

## System Requirements

**Android Device:**
- Android 7.0+
- 2GB+ RAM (4GB+ recommended)
- 2GB+ free storage
- Termux (from F-Droid)

**PC/Control Station:**
- Linux, macOS, or Windows WSL
- Node.js 14+
- SSH client

## Features

- **Performance Tiers** - Automatically detects device capability
- **Auto-Optimization** - CPU, memory, thermal management
- **SSL/TLS** - Automatic Let's Encrypt certificates
- **DNS Server** - Full DNS with zone management
- **Self-Hosting** - VPN, email, Git, cloud storage
- **Monitoring** - Real-time metrics and alerts
- **Backups** - Automated daily backups with retention
- **Recovery** - Auto-restart failed services

## Troubleshooting

### Installation Issues

**Problem: `install.sh: No such file or directory`**
```bash
# Make sure you're in the NPS directory
cd NPS
bash install.sh
```

**Problem: `npm -y` command not found**
```bash
# This has been fixed. Pull the latest changes:
git pull origin main
bash install.sh
```

**Problem: Missing dependencies**
```bash
# Verify installation
bash verify-install.sh

# Manually install dashboard dependencies
cd dashboard && npm install

# Manually install CLI dependencies
cd cli && npm install

# Install Python dependencies (Android/Termux)
pip install -r requirements.txt
```

**Problem: Password prompts when deploying servers**
```bash
# Setup SSH keys for password-free authentication
bash setup-ssh-keys.sh

# This will:
# 1. Generate SSH keys if needed
# 2. Copy keys to Android device
# 3. Configure SSH for automatic login

# After setup, you won't need to enter passwords!
```

**Problem: Can't connect to Android device from PC**
```bash
# On Android, check SSH is running:
pgrep sshd || sshd

# Find your Android device IP:
ifconfig

# On PC, test connection:
ssh -p 8022 <username>@<android-ip>
# Replace <username> with output of 'whoami' on Android

# Setup SSH keys to avoid password prompts:
bash setup-ssh-keys.sh
```

**Problem: Server deployment fails after 1-2 minutes**
```bash
# This usually means:
# 1. npm install is taking too long (improved timeout handling added)
# 2. Network connectivity issues
# 3. Insufficient resources

# Check logs:
cat dashboard/logs/*.log

# Verify SSH connection:
ssh -p 8022 <username>@<android-ip> "echo 'Connection OK'"

# Check device resources:
ssh -p 8022 <username>@<android-ip> "free -h && df -h"
```

**Problem: Dashboard won't start**
```bash
# Check if dependencies are installed
cd dashboard
npm install

# Try starting manually
node backend/server.js

# Check if port 3000 is already in use
lsof -ti:3000  # If shows a PID, kill it: kill <PID>
```

**Problem: CPU hitting 100% and server crashing**
```bash
# The dashboard now has:
# - Automatic rate limiting (100 req/min)
# - Resource throttling
# - Graceful shutdown handling

# You can manually limit server resources in config:
# Edit server config to set CPU/memory limits
```

### Common Errors

**Error: `EADDRINUSE: address already in use :::3000`**
- Another process is using port 3000
- Solution: `kill $(lsof -ti:3000)` or change PORT in .env

**Error: Python module not found**
- Install Python dependencies: `pip install -r requirements.txt`

**Error: Node.js version too old**
- Install Node.js 14 or higher
- On Termux: `pkg install nodejs`
- On PC: Visit https://nodejs.org

## Verification

Run the verification script to check your installation:
```bash
bash verify-install.sh
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

For issues and questions, please open an issue on GitHub.

## Author

Created by MrNova420

---

**Transform your Android phone into anything!** 🚀
