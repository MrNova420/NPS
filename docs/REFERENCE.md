# Android Server Project - Complete Reference

## 🎯 Project Overview

Transform your Android phone (4GB RAM, 8-core CPU, 64GB storage) into a full-featured server that you can control from your PC. Host websites, databases, game servers, AI models, and much more.

## 📁 Project Structure

```
android-server-control/
├── README.md              # Project overview and architecture
├── QUICKSTART.md          # Quick start guide
├── .gitignore            # Git ignore rules
│
├── setup/                # Setup scripts
│   ├── android/
│   │   └── termux-setup.sh    # Android/Termux automated setup
│   └── pc/
│       ├── install.sh         # PC client installer
│       └── pc-client.py       # Python CLI client
│
├── control-panel/        # Web-based control interface
│   ├── package.json      # Node.js dependencies
│   ├── server.js         # Express server (API backend)
│   └── public/
│       └── index.html    # Web UI dashboard
│
├── services/             # Service configurations
│   ├── web/
│   │   └── nginx-android.conf    # Nginx config
│   ├── database/
│   │   └── setup-postgres.sh    # PostgreSQL setup
│   ├── storage/          # File server configs
│   └── game/            # Game server configs
│
├── automation/           # Task automation
│   └── task-scheduler.py        # Scheduled task manager
│
├── monitoring/          # System monitoring
│   └── monitor.sh       # Real-time dashboard
│
└── docs/                # Documentation
    ├── SETUP_GUIDE.md   # Complete setup guide
    └── SERVICE_EXAMPLES.md  # Service configurations
```

## 🚀 Quick Commands Reference

### Android Phone Commands

```bash
# Initial setup
bash termux-setup.sh

# Service management
~/server/scripts/service-manager.sh start|stop|status

# System information
~/server/scripts/system-info.sh

# Find IP address
ifconfig

# Keep Termux running
termux-wake-lock

# Start SSH server
sshd

# Start web server
nginx

# Start database
pg_ctl -D $PREFIX/var/lib/postgresql start

# Real-time monitoring
~/android-server-control/monitoring/monitor.sh
```

### PC Commands

```bash
# Setup PC client
bash setup/pc/install.sh

# SSH to phone
ssh -p 8022 <user>@<phone-ip>

# Python CLI client
./setup/pc/pc-client.py <phone-ip> info
./setup/pc/pc-client.py <phone-ip> service status
./setup/pc/pc-client.py <phone-ip> monitor
./setup/pc/pc-client.py <phone-ip> shell

# Deploy file to phone
./setup/pc/pc-client.py <phone-ip> deploy local.txt ~/remote.txt

# Fetch file from phone
./setup/pc/pc-client.py <phone-ip> fetch ~/remote.txt local.txt

# Start web control panel
cd control-panel
export ANDROID_HOST=<phone-ip>
export ANDROID_USER=<username>
npm start
# Access: http://localhost:3000
```

## 🌐 Default Ports

| Service       | Port  | Protocol | Access URL                    |
|--------------|-------|----------|-------------------------------|
| SSH          | 8022  | TCP      | ssh -p 8022 user@phone-ip     |
| Nginx Web    | 8080  | TCP      | http://phone-ip:8080          |
| Nginx Files  | 8081  | TCP      | http://phone-ip:8081          |
| PostgreSQL   | 5432  | TCP      | psql -h phone-ip -p 5432      |
| Redis        | 6379  | TCP      | redis-cli -h phone-ip         |
| Node.js App  | 3000  | TCP      | http://phone-ip:3000          |
| Python Flask | 5000  | TCP      | http://phone-ip:5000          |
| Control Panel| 3000  | TCP      | http://localhost:3000 (PC)    |

## 📦 Package Management

```bash
# Update packages
pkg update && pkg upgrade

# Install package
pkg install <package-name>

# Search for package
pkg search <keyword>

# Remove package
pkg uninstall <package-name>

# Clean cache
pkg clean

# Common packages
pkg install python nodejs git nginx postgresql redis sqlite
```

## 🔐 Security Best Practices

1. **SSH Security**
   ```bash
   # Use SSH keys (not passwords)
   ssh-keygen -t rsa -b 4096
   ssh-copy-id -p 8022 user@phone-ip
   
   # Disable password auth
   echo "PasswordAuthentication no" >> $PREFIX/etc/ssh/sshd_config
   ```

2. **Firewall (if rooted)**
   ```bash
   pkg install iptables
   # Allow only necessary ports
   ```

3. **VPN for Remote Access**
   ```bash
   pkg install wireguard-tools
   # Configure VPN
   ```

4. **Regular Updates**
   ```bash
   pkg update && pkg upgrade -y
   ```

## 💾 Backup & Restore

### Manual Backup
```bash
# Backup everything
tar -czf ~/backup_$(date +%Y%m%d).tar.gz \
    ~/server/data \
    ~/server/web \
    $PREFIX/var/lib/postgresql

# Backup specific directory
tar -czf ~/backup_data.tar.gz ~/server/data
```

