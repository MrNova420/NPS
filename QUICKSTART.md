# Quick Start Guide

## 🚀 Getting Started

### On Your Android Phone:

1. **Install Termux from F-Droid** (NOT Play Store!)
   - Download: https://f-droid.org/en/packages/com.termux/

2. **Copy setup script to phone** and run:
   ```bash
   pkg update && pkg upgrade
   pkg install curl git
   
   # Copy the termux-setup.sh script to your phone
   # Then run:
   bash termux-setup.sh
   ```

3. **Find your phone's IP address:**
   ```bash
   ifconfig
   ```
   Look for something like `192.168.1.xxx`

4. **Start services:**
   ```bash
   ~/server/scripts/service-manager.sh start
   ```

### On Your PC:

1. **Test SSH connection:**
   ```bash
   ssh -p 8022 <username>@<phone-ip>
   ```

2. **Use Python client for quick commands:**
   ```bash
   ./setup/pc/pc-client.py <phone-ip> info
   ./setup/pc/pc-client.py <phone-ip> service status
   ./setup/pc/pc-client.py <phone-ip> shell
   ```

3. **Launch web control panel:**
   ```bash
   cd control-panel
   npm install
   export ANDROID_HOST=<phone-ip>
   export ANDROID_USER=<username>
   npm start
   ```
   Open: http://localhost:3000

## 📱 What Can You Do?

### Web Hosting
```bash
# On Android
echo "<h1>Hello World!</h1>" > ~/server/web/index.html
nginx
# Visit: http://<phone-ip>:8080
```

### Database Server
```bash
# On Android
bash services/database/setup-postgres.sh
pg_ctl -D $PREFIX/var/lib/postgresql start
createdb myapp
```

### File Server
```bash
# On Android
cd ~/storage/shared
python -m http.server 8000
# Visit: http://<phone-ip>:8000
```

### Task Automation
```bash
# On Android
cd automation
pip install schedule
python3 task-scheduler.py
```

### AI/ML Serving
```bash
# Install Python ML libraries
pip install numpy tensorflow-lite onnxruntime
# Deploy your models
```

### Game Servers
```bash
# Minecraft server example
pkg install openjdk-17
wget https://papermc.io/api/v2/projects/paper/versions/1.20.4/builds/latest/downloads/paper-1.20.4.jar
java -Xmx1G -jar paper-1.20.4.jar
```

## 🔧 Common Commands

### Service Management
```bash
# Start all services
~/server/scripts/service-manager.sh start

# Stop all services  
~/server/scripts/service-manager.sh stop

# Check status
~/server/scripts/service-manager.sh status
```

### Monitoring
```bash
# Real-time dashboard
~/android-server-control/monitoring/monitor.sh

# System info
~/server/scripts/system-info.sh

# Resource usage
htop
```

### Backups
```bash
# Manual backup
tar -czf ~/server/backups/backup_$(date +%Y%m%d).tar.gz ~/server/data

# Restore
tar -xzf ~/server/backups/backup_20260105.tar.gz -C ~/
```

## 🌐 Remote Access Setup

### DDNS (For internet access)
```bash
# Install No-IP client
pkg install noip2
noip2 -C  # Configure

# Or use DuckDNS
curl "https://www.duckdns.org/update?domains=yourdomain&token=yourtoken&ip="
```

### Port Forwarding
- Open your router admin panel
- Forward port 8022 → <phone-ip>:8022 (SSH)
- Forward port 8080 → <phone-ip>:8080 (Web)

### VPN (Recommended)
```bash
# Wireguard
pkg install wireguard-tools
# Configure with your VPN provider
```

## 🛡️ Security Checklist

- [ ] Change default SSH port
- [ ] Use SSH key authentication
- [ ] Disable password auth
- [ ] Setup firewall rules
- [ ] Use VPN for remote access
- [ ] Regular backups
- [ ] Keep packages updated
- [ ] Monitor access logs

## 📊 Performance Tips

- Disable unused Android services
- Use static IP for phone
- Keep phone plugged in 24/7
- Enable airplane mode (use WiFi only)
- Clear cache regularly: `rm -rf ~/.cache/*`
- Monitor temperature to prevent throttling

## 🆘 Troubleshooting

**Can't connect via SSH?**
```bash
# On Android, check SSH is running
pgrep sshd || sshd
# Check your IP
ifconfig
```

**Service won't start?**
```bash
# Check logs
tail ~/server/logs/*.log
# Check if port is in use
netstat -tuln | grep <port>
```

**Out of space?**
```bash
# Check usage
df -h
# Clean up
pkg clean
rm -rf ~/.cache/*
```

## 📚 Next Steps

1. Read full setup guide: `docs/SETUP_GUIDE.md`
2. Configure your services
3. Deploy your applications
4. Setup monitoring and alerts
5. Configure automated backups
6. Join r/termux and r/selfhosted for tips

## 💡 Project Ideas

- Personal cloud storage (Nextcloud)
- Home automation hub
- Media server (Jellyfin/Plex)
- Git server (Gitea)
- Password manager (Vaultwarden)
- RSS reader (FreshRSS)
- Wiki (BookStack)
- CI/CD runner
- Development environment
- AI model inference server
- Discord/Telegram bots
- Minecraft server
- Web scraping service
- API gateway
- And much more!

---

**Need Help?** Check the docs or ask in Termux communities!
