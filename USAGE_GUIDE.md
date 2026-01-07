# NPS In-Depth Usage Guide

Complete guide to using NPS (Nova's Private Server) - from setup to advanced features.

---

## Table of Contents

1. [Initial Setup](#initial-setup)
2. [Network Configuration](#network-configuration)
3. [SSH Setup and Authentication](#ssh-setup-and-authentication)
4. [Dashboard Usage](#dashboard-usage)
5. [CLI Usage](#cli-usage)
6. [Server Management](#server-management)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)
8. [Advanced Configuration](#advanced-configuration)
9. [Troubleshooting](#troubleshooting)

---

## 1. Initial Setup

### 1.1 Installing on Android (Termux)

#### Prerequisites:
- Termux app from F-Droid (NOT Google Play Store)
- Download: https://f-droid.org/packages/com.termux/
- Android 7.0 or higher
- 2GB+ RAM recommended
- Active internet connection

#### Step-by-step Installation:

```bash
# Step 1: Update Termux packages
pkg update && pkg upgrade -y

# Step 2: Install Git
pkg install git -y

# Step 3: Clone NPS repository
git clone https://github.com/MrNova420/NPS.git
cd NPS

# Step 4: Run the installer
bash install.sh
```

**What the installer does:**
- Installs Node.js (JavaScript runtime)
- Installs Python (for automation and AI features)
- Installs OpenSSH (for remote access)
- Installs server packages (nginx, postgresql, redis)
- Sets up directory structure
- Configures SSH with password authentication
- Installs all required dependencies

#### Post-Installation:

```bash
# Verify installation
bash verify-install.sh

# Start storage access (optional, for accessing phone files)
termux-setup-storage
```

### 1.2 Installing on PC

#### Prerequisites:
- Node.js 14 or higher (download from https://nodejs.org)
- Git (usually pre-installed)
- SSH client (usually pre-installed)

#### Installation:

```bash
# Step 1: Clone repository
git clone https://github.com/MrNova420/NPS.git
cd NPS

# Step 2: Run installer
bash install.sh

# Step 3: Install dependencies (if not done automatically)
cd dashboard && npm install
cd ../cli && npm install
```

---

## 2. Network Configuration

### 2.1 Finding Your Android Phone's IP Address

#### Method 1: Using Helper Script (Easiest)

```bash
# On Android in Termux:
bash ~/NPS/get-ip.sh
```

This will show your IP address with clear instructions.

#### Method 2: Using ip command (Most Reliable)

```bash
# On Android:
ip addr show wlan0 | grep "inet " | awk '{print $2}' | cut -d/ -f1
```

**Example output:** `192.168.1.50`

**To see all network interfaces:**
```bash
ip addr show | grep "inet " | grep -v "127.0.0.1"
```

#### Method 3: Using hostname command

```bash
# On Android:
hostname -I | awk '{print $1}'
```

**Note:** This may not work on all Android devices.

#### Method 4: Using Android Settings

1. Open **Settings** on your phone
2. Go to **Network & Internet** → **WiFi**
3. Tap on the connected WiFi network
4. Look for **IP address** (e.g., 192.168.1.50)

#### Method 5: Using termux-wifi-connectioninfo

```bash
# Install termux-api first (if not already installed)
pkg install termux-api

# Get WiFi info
termux-wifi-connectioninfo | grep ip
```

**What to look for:**
- IP addresses usually start with `192.168.` or `10.`
- Example: `192.168.1.50`, `10.0.0.25`
- This is your **local network** IP address

### 2.2 Configuring the .env File (PC)

The `.env` file tells your PC how to connect to your Android device.

#### Location:
- PC: `NPS/.env` (created by installer)
- Dashboard: `NPS/dashboard/.env` (optional, for dashboard-specific settings)

#### Edit the file:

```bash
# On PC:
cd NPS
nano .env
```

#### Required Settings:

```bash
# Android device connection
ANDROID_HOST=192.168.1.50      # Your phone's IP from section 2.1
ANDROID_PORT=8022               # SSH port (default 8022)
ANDROID_USER=u0_a257           # Your Termux username (see section 2.3)

# Dashboard settings
PORT=3000                       # Dashboard web interface port
NODE_ENV=development           # Use 'production' for production

# Optional: API security
# API_KEY=your-secret-key-here
# ENABLE_AUTH=true
```

#### Save and exit:
- Press `Ctrl+O` to save
- Press `Enter` to confirm
- Press `Ctrl+X` to exit nano

### 2.3 Finding Your Termux Username

```bash
# On Android in Termux:
whoami
```

**Example output:** `u0_a257`

This is your username. Each Android user ID has a different number.

### 2.4 Static IP Configuration (Recommended)

To prevent your phone's IP from changing:

1. Open your phone's **Settings**
2. Go to **Network & Internet** → **WiFi**
3. Tap the gear icon next to your network
4. Tap **Advanced** → **IP settings**
5. Change from **DHCP** to **Static**
6. Set:
   - **IP address**: 192.168.1.50 (choose one not in use)
   - **Gateway**: 192.168.1.1 (your router's IP)
   - **DNS 1**: 8.8.8.8 (Google DNS)
   - **DNS 2**: 8.8.4.4
7. Save

---

## 3. SSH Setup and Authentication

### 3.1 Starting SSH Server on Android

```bash
# On Android:
sshd
```

**Verify it's running:**
```bash
pgrep sshd
# Should output a number (process ID)
```

**Auto-start SSH on boot (optional):**
```bash
# Add to ~/.bashrc
echo 'pgrep sshd > /dev/null || sshd' >> ~/.bashrc
```

### 3.2 Setting SSH Password

```bash
# On Android:
passwd
```

Follow prompts to set a secure password.

**Password Requirements:**
- At least 8 characters
- Mix of letters and numbers recommended
- Special characters recommended for security

### 3.3 SSH Key Authentication (Recommended)

SSH keys are more secure than passwords.

#### Generate SSH key on PC:

```bash
# On PC:
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa_android
# Press Enter for no passphrase, or enter one for extra security
```

#### Copy key to Android:

```bash
# On PC (replace with YOUR username and IP):
ssh-copy-id -p 8022 -i ~/.ssh/id_rsa_android.pub u0_a257@192.168.1.50
```

#### Configure SSH to use this key:

```bash
# On PC, create/edit ~/.ssh/config
nano ~/.ssh/config
```

Add:
```
Host android-phone
    HostName 192.168.1.50
    Port 8022
    User u0_a257
    IdentityFile ~/.ssh/id_rsa_android
```

Now you can connect with just:
```bash
ssh android-phone
```

### 3.4 Testing SSH Connection

#### From Android to itself (local test):

```bash
# On Android:
ssh -p 8022 localhost
# Type 'yes' when asked about fingerprint
# Enter password
# You should see a new Termux prompt
# Type 'exit' to disconnect
```

#### From PC to Android:

```bash
# On PC (replace with YOUR username and IP):
ssh -p 8022 u0_a257@192.168.1.50

# Or if you set up SSH config:
ssh android-phone
```

**Success indicators:**
- You see a welcome message
- Prompt changes to show Android username
- You can run commands like `ls`, `whoami`

---

## 4. Dashboard Usage

### 4.1 Starting the Dashboard

#### On PC:

```bash
# Method 1: Using the launcher script
cd NPS
./start-dashboard.sh

# Method 2: Manual start
cd NPS/dashboard
npm start
```

#### On Android (to run dashboard on phone):

```bash
cd NPS/dashboard
node backend/server.js
```

### 4.2 Accessing the Dashboard

**From PC:**
- Open browser to: `http://localhost:3000`

**From other devices on same network:**
- Find PC's IP: 
  - Linux/Mac: `ip addr show | grep "inet " | grep -v "127.0.0.1"`
  - Windows: `ipconfig`
- Open browser to: `http://<pc-ip>:3000`

**From Android (if running dashboard on phone):**
- Find phone's IP: `bash ~/NPS/get-ip.sh` or `ip addr show wlan0`
- Open browser to: `http://<phone-ip>:3000`

### 4.3 Dashboard Features

#### 4.3.1 System Overview

**Header displays:**
- 📊 CPU usage (real-time)
- 💾 Memory usage
- 💿 Storage usage
- 📡 Network status
- 🌡️ Temperature (if available)

#### 4.3.2 Server Templates

**Available templates:**

**Basic Servers:**
1. **Static Website** - Host HTML/CSS/JS files
2. **Node.js API** - Express REST API server
3. **Python Flask** - Python web application
4. **PostgreSQL** - SQL database
5. **Redis** - In-memory cache
6. **Minecraft** - Minecraft Java Edition server
7. **Discord Bot** - Discord.js bot
8. **File Storage** - Personal cloud storage
9. **AI Inference** - Machine learning model server

**Advanced Servers:**
10. **Docker Manager** - Container orchestration
11. **MERN Stack** - MongoDB, Express, React, Node.js
12. **PERN Stack** - PostgreSQL, Express, React, Node.js
13. **Load Balancer** - Nginx load balancing
14. **CI/CD Pipeline** - Automated build and deploy
15. **Monitoring Stack** - Grafana + Prometheus
16. **Database Cluster** - Multi-node database
17. **DNS Server** - Custom DNS with zone management
18. **SSL Reverse Proxy** - HTTPS proxy with Let's Encrypt

#### 4.3.3 Creating a Server

**Step-by-step:**

1. **Click a template card** (e.g., "Static Website")
2. **Fill in the form:**
   - **Name**: Unique identifier (e.g., `my-website`)
   - **Port**: Port number (e.g., `8080`)
   - **Configuration**: Template-specific options
3. **Click "Create Server"**
4. **Wait for deployment** (usually 5-30 seconds)
5. **Server appears in "Active Servers" list**

#### 4.3.4 Managing Servers

**Actions available:**

- **▶️ Start** - Start a stopped server
- **⏸️ Stop** - Stop a running server
- **🔄 Restart** - Restart the server
- **📋 Logs** - View server logs
- **⚙️ Configure** - Edit server settings
- **📊 Metrics** - View performance metrics
- **🗑️ Delete** - Remove server

#### 4.3.5 Real-time Monitoring

**Live updates via WebSocket:**
- Server status changes
- Resource usage
- Log streaming
- Temperature alerts
- Error notifications

---

## 5. CLI Usage

### 5.1 Starting the CLI

```bash
cd NPS/cli
node manager-cli.js
```

### 5.2 CLI Commands

#### Interactive Menu:

```
=== NPS Manager CLI ===
1. List Servers
2. Create Server
3. Start Server
4. Stop Server
5. View Logs
6. System Status
7. Exit

Choose option: _
```

#### Direct Commands:

```bash
# List all servers
node manager-cli.js list

# Create a server
node manager-cli.js create --name my-app --type web-static

# Start a server
node manager-cli.js start my-app

# Stop a server
node manager-cli.js stop my-app

# View logs
node manager-cli.js logs my-app

# System status
node manager-cli.js status
```

---

## 6. Server Management

### 6.1 Service Manager (Android)

```bash
# Start all services
~/server/scripts/service-manager.sh start

# Stop all services
~/server/scripts/service-manager.sh stop

# Check status
~/server/scripts/service-manager.sh status
```

### 6.2 Individual Services

#### SSH Server:
```bash
# Start
sshd

# Stop
pkill sshd

# Check
pgrep sshd
```

#### Redis:
```bash
# Start
redis-server --daemonize yes

# Stop
redis-cli shutdown

# Check
pgrep redis
```

#### PostgreSQL:
```bash
# Start
pg_ctl -D $PREFIX/var/lib/postgresql start

# Stop
pg_ctl -D $PREFIX/var/lib/postgresql stop

# Check
pg_ctl -D $PREFIX/var/lib/postgresql status
```

#### Nginx:
```bash
# Start
nginx

# Stop
nginx -s stop

# Reload config
nginx -s reload

# Check
pgrep nginx
```

---

## 7. Monitoring and Maintenance

### 7.1 System Information

```bash
# View full system info
~/server/scripts/system-info.sh
```

**Shows:**
- Device info and battery status
- CPU usage
- Memory usage
- Storage usage
- Network information
- Active services

### 7.2 Resource Monitoring

```bash
# Real-time monitoring
htop

# Memory usage
free -h

# Disk usage
df -h

# Process list
ps aux | grep node
```

### 7.3 Log Management

#### Server Logs:
```bash
# View all logs
ls ~/server/logs/

# Tail specific log
tail -f ~/server/logs/server.log

# Last 100 lines
tail -n 100 ~/server/logs/error.log
```

#### System Logs:
```bash
# Termux logs
logcat | grep termux
```

### 7.4 Backups

#### Manual Backup:
```bash
# Backup all server data
tar -czf ~/server/backups/backup-$(date +%Y%m%d).tar.gz \
    ~/server/data \
    ~/server/instances \
    ~/server/config
```

#### Restore Backup:
```bash
# Extract backup
tar -xzf ~/server/backups/backup-20260106.tar.gz -C ~/
```

### 7.5 Updates

```bash
# Update NPS
cd ~/NPS
git pull origin main

# Update Termux packages
pkg update && pkg upgrade

# Update Node.js packages
cd ~/NPS/dashboard && npm update
cd ~/NPS/cli && npm update

# Update Python packages
pip install --upgrade -r ~/NPS/requirements.txt
```

---

## 8. Advanced Configuration

### 8.1 Environment Variables

**Dashboard .env:**
```bash
# Android connection
ANDROID_HOST=192.168.1.50
ANDROID_PORT=8022
ANDROID_USER=u0_a257

# Server settings
PORT=3000
NODE_ENV=production
HOST=0.0.0.0

# Security
API_KEY=your-secret-key-here
ENABLE_AUTH=true
ENABLE_HTTPS=false

# Performance
MAX_SERVERS=10
MAX_MEMORY_PER_SERVER=512
WORKER_PROCESSES=2

# Logging
LOG_LEVEL=info
LOG_FILE=/path/to/logs/dashboard.log
```

### 8.2 Performance Profile

**Edit performance config:**
```bash
nano ~/server/config/profile.json
```

**Example configuration:**
```json
{
  "device": {
    "tier": "medium",
    "cpu_cores": 4,
    "ram_mb": 4096,
    "storage_gb": 64
  },
  "limits": {
    "max_servers": 8,
    "max_memory_per_server_mb": 512,
    "max_cpu_per_server_percent": 25,
    "worker_processes": 2
  },
  "optimization": {
    "swap_enabled": false,
    "cache_size_mb": 512,
    "tcp_window_kb": 1024,
    "max_connections": 40960
  },
  "thermal": {
    "max_temp_c": 75,
    "throttle_temp_c": 70,
    "critical_temp_c": 80
  }
}
```

### 8.3 Port Forwarding (External Access)

To access your server from outside your home network:

1. **Find your router's IP:**
   - Usually 192.168.1.1 or 192.168.0.1
   - Open in browser

2. **Login to router admin panel**

3. **Find Port Forwarding section**
   - May be under "Advanced" or "NAT"

4. **Add port forwarding rules:**
   - External Port: 8022 → Internal IP: 192.168.1.50 → Internal Port: 8022 (SSH)
   - External Port: 8080 → Internal IP: 192.168.1.50 → Internal Port: 8080 (Web)

5. **Find your public IP:**
   ```bash
   curl ifconfig.me
   ```

6. **Connect from anywhere:**
   ```bash
   ssh -p 8022 u0_a257@<your-public-ip>
   ```

**⚠️ Security Warning:** Only forward ports you need. Use strong passwords or SSH keys.

### 8.4 Dynamic DNS (DDNS)

If your public IP changes, use DDNS:

**Using DuckDNS:**
```bash
# On Android:
pkg install curl

# Create update script
cat > ~/update-dns.sh << 'EOF'
#!/bin/bash
curl "https://www.duckdns.org/update?domains=yoursubdomain&token=your-token"
EOF

chmod +x ~/update-dns.sh

# Run every 5 minutes
crontab -e
# Add: */5 * * * * ~/update-dns.sh
```

---

## 9. Troubleshooting

### 9.1 SSH Issues

#### Problem: "Connection refused"

**Check:**
```bash
# Is SSH running?
pgrep sshd || sshd

# Check SSH config
cat $PREFIX/etc/ssh/sshd_config | grep Port
# Should show: Port 8022

# Check if port is listening
netstat -tuln | grep 8022
```

**Solution:**
```bash
# Restart SSH
pkill sshd
sshd
```

#### Problem: "Permission denied"

**Check:**
```bash
# Verify password authentication is enabled
grep PasswordAuthentication $PREFIX/etc/ssh/sshd_config
# Should show: PasswordAuthentication yes

# Reset password
passwd
```

#### Problem: "No route to host"

**Check:**
1. Both devices on same WiFi network
2. Correct IP address: Use `bash ~/NPS/get-ip.sh` or `ip addr show wlan0` on Android
3. Firewall not blocking: Disable temporarily to test
4. Router allows device-to-device communication

### 9.2 Dashboard Issues

#### Problem: "EADDRINUSE: Port 3000 already in use"

**Solution:**
```bash
# Find process using port 3000
lsof -ti:3000

# Kill the process
kill $(lsof -ti:3000)

# Or change port in .env
echo "PORT=3001" >> .env
```

#### Problem: "Cannot connect to Android device"

**Verify:**
```bash
# 1. SSH works manually
ssh -p 8022 u0_a257@192.168.1.50

# 2. .env is correct
cat .env | grep ANDROID

# 3. Android is reachable
ping -c 3 192.168.1.50
```

#### Problem: Dashboard shows old data

**Solution:**
```bash
# Clear state
rm -f ~/server/state/*

# Restart dashboard
pkill node
cd dashboard && npm start
```

### 9.3 Performance Issues

#### Problem: High CPU usage

**Check:**
```bash
# Find CPU-heavy processes
top -n 1 -b | head -20

# Limit server resources
# Edit ~/server/config/profile.json
# Reduce max_cpu_per_server_percent
```

#### Problem: Out of memory

**Check:**
```bash
# Check memory usage
free -h

# Check swap
swapon -s
```

**Solutions:**
```bash
# Stop unused servers via dashboard or:
~/server/scripts/service-manager.sh stop

# Reduce servers running simultaneously
# Edit profile.json, reduce max_servers

# Enable swap (if needed)
pkg install tsu
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

#### Problem: Storage full

**Check:**
```bash
df -h
du -sh ~/server/*
```

**Solutions:**
```bash
# Clean Termux cache
pkg clean
rm -rf ~/.cache/*

# Clean old logs
rm ~/server/logs/*.log.old
find ~/server/logs -mtime +7 -delete

# Clean old backups
rm ~/server/backups/*.tar.gz.old
```

### 9.4 Network Issues

#### Problem: IP address keeps changing

**Solution:** Set static IP (see section 2.4)

#### Problem: Connection drops

**Solution:**
```bash
# Keep Termux awake
termux-wake-lock

# Use tmux to keep sessions alive
pkg install tmux
tmux new -s nps
# Run your commands
# Detach with Ctrl+B, then D
# Reattach with: tmux attach -t nps
```

### 9.5 Getting More Help

```bash
# Run verification
cd ~/NPS
bash verify-install.sh

# Run tests
bash test-install.sh

# Check logs
tail -f ~/server/logs/server.log
```

**Community Support:**
- GitHub Issues: https://github.com/MrNova420/NPS/issues
- r/termux subreddit
- r/selfhosted subreddit

---

## 📚 Additional Resources

- **QUICK_USAGE.md** - Quick reference guide
- **GETTING_STARTED.md** - Installation guide
- **START_HERE.md** - Feature overview
- **QUICKSTART.md** - First server deployment
- **ADVANCED_README.md** - Advanced features
- **PRODUCTION_README.md** - Production deployment

---

**🎉 You now know everything about using NPS!**

For specific use cases or advanced scenarios, check the other documentation files or open an issue on GitHub.