### Restore
```bash
# Restore from backup
tar -xzf ~/backup_20260105.tar.gz -C ~/
```

### Automated Backups
```bash
# Use task scheduler
cd automation
python3 task-scheduler.py
# Edit tasks.json to configure backup schedule
```

## 🔧 Troubleshooting

### SSH Won't Connect
```bash
# On Android
pgrep sshd || sshd  # Start SSH if not running
ifconfig            # Verify IP address

# On PC
ssh -vvv -p 8022 user@phone-ip  # Verbose debugging
```

### Service Won't Start
```bash
# Check if port is in use
netstat -tuln | grep <port>

# Check logs
tail -f ~/server/logs/*.log

# Kill process on port
lsof -ti:<port> | xargs kill
```

### Out of Memory
```bash
# Check memory usage
free -h

# Kill memory-heavy processes
htop  # Then press F9 to kill

# Clear cache
sync
echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true
```

### Storage Full
```bash
# Check disk usage
df -h
du -sh ~/* | sort -h

# Clean up
pkg clean
rm -rf ~/.cache/*
rm -rf ~/server/backups/*.tar.gz  # Keep only recent
```

### Service Crashes
```bash
# Check logs
journalctl -xe  # If using systemd
tail -f ~/server/logs/*.log

# Restart service
~/server/scripts/service-manager.sh restart
```

## 📊 Monitoring & Metrics

### System Resources
```bash
# CPU usage
top -bn1 | grep "CPU:"

# Memory usage
free -h

# Disk usage
df -h

# Network stats
ifconfig
netstat -i

# Battery status
termux-battery-status

# Temperature
termux-sensor -s temperature 2>/dev/null || true
```

### Service Health
```bash
# Check running services
ps aux | grep -E "sshd|nginx|postgres|redis"

# Port usage
netstat -tuln

# Active connections
netstat -an | grep ESTABLISHED
```

## 🎮 Use Cases & Examples

### 1. Personal Cloud Storage
- Install Nextcloud or use simple file server
- Access your files from anywhere

### 2. Development Environment
- Host Git repositories (Gitea)
- Run CI/CD pipelines
- Code server for web-based development

### 3. Media Server
- Stream music/videos (Jellyfin, Plex)
- Photo gallery (PhotoPrism)

### 4. Home Automation
- IoT hub (Home Assistant)
- Smart home control

### 5. Game Servers
- Minecraft server
- Terraria server
- Other dedicated game servers

### 6. AI/ML Inference
- Host ML models
- Run AI APIs
- Voice assistant

### 7. Web Scraping & Bots
- Discord/Telegram bots
- Automated scrapers
- API integrations

### 8. Database Server
- PostgreSQL for apps
- Redis for caching
- MongoDB for NoSQL

## 🔄 Update & Maintenance

### Weekly Tasks
```bash
# Update packages
pkg update && pkg upgrade -y

# Check disk space
df -h

# Review logs
tail ~/server/logs/*.log

# Restart services if needed
~/server/scripts/service-manager.sh restart
```

### Monthly Tasks
```bash
# Full backup
tar -czf ~/monthly_backup_$(date +%Y%m).tar.gz ~/server

# Security audit
# - Review SSH logs
# - Update passwords
# - Check for suspicious activity

# Performance check
# - Monitor temperature
# - Check for throttling
# - Optimize if needed
```

## 📚 Additional Resources

### Documentation
- Termux Wiki: https://wiki.termux.com
- Nginx Docs: https://nginx.org/en/docs/
- PostgreSQL Docs: https://www.postgresql.org/docs/

### Communities
- r/termux - Termux community
- r/selfhosted - Self-hosting community
- r/homelab - Home lab enthusiasts
- Termux Discord/GitHub

### Tutorials
- Check docs/SERVICE_EXAMPLES.md for service configs
- Check SETUP_GUIDE.md for detailed setup

## 🆘 Getting Help

1. **Check logs**: Most issues show up in logs
2. **Search communities**: r/termux, r/selfhosted
3. **GitHub Issues**: Report bugs in project repo
4. **Termux Wiki**: Comprehensive documentation

## 📝 Notes

- Phone will get warm - ensure good ventilation
- Monitor battery health if kept plugged in 24/7
- Use airplane mode + WiFi to reduce power consumption
- Consider using a phone stand with fan cooling
- Regular backups are essential
- Keep Termux updated

## 🎯 Next Steps

1. ✅ Complete initial setup
2. ✅ Deploy first service
3. ⬜ Setup monitoring
4. ⬜ Configure backups
5. ⬜ Secure with SSH keys
6. ⬜ Setup remote access (VPN/DDNS)
7. ⬜ Deploy your applications
8. ⬜ Monitor and optimize

---

**Happy Self-Hosting!** 🚀📱💻
