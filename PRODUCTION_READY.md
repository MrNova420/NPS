# NPS - Nova Private Server
## Production-Grade Server Management for Android Devices

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.0.0--production-green.svg)](VERSION)
[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20Termux-orange.svg)](https://termux.dev)

> Transform your Android phone into a professional, production-grade server platform with enterprise-level features.

---

## 🚀 What is NPS?

NPS is a complete server management platform that turns any Android device into a powerful, reliable server infrastructure. Built specifically for ARM architecture (Cortex-A53) and optimized for devices like the **TCL T608G** (8 cores, 4GB RAM, 19GB storage).

### Key Highlights

- ✅ **10 Enterprise Core Systems** - Process management, resource allocation, thermal control, health monitoring
- ✅ **Production-Grade Templates** - Ready-to-deploy servers with clustering, security, monitoring
- ✅ **Automatic Recovery** - Failed servers restart automatically with exponential backoff
- ✅ **Resource Management** - Intelligent CPU/memory/bandwidth allocation
- ✅ **Service Discovery** - Import existing services running on your device
- ✅ **Automated Maintenance** - Clean logs, backups, optimize databases
- ✅ **User-Friendly Setup** - One command installs everything

---

## 📋 Quick Start

### Android/Termux Setup (5 minutes)

```bash
# 1. Install Termux from F-Droid
# Download: https://f-droid.org/packages/com.termux/

# 2. In Termux, clone and setup
pkg install git
git clone https://github.com/MrNova420/NPS.git
cd NPS
./setup-friendly.sh

# 3. Start NPS
~/server/start-nps.sh

# 4. Open dashboard
# http://localhost:3000
```

### PC Control Setup (3 minutes)

```bash
# 1. Clone repository
git clone https://github.com/MrNova420/NPS.git
cd NPS

# 2. Install dependencies
cd dashboard
npm install

# 3. Configure connection
cat > .env << EOF
ANDROID_HOST=192.168.1.XXX  # Your phone's IP
ANDROID_PORT=8022
ANDROID_USER=u0_a           # Run 'whoami' on Android
EOF

# 4. Start dashboard
npm start

# 5. Open browser
# http://localhost:3000
```

---

## 🎯 Core Features

### Enterprise Core Systems

#### 1. **ProcessManager** - PM2-Like Process Orchestration
- Health checks every 30 seconds
- Auto-restart with configurable max attempts
- Resource limit enforcement (CPU/memory)
- Graceful shutdown handling
- Process log aggregation

#### 2. **ResourceAllocator** - Intelligent Resource Distribution
- ARM Cortex-A53 optimized CPU affinity
- Memory allocation with swap awareness (4GB RAM + 1.8GB swap)
- OOM score management
- Per-server resource profiles
- Capacity planning and recommendations

#### 3. **ThermalManager** - Temperature Monitoring & Protection
- Real-time temperature monitoring
- Thermal throttling detection
- Predictive thermal analysis
- Safe-to-start server checks
- Emergency shutdown protection
- Cooling recommendations

#### 4. **NetworkManager** - Bandwidth Management
- Bandwidth monitoring and allocation
- Network performance optimization (86 Mbps down / 12 Mbps up)
- QoS traffic shaping
- Connection tracking (max 1000 concurrent)
- Latency monitoring
- Saturation alerts

#### 5. **HealthCheckSystem** - Multi-Protocol Health Monitoring
- HTTP/HTTPS health checks
- PostgreSQL connection tests
- Redis PING tests
- Minecraft server checks
- Generic port availability checks
- Response time tracking
- Success rate calculation
- Health history (last 100 checks)

#### 6. **AutoRecoverySystem** - Automatic Server Recovery
- Exponential backoff (30s, 60s, 120s)
- Max recovery attempts (configurable, default 3)
- Cooldown period (5 minutes)
- Recovery success tracking
- Manual recovery trigger
- Per-server recovery state

#### 7. **ServiceDiscovery** - System Scanning & Import
- Scan for running services
- Port usage analysis
- Process identification
- Service type detection (PostgreSQL, Redis, Node.js, etc.)
- Import external services into NPS
- Orphan detection
- Port availability checking
- Process details retrieval

#### 8. **CleanupSystem** - Automated Maintenance
- Automated log cleanup (7-day retention)
- Backup cleanup (30-day retention)
- Temp file management
- NPM cache cleanup
- Disk usage analysis
- Large file detection (>100MB)
- Database optimization (VACUUM)
- Log compression (gzip)
- Cleanup recommendations

#### 9. **StateManager** - Persistent State
- Auto-save every 5 seconds
- Atomic file writes
- Graceful shutdown handling
- State migration support

#### 10. **PerformanceManager** - Real-Time Metrics
- CPU usage tracking
- Memory monitoring
- Disk usage analysis
- Network statistics
- Temperature readings

---

## 📦 Server Templates

### Production-Ready Templates

#### Node.js API Server
- Multi-worker clustering
- Helmet security headers
- Request compression (gzip)
- Morgan access logging
- Rate limiting (100 req/min)
- Health/readiness checks
- Metrics endpoint
- Request ID tracking
- Graceful shutdown
- Error handling

#### PostgreSQL Database
- ARM-optimized configuration
- Shared buffers tuned for 4GB RAM
- Connection pooling ready
- pg_stat_statements extension
- Comprehensive logging
- WAL configuration
- Autovacuum tuning
- Automatic backups (daily)
- 7-day backup retention

#### Redis Cache
- Memory optimization for 4GB devices
- Persistence options (RDB/AOF)
- Password protection
- LRU eviction policy
- Security (disabled dangerous commands)
- Monitoring ready

#### Static Website
- Nginx-based hosting
- Compression enabled
- Caching configured
- Security headers
- Resource-optimized

### Template Categories

**Basic Templates (9)**
- Static Web Server
- Node.js API
- Python Flask
- PostgreSQL
- Redis Cache
- Minecraft Server
- Discord Bot
- File Storage
- AI Inference

**Advanced Templates (9)**
- Docker Manager
- Full-Stack Apps (MERN/PERN)
- Load Balancer
- CI/CD Pipeline
- Monitoring Stack (Grafana/Prometheus)
- Database Cluster
- DNS Server
- SSL Reverse Proxy
- Self-Hosting Suite (VPN/Email/Git)

---

## 🔧 API Reference

### Server Management

```bash
# List all servers
GET /api/servers

# Create server
POST /api/servers
{
  "name": "my-api",
  "type": "nodejs-api",
  "config": { ... }
}

# Control server
POST /api/servers/:id/start
POST /api/servers/:id/stop
POST /api/servers/:id/restart
POST /api/servers/:id/delete

# Get server logs
GET /api/servers/:id/logs

# Update server config
PATCH /api/servers/:id
{
  "memory_limit": 512,
  "cpu_limit": 20
}
```

### System Monitoring

```bash
# System stats
GET /api/system/stats

# Performance report
GET /api/system/performance

# Resource utilization
GET /api/system/resources

# Thermal status
GET /api/system/thermal

# Network metrics
GET /api/system/network

# System health
GET /api/system/health

# Process list
GET /api/system/processes
```

### Service Discovery

```bash
# Scan system for services
GET /api/discovery/scan

# Check if port is available
GET /api/discovery/port/:port

# Find available port
GET /api/discovery/port/available/8000/9000

# Get process details
GET /api/discovery/process/:pid

# Import service
POST /api/discovery/import
{
  "type": "postgresql",
  "port": 5432,
  "pid": 12345
}
```

### Cleanup & Maintenance

```bash
# Get cleanup report
GET /api/cleanup/report

# Run routine cleanup
POST /api/cleanup/routine

# Analyze disk usage
GET /api/cleanup/disk

# Find large files
GET /api/cleanup/large-files/100

# Clean server instance
POST /api/cleanup/server/:id

# Compress logs
POST /api/cleanup/compress-logs
```

### Health Monitoring

```bash
# Get all servers health
GET /api/health/all

# Get server health
GET /api/health/server/:id

# Force health check
POST /api/health/check/:id
```

### Auto-Recovery

```bash
# Get recovery statistics
GET /api/recovery/stats

# Get server recovery state
GET /api/recovery/server/:id

# Trigger manual recovery
POST /api/recovery/trigger/:id

# Enable/disable recovery
POST /api/recovery/enable
{ "enabled": true }
```

---

## 💻 System Requirements

### Android Device
- Android 7.0+ (Android 14 recommended)
- 2GB+ RAM (4GB recommended)
- 2GB+ free storage (19GB recommended)
- Termux (from F-Droid)
- ARM processor (Cortex-A53 optimized)

### PC/Control Station
- Linux, macOS, or Windows WSL
- Node.js 14+
- SSH client
- Modern web browser

---

## 📊 Performance Characteristics

### Tested On: TCL T608G

**Hardware:**
- CPU: 8-core ARM Cortex-A53 @ 2.3 GHz
- RAM: 4GB
- Storage: 19GB usable (150 MB/s speed)
- Network: 86 Mbps down / 12 Mbps up
- Swap: 1.8GB

**Capabilities:**
- Concurrent servers: 8-12 (depending on type)
- Safe memory usage: 2.5-3GB
- Network throughput: ~20-40 concurrent users
- Storage: Sufficient for 10+ server instances

**What It Can Run Simultaneously:**
- Multiple web servers
- PostgreSQL database
- Redis cache
- Discord bot
- API services
- Minecraft server (small)
- File storage
- Monitoring stack

---

## 🛠️ Convenience Scripts

After setup, these scripts are available:

```bash
# Start NPS
~/server/start-nps.sh

# Check status
~/server/status.sh

# Interactive cleanup
~/server/cleanup.sh

# View quick reference
cat ~/server/QUICK_START.txt
```

---

## 🔒 Security Features

- **Helmet Security Headers** - XSS, clickjacking protection
- **Rate Limiting** - Prevent API abuse
- **Password Protection** - For databases and caches
- **SSH Key Authentication** - Secure remote access
- **Process Isolation** - Separate user contexts
- **Resource Limits** - Prevent resource exhaustion
- **OOM Score Tuning** - Protect critical services

---

## 📈 Monitoring & Alerts

### Real-Time Metrics
- CPU usage per core
- Memory usage (physical + swap)
- Disk usage and I/O
- Network bandwidth
- Temperature
- Process count
- Connection count

### Health Checks
- HTTP endpoint checks
- Database connectivity
- Cache availability
- Port listening status
- Response time tracking

### Alerts
- High resource usage
- Thermal warnings
- Server failures
- Disk space low
- Bandwidth saturation

---

## 🧹 Maintenance

### Automated Cleanup
- Old log files (>7 days)
- Old backups (>30 days)
- Temporary files
- NPM cache
- Database optimization

### Manual Maintenance
```bash
# Run cleanup
~/server/cleanup.sh

# Or via API
curl -X POST http://localhost:3000/api/cleanup/routine

# Check disk usage
curl http://localhost:3000/api/cleanup/disk

# Find large files
curl http://localhost:3000/api/cleanup/large-files/100
```

---

## 🐛 Troubleshooting

### Dashboard Won't Start
```bash
# Check if port 3000 is available
lsof -i :3000

# Check SSH connectivity
ssh -p 8022 user@phone-ip

# Check logs
cat ~/server/logs/dashboard.log
```

### Server Won't Create
```bash
# Check system health
curl http://localhost:3000/api/system/health

# Check resources
curl http://localhost:3000/api/system/resources

# Check thermal status
curl http://localhost:3000/api/system/thermal
```

### Server Keeps Crashing
```bash
# Check auto-recovery status
curl http://localhost:3000/api/recovery/stats

# Check server health
curl http://localhost:3000/api/health/server/:id

# View server logs
curl http://localhost:3000/api/servers/:id/logs
```

---

## 📚 Documentation

- [Quick Start Guide](QUICKSTART.md)
- [Setup Guide](docs/SETUP_GUIDE.md)
- [Service Examples](docs/SERVICE_EXAMPLES.md)
- [API Reference](docs/REFERENCE.md)
- [Production Deployment](PRODUCTION_README.md)
- [Advanced Features](ADVANCED_README.md)

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 👤 Author

Created by MrNova420

---

## 🌟 Acknowledgments

- Built for the Termux community
- Optimized for ARM Cortex-A53
- Inspired by production server management tools

---

**Transform your Android phone into anything!** 🚀📱💻
