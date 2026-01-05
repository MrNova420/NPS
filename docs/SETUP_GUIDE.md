# Complete Setup Guide

## Phase 1: Android Device Setup

### 1.1 Install Termux
1. **Download Termux from F-Droid** (NOT from Play Store - it's outdated)
   - Visit: https://f-droid.org/en/packages/com.termux/
   - Or direct APK: https://github.com/termux/termux-app/releases

2. **Install Termux:API** (optional but recommended)
   - Provides access to Android hardware features
   - Download from F-Droid

### 1.2 Initial Termux Configuration
```bash
# Update packages
pkg update && pkg upgrade

# Install setup script dependencies
pkg install git curl wget

# Clone this repo (or copy files manually)
git clone <your-repo-url> ~/android-server-control
cd ~/android-server-control

# Run setup script
bash setup/android/termux-setup.sh
```

### 1.3 Configure Network
```bash
# Find your IP address
ifconfig

# For static IP (recommended):
# Go to Android Settings > WiFi > Your Network > Advanced > IP Settings > Static
# Set a static IP address (e.g., 192.168.1.100)
```

### 1.4 Keep Termux Running
1. **Acquire Wakelock**:
   ```bash
   termux-wake-lock
   ```

2. **Disable Battery Optimization**:
   - Settings > Apps > Termux > Battery > Unrestricted

3. **Keep Screen On** (optional):
   - Settings > Developer Options > Stay Awake (when charging)

## Phase 2: PC Setup

### 2.1 Prerequisites
```bash
# Install Python 3
python3 --version  # Should be 3.8+

# Install Node.js (for web control panel)
node --version  # Should be 14+
npm --version

# Make sure SSH client is available
ssh -V
```

### 2.2 Setup PC Client
```bash
cd control-panel
npm init -y
npm install express

# Make Python client executable
chmod +x ../setup/pc/pc-client.py
```

### 2.3 Configure SSH Connection
```bash
# Test connection
ssh -p 8022 <username>@<phone-ip>

# For easier access, add to ~/.ssh/config:
cat >> ~/.ssh/config << EOF
Host android-server
    HostName <phone-ip>
    Port 8022
    User <username>
EOF

# Now you can connect with:
ssh android-server
```

### 2.4 Setup SSH Key Authentication (Recommended)
```bash
# Generate key on PC (if you don't have one)
ssh-keygen -t rsa -b 4096

# Copy key to Android
ssh-copy-id -p 8022 <username>@<phone-ip>
```

## Phase 3: Deploy Services

### 3.1 Start Basic Services
On Android:
```bash
# Start all services
~/server/scripts/service-manager.sh start

# Check status
~/server/scripts/service-manager.sh status

# View system info
~/server/scripts/system-info.sh
```

### 3.2 Setup Web Server (Nginx)
```bash
# Copy config
cp services/web/nginx-android.conf $PREFIX/etc/nginx/nginx.conf

# Create web directory
mkdir -p ~/server/web
echo "<h1>Android Server is Running!</h1>" > ~/server/web/index.html

# Start Nginx
nginx

# Test: Open http://<phone-ip>:8080 in browser
```

### 3.3 Setup Database (PostgreSQL)
```bash
# Run setup script
bash services/database/setup-postgres.sh

# Start PostgreSQL
pg_ctl -D $PREFIX/var/lib/postgresql start

# Create a database
createdb testdb

# Connect
psql testdb
```

### 3.4 Launch Control Panel
On PC:
```bash
# Set environment variables
export ANDROID_HOST=<phone-ip>
export ANDROID_PORT=8022
export ANDROID_USER=<username>

# Start control panel
cd control-panel
node server.js

# Open in browser: http://localhost:3000
```

## Phase 4: Advanced Features

### 4.1 Docker on Android (Requires Root)
```bash
# Install proot-distro for containerization
pkg install proot-distro

# Install Debian
proot-distro install debian

# Login to Debian
proot-distro login debian

# Inside Debian, install Docker equivalent or use native containers
```

### 4.2 Task Automation
```bash
# Install Python dependencies
pip install schedule

# Setup task scheduler
cd automation
python3 task-scheduler.py

# Edit tasks.json to customize
```

### 4.3 Monitoring
```bash
# Run monitoring dashboard
~/android-server-control/monitoring/monitor.sh

# Or use PC client
./setup/pc/pc-client.py <phone-ip> monitor
```

### 4.4 File Sharing
```bash
# Simple HTTP file server
cd ~/storage/shared
python -m http.server 8000

# Access from PC: http://<phone-ip>:8000

# Or use Syncthing
pkg install syncthing
syncthing
```

## Phase 5: Production Hardening

### 5.1 Security
```bash
# Disable password auth (use keys only)
echo "PasswordAuthentication no" >> $PREFIX/etc/ssh/sshd_config

# Setup firewall (if root)
pkg install iptables
iptables -A INPUT -p tcp --dport 8022 -j ACCEPT
iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
iptables -P INPUT DROP

# Use Wireguard VPN for remote access
pkg install wireguard-tools
```

### 5.2 Backup Strategy
```bash
# Create backup script
cat > ~/server/scripts/backup.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
BACKUP_DIR="$HOME/server/backups"
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf "$BACKUP_DIR/backup_$DATE.tar.gz" \
    ~/server/data \
    ~/server/web \
    $PREFIX/var/lib/postgresql
echo "Backup created: backup_$DATE.tar.gz"
EOF

chmod +x ~/server/scripts/backup.sh

# Schedule daily backups (add to crontab)
pkg install cronie
crontab -e
# Add: 0 2 * * * ~/server/scripts/backup.sh
```

### 5.3 Monitoring & Alerts
```bash
# Install monitoring tools
pkg install htop iftop nethogs

# Setup alert script
cat > ~/server/scripts/alert.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
# Check disk space
USAGE=$(df $HOME | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $USAGE -gt 90 ]; then
    termux-notification --title "Disk Alert" --content "Disk usage at ${USAGE}%"
fi
EOF

chmod +x ~/server/scripts/alert.sh
```

## Troubleshooting

### SSH Connection Issues
```bash
# Check SSH is running
pgrep sshd

# Restart SSH
pkill sshd
sshd

# Check IP address
ifconfig
```

### Service Won't Start
```bash
# Check logs
tail ~/server/logs/*.log

# Check port availability
netstat -tuln | grep <port>
```

### Performance Issues
```bash
# Check resource usage
htop

# Reduce services if needed
# Optimize app settings
# Clear cache: rm -rf ~/.cache/*
```

## Next Steps

1. **Deploy Your Applications**: Copy your web apps, APIs, or databases
2. **Setup Domain**: Use DDNS service like No-IP or DuckDNS
3. **SSL Certificates**: Use Let's Encrypt with Caddy server
4. **Monitoring**: Setup Grafana + Prometheus
5. **Scale**: Add more devices or upgrade to better hardware

## Resources

- Termux Wiki: https://wiki.termux.com
- Android Developer Docs: https://developer.android.com
- Self-Hosting Reddit: r/selfhosted
- Termux Reddit: r/termux
