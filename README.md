# NPS - Nova's Private Server

Transform your Android phone into a powerful, production-ready server with enterprise features.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0--beta-green.svg)](https://github.com/MrNova420/NPS)
[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20Termux-orange.svg)](https://termux.dev)

> **⚡ Latest Update:** Critical dashboard fixes applied! CPU feedback loop fixed, template loading corrected, SSH blocking resolved. All systems operational. [See details](FIXES_APPLIED.md)

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

## Quick Start

### Running on Android (Termux)

```bash
pkg install git nodejs openssh
git clone https://github.com/MrNova420/NPS.git
cd NPS
sshd  # Start SSH server
./quick-start.sh
```

### Controlling Android from PC

```bash
# On PC:
git clone https://github.com/MrNova420/NPS.git
cd NPS
./setup-pc-to-phone.sh  # Interactive setup - asks for phone IP
# Then: cd dashboard && npm start
```

Access dashboard at `http://localhost:3000`

### Manual PC Setup

```bash
# 1. Find phone IP (on Android): ifconfig
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
