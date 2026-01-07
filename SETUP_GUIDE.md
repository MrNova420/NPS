# NPS Setup Guide - Getting Started

This guide will help you set up and start using NPS to host and manage servers.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Starting the Dashboard](#starting-the-dashboard)
5. [Creating Your First Server](#creating-your-first-server)
6. [Managing Servers](#managing-servers)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### For Android (Termux)
- Android device (Android 7.0+)
- [Termux](https://f-droid.org/packages/com.termux/) installed from F-Droid (NOT Play Store!)
- At least 2GB free storage
- Stable Wi-Fi connection

### For PC (Remote Management)
- Linux, macOS, or Windows with WSL
- Node.js 14+ installed
- SSH client installed
- Network access to your Android device

## Installation

### On Android (Termux)

1. **Update packages:**
```bash
pkg update && pkg upgrade
```

2. **Install required packages:**
```bash
pkg install git nodejs openssh python
```

3. **Clone the repository:**
```bash
cd ~
git clone https://github.com/MrNova420/NPS.git
cd NPS
```

4. **Install dashboard dependencies:**
```bash
cd dashboard
npm install
cd ..
```

5. **Create necessary directories:**
```bash
mkdir -p ~/server/{instances,logs,config,backups,state}
```

### On PC (Remote Control)

1. **Clone the repository:**
```bash
git clone https://github.com/MrNova420/NPS.git
cd NPS
```

2. **Install dashboard dependencies:**
```bash
cd dashboard
npm install
cd ..
```

3. **Set up SSH connection to Android:**
   - On Android, start SSH server: `sshd`
   - On Android, get your IP: `ifconfig` or `bash get-ip.sh`
   - Test connection from PC: `ssh -p 8022 username@android-ip`

## Configuration

### For Termux (Local Mode)

When running in Termux, NPS automatically detects the environment and runs in local mode (no SSH needed).

1. **Start the dashboard:**
```bash
cd ~/NPS/dashboard
npm start
```

2. **Access the dashboard:**
   - From Android browser: `http://localhost:3000`
   - From PC browser (if connected to same network): `http://android-ip:3000`

### For PC (Remote Mode)

1. **Copy the example environment file:**
```bash
cp .env.example dashboard/.env
```

2. **Edit the configuration:**
```bash
nano dashboard/.env
```

3. **Set these required values:**
```env
# Your Android device IP (find with ifconfig on Android)
ANDROID_HOST=192.168.1.100

# SSH port (default for Termux)
ANDROID_PORT=8022

# SSH username (run 'whoami' on Android)
ANDROID_USER=u0_a123

# Dashboard port
PORT=3000
```

4. **Set up SSH keys (optional but recommended):**
```bash
# Generate key if you don't have one
ssh-keygen -t rsa -b 4096

# Copy to Android
ssh-copy-id -p 8022 username@android-ip
```

## Starting the Dashboard

### From Termux (Android)
```bash
cd ~/NPS/dashboard
npm start
```

### From PC
```bash
cd NPS/dashboard
npm start
```

You should see output like:
```
╔══════════════════════════════════════════════════╗
║  NPS - Enterprise Server Management Platform    ║
╚══════════════════════════════════════════════════╝

✅ Core managers initialized
✅ Auto-recovery system initialized
✅ Auto server optimizer initialized

🌐 Dashboard URL: http://localhost:3000
```

## Creating Your First Server

### Via Web Dashboard

1. **Open your browser:**
   - Local: `http://localhost:3000`
   - Remote: `http://pc-ip:3000`

2. **Click "New Server" button**

3. **Choose a template:**
   - Start with simple templates like "Static Web Server" or "Node.js API"
   - Advanced templates are available for databases, load balancers, etc.

4. **Configure the server:**
   - **Name**: Give it a descriptive name (e.g., "my-api-server")
   - **Port**: Choose an available port (e.g., 8000)
   - **Options**: Configure template-specific options

5. **Click "Deploy"**

6. **Monitor deployment:**
   - Watch the status change from "creating" → "deploying" → "running"
   - Check the logs if there are issues

### Via API (Advanced)

```bash
# Create a Node.js API server
curl -X POST http://localhost:3000/api/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-api-server",
    "type": "nodejs-api",
    "port": 8000,
    "config": {
      "apiName": "my-api",
      "enableCors": true,
      "workers": 2
    }
  }'
```

## Managing Servers

### View All Servers
```bash
curl http://localhost:3000/api/servers
```

### Start/Stop/Restart Server
Via dashboard: Click the action buttons next to each server

Via API:
```bash
# Stop
curl -X POST http://localhost:3000/api/servers/SERVER_ID/stop

# Start
curl -X POST http://localhost:3000/api/servers/SERVER_ID/start

# Restart
curl -X POST http://localhost:3000/api/servers/SERVER_ID/restart
```

### View Server Logs
```bash
curl http://localhost:3000/api/servers/SERVER_ID/logs
```

### Delete Server
```bash
curl -X POST http://localhost:3000/api/servers/SERVER_ID/delete
```

## Available Server Templates

### Basic Templates
1. **Static Web Server** - Host HTML/CSS/JS files
2. **Node.js API** - REST API with Express.js
3. **Python Flask App** - Python web application
4. **PostgreSQL Database** - SQL database server
5. **Redis Cache** - In-memory data store
6. **Minecraft Server** - Game server
7. **Discord Bot** - Discord bot hosting
8. **File Storage** - File upload/download server
9. **AI Inference** - Machine learning model hosting

### Advanced Templates
1. **Docker Manager** - Container orchestration
2. **Full-Stack App** - Complete MERN/PERN stack
3. **Load Balancer** - Nginx reverse proxy
4. **CI/CD Pipeline** - Automated deployment
5. **Monitoring Stack** - Grafana + Prometheus
6. **Database Cluster** - Multi-node database
7. **DNS Server** - Custom DNS with zone management
8. **SSL Proxy** - HTTPS termination
9. **Self-Hosting Suite** - VPN, Email, Git, Cloud storage

## Troubleshooting

### Dashboard Won't Start

**Problem**: `Cannot find module 'express'`
```bash
cd dashboard
npm install
```

**Problem**: Port 3000 already in use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill
# Or change port in .env
echo "PORT=3001" >> dashboard/.env
```

### Can't Connect to Android from PC

**Problem**: SSH connection refused
```bash
# On Android, start SSH
sshd

# Check it's running
pgrep sshd

# Find your IP
ifconfig
```

**Problem**: Permission denied (publickey)
```bash
# Set up SSH keys
bash setup-ssh-keys.sh

# Or use password (less secure)
ssh -p 8022 username@android-ip
```

### Server Deployment Fails

**Problem**: npm install times out
- Check internet connection
- Increase timeout in server.js (already set to 5 minutes)
- Try manually: `cd ~/server/instances/SERVER_ID && npm install`

**Problem**: Port already in use
- Choose a different port
- Check what's using it: `lsof -i:PORT`
- Stop conflicting process

**Problem**: Insufficient resources
- Stop other servers
- Choose lighter templates
- Reduce worker processes in config

### Server Won't Start

**Problem**: Dependencies missing
```bash
# On Android/Termux
pkg install nodejs npm python

# Check versions
node --version  # Should be 14+
npm --version
```

**Problem**: Permission denied
```bash
# Make sure server directory is writable
chmod -R 755 ~/server
```

### Performance Issues

**Problem**: High CPU usage
- Reduce number of workers in server config
- Stop unused servers
- Check auto-optimization is working: `/api/system/stats`

**Problem**: Memory errors
- Reduce number of concurrent servers
- Increase swap: `pkg install root-repo && pkg install tsu`
- Monitor: `/api/system/resources`

## Tips for Success

### Best Practices
1. **Start Small**: Begin with simple templates (static web, basic API)
2. **Test Locally**: Deploy to localhost first before exposing publicly
3. **Monitor Resources**: Keep an eye on CPU/memory usage
4. **Regular Backups**: Use the backup feature for important servers
5. **Update Regularly**: `git pull origin main` to get latest features

### Security Tips
1. **Change Default Ports**: Don't use common ports like 3000, 8080
2. **Use SSH Keys**: Set up key-based authentication
3. **Enable Firewall**: Use Termux firewall or Android firewall apps
4. **Limit Exposure**: Only expose necessary ports to public
5. **Keep Updated**: Update Termux packages regularly

### Performance Tips
1. **Use Clustering**: Enable worker processes for Node.js servers
2. **Enable Compression**: Use built-in compression in templates
3. **Cache Static Assets**: Use Redis for caching when possible
4. **Monitor Metrics**: Check `/api/system/performance` regularly
5. **Clean Up Logs**: Old logs are auto-compressed

## Getting Help

### Resources
- **Documentation**: See other .md files in this repo
- **Issues**: Open issue on GitHub
- **API Reference**: Check server.js for all endpoints
- **Templates**: Browse server-templates/ directory

### Common Commands Cheat Sheet

```bash
# Start dashboard
cd NPS/dashboard && npm start

# Check dashboard status
curl http://localhost:3000/api/health

# List all servers
curl http://localhost:3000/api/servers

# View system stats
curl http://localhost:3000/api/system/stats

# Create web server
curl -X POST http://localhost:3000/api/servers \
  -H "Content-Type: application/json" \
  -d '{"name":"web","type":"web-static","port":8080}'

# Stop all servers (in Termux)
pkill -f "node server.js"

# View dashboard logs
tail -f ~/NPS/dashboard/logs/*.log

# Clean up old instances
rm -rf ~/server/instances/*
```

## Next Steps

After successfully setting up:
1. ✅ Explore different server templates
2. ✅ Set up monitoring and alerts
3. ✅ Configure automated backups
4. ✅ Try advanced templates (databases, load balancers)
5. ✅ Expose services publicly (with proper security)

---

**Need more help?** Check out:
- [QUICK_USAGE.md](QUICK_USAGE.md) - Quick reference
- [USAGE_GUIDE.md](USAGE_GUIDE.md) - Detailed usage guide
- [PRODUCTION_README.md](PRODUCTION_README.md) - Production deployment

**Happy hosting!** 🚀
