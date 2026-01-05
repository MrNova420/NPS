# 🚀 NPS v2.0 - PRODUCTION-GRADE SERVER PLATFORM

## Turn Your Android Into An Enterprise Server

**NPS (Nova's Private Server)** is now a **fully production-ready**, **enterprise-grade** server platform that transforms any Android device into a **professional hosting environment** with **maximum performance**, **reliability**, and **security**.

---

## ⚡ NEW: Production-Grade Features

### 🎯 **Auto-Performance Optimization**
- **Device Detection** - Automatically detects CPU, RAM, storage
- **Tier Classification** - High/Medium/Low/Minimal performance tiers
- **Smart Resource Allocation** - Optimizes based on device capabilities
- **Kernel Tuning** - Network, memory, I/O optimization
- **CPU Governor** - Performance mode for server workload
- **Thermal Management** - Prevents overheating with auto-throttling

### 📊 **Real-Time Performance Manager**
- **5-Second Metrics** - CPU, memory, disk, temperature
- **Predictive Analysis** - Forecasts resource exhaustion
- **Auto-Optimization** - Clears cache, frees memory automatically
- **Alert System** - Critical/warning thresholds
- **Performance Reports** - Detailed analytics and recommendations

### 🔒 **Enterprise Security**
- **SSH Hardening** - Rate limiting, key auth, secure defaults
- **Firewall Rules** - IP tables configuration
- **Rate Limiting** - API, SSH, HTTP protection
- **Access Logging** - Complete audit trail
- **Automated Patching** - Security update system

### 💾 **Disaster Recovery**
- **Automated Backups** - Daily backups with 7-day rotation
- **Database Dumps** - PostgreSQL automatic backups
- **One-Click Restore** - Complete system recovery
- **Backup Verification** - Ensures backup integrity
- **Off-Site Ready** - Easy cloud backup integration

### 🏥 **Health Monitoring**
- **Service Monitoring** - Checks SSH, Nginx, databases
- **Resource Monitoring** - CPU, memory, disk alerts
- **Temperature Monitoring** - Thermal protection
- **Network Monitoring** - Connectivity checks
- **Auto-Restart** - Failed services auto-recover

### 🔄 **Auto-Recovery System**
- **Crash Detection** - Monitors all services
- **Automatic Restart** - Services restart on failure
- **Database Recovery** - PostgreSQL auto-repair
- **Failover Support** - Graceful degradation
- **Recovery Logging** - Complete recovery audit

### 📈 **Performance Profiling**
- **CPU Profiling** - 10-sample analysis
- **Memory Analysis** - Usage patterns
- **Disk I/O Tracking** - Performance metrics
- **Network Stats** - Connection analysis
- **Optimization Recommendations** - AI-powered suggestions

### 🎛️ **Production Service Manager**
- **Unified Control** - Start/stop all services
- **Process Management** - PID tracking
- **Log Management** - Centralized logging
- **Status Dashboard** - Real-time service status
- **Graceful Shutdown** - Safe service termination

---

## 📊 Performance Tiers

NPS automatically configures based on your device:

### High Tier (6GB+ RAM)
- Max Servers: **12**
- Worker Processes: **4**
- Memory per Server: **512MB**
- CPU per Server: **8%**
- Recommended: Flagship phones, tablets

### Medium Tier (4-6GB RAM)
- Max Servers: **8**
- Worker Processes: **3**
- Memory per Server: **512MB**
- CPU per Server: **12%**
- Recommended: Mid-range phones

### Low Tier (2-4GB RAM)
- Max Servers: **4**
- Worker Processes: **2**
- Memory per Server: **512MB**
- CPU per Server: **25%**
- Recommended: Budget phones
- Auto-swap: Enabled

### Minimal Tier (<2GB RAM)
- Max Servers: **2**
- Worker Processes: **1**
- Memory per Server: **512MB**
- CPU per Server: **50%**
- Recommended: Old devices
- Auto-swap: Enabled
- Low-memory mode: Active

---

## 🚀 Production Deployment

### Initial Setup

```bash
# 1. Run performance optimization
bash core/performance/optimize.sh

# 2. Run production hardening
bash core/security/production-harden.sh

# 3. Start production environment
bash ~/server/startup.sh
```

### Production Startup

```bash
# Automated startup script starts:
✓ SSH Server
✓ Performance Monitor
✓ Health Check System
✓ Auto-Recovery Daemon
✓ Performance Optimizer
```

### Monitoring

```bash
# Real-time status dashboard
~/server/scripts/status-dashboard.sh

# Performance profiling
~/server/scripts/performance-profiler.sh

# Service status
~/server/scripts/service-manager.sh status
```

---

## 🎛️ Production Commands

### Service Management
```bash
# Start all services
~/server/scripts/service-manager.sh start

# Stop all services
~/server/scripts/service-manager.sh stop

# Restart services
~/server/scripts/service-manager.sh restart

# Check status
~/server/scripts/service-manager.sh status

# Manage individual service
~/server/scripts/service-manager.sh start performance-monitor
```

### Backup & Recovery
```bash
# Manual backup
~/server/scripts/auto-backup.sh

# Disaster recovery
~/server/scripts/disaster-recovery.sh

# View backups
ls -lh ~/server/backups/
```

### Performance
```bash
# Run optimizer
bash core/performance/optimize.sh

# Performance profile
~/server/scripts/performance-profiler.sh

# Check performance config
cat ~/server/config/profile.json
```

### Monitoring
```bash
# Status dashboard (live)
~/server/scripts/status-dashboard.sh

# Performance logs
tail -f ~/server/logs/performance.log

# Alert logs
tail -f ~/server/logs/alerts.log

# Recovery logs
tail -f ~/server/logs/recovery.log
```

---

## 🔧 Configuration Files

All configurations are auto-generated but customizable:

```
~/server/config/
├── performance.conf    # Performance settings
├── profile.json        # Device profile
├── rate-limits.conf    # Rate limiting rules
├── logrotate.conf      # Log rotation
├── firewall.rules      # Firewall configuration
└── sysctl.conf         # Kernel parameters
```

---

## 📈 Performance Optimizations

### Automatic Optimizations Applied:

1. **CPU**
   - Performance governor
   - Frequency scaling disabled
   - Process affinity

2. **Memory**
   - Swappiness = 10
   - Cache pressure = 50
   - Swap if needed (<4GB RAM)

3. **Network**
   - TCP buffer optimization
   - Connection pooling
   - Keepalive tuning

4. **I/O**
   - Deadline scheduler
   - Read-ahead optimization
   - Write-back caching

5. **Thermal**
   - Temperature monitoring
   - Auto-throttling >70°C
   - Critical shutdown >80°C

---

## 🏥 Health & Reliability

### Auto-Monitoring Every Minute:

- ✅ Service health (SSH, Nginx, databases)
- ✅ Resource usage (CPU >90%, Memory >85%, Disk >90%)
- ✅ Temperature (>70°C warning, >80°C critical)
- ✅ Network connectivity
- ✅ Database connections

### Auto-Recovery Actions:

- 🔄 Restart crashed services
- 🧹 Clear cache when memory >85%
- 💾 Compress logs when disk >85%
- ❄️ Thermal throttle when temp >75°C
- 🚨 Send notifications for critical alerts

---

## 📊 Dashboard Integration

The web dashboard now shows:

- **Performance Tier** - Device classification
- **Resource Limits** - Max servers, memory, CPU
- **Live Metrics** - Real-time performance data
- **Alerts** - Critical warnings and recommendations
- **Optimization Status** - Auto-optimization activity

Access: `http://localhost:3000/api/system/performance`

---

## 🎯 Production Best Practices

### DO:
✅ Run optimization script after device changes
✅ Monitor temperature in hot environments
✅ Keep device plugged in 24/7
✅ Use SSH keys for authentication
✅ Enable auto-backup (daily)
✅ Check alerts regularly
✅ Test disaster recovery monthly

### DON'T:
❌ Don't exceed recommended server count
❌ Don't ignore thermal warnings
❌ Don't disable auto-recovery
❌ Don't run on battery for production
❌ Don't skip backups
❌ Don't ignore critical alerts

---

## 🚨 Alert Levels

### Warning (Yellow)
- CPU >75%
- Memory >80%
- Disk >80%
- Temperature >70°C

**Action:** Monitor closely, optimize if sustained

### Critical (Red)
- CPU >90%
- Memory >95%
- Disk >95%
- Temperature >80°C

**Action:** Auto-optimization triggered, reduce load

---

## 💪 Production-Ready Checklist

Before going live:

- [ ] Run `bash core/performance/optimize.sh`
- [ ] Run `bash core/security/production-harden.sh`
- [ ] Configure firewall rules
- [ ] Setup SSH key authentication
- [ ] Enable auto-backup (cron)
- [ ] Test disaster recovery
- [ ] Configure monitoring alerts
- [ ] Setup remote access (VPN/DDNS)
- [ ] Document your configuration
- [ ] Test under load
- [ ] Verify all services start on boot
- [ ] Setup temperature monitoring

---

## 📈 Scaling Guidelines

### When to Scale:

**Add More Servers:**
- Average CPU < 60%
- Average Memory < 70%
- Temperature < 65°C

**Reduce Servers:**
- Average CPU > 80%
- Average Memory > 85%
- Temperature > 70°C
- Frequent thermal throttling

**Upgrade Device:**
- Consistently hitting limits
- Need more than tier max
- Thermal issues persist
- Performance unsatisfactory

---

## 🎓 Advanced Features

### Custom Performance Tuning
```bash
# Edit performance config
nano ~/server/config/performance.conf

# Apply changes
bash core/performance/optimize.sh
```

### Custom Alert Thresholds
```javascript
// In core/performance/manager.js
thermal: {
    max_temp_c: 75,      // Adjust
    throttle_temp_c: 70,  // Adjust
    critical_temp_c: 80   // Adjust
}
```

### Custom Backup Schedule
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * ~/server/scripts/auto-backup.sh
```

---

## 📊 Monitoring & Alerts

### Email Alerts (Optional)
```bash
# Install termux-api
pkg install termux-api

# Alerts will use termux-notification
# Or configure email in health-check.sh
```

### External Monitoring
```bash
# Expose metrics endpoint
curl http://localhost:3000/api/system/performance

# Use with Grafana, Prometheus, etc.
```

---

## 🔬 Performance Testing

```bash
# Run performance profiler
~/server/scripts/performance-profiler.sh

# Load test your servers
# (Use tools like ab, wrk, siege)

# Monitor during load
~/server/scripts/status-dashboard.sh
```

---

## 🎉 Production Features Summary

✅ **Auto-Performance Optimization** - Device-aware tuning
✅ **Real-Time Monitoring** - 5-second metrics
✅ **Intelligent Resource Management** - Automatic optimization
✅ **Enterprise Security** - Hardened configuration
✅ **Disaster Recovery** - Automated backups & restore
✅ **Health Monitoring** - 60-second checks
✅ **Auto-Recovery** - Crash prevention
✅ **Performance Profiling** - Detailed analysis
✅ **Production Service Manager** - Unified control
✅ **Thermal Management** - Overheating protection
✅ **Log Rotation** - Automatic log management
✅ **Rate Limiting** - DDoS protection
✅ **Firewall Rules** - Network security

---

**NPS is now a true production-grade platform.**

Transform your Android into an enterprise server with confidence! 🚀

---

*Made with ❤️ for production workloads*
