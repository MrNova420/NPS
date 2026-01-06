# Getting Started with NPS - Complete Guide

This guide will help you get NPS (Nova's Private Server) up and running on your Android device and optionally control it from your PC.

## What You Need

### For Android (Required):
- Android 7.0 or higher
- 2GB+ RAM (4GB+ recommended)
- 2GB+ free storage
- **Termux from F-Droid** (NOT from Play Store!)
  - Download: https://f-droid.org/packages/com.termux/
- Stable WiFi connection

### For PC (Optional - for remote control):
- Linux, macOS, or Windows with WSL
- Node.js 14 or higher
- SSH client (usually pre-installed)

---

## Installation Methods

### 🚀 Method 1: Automated Installation (RECOMMENDED)

This is the easiest way to get started. The installer will detect your platform and set everything up automatically.

#### On Android (Termux):

```bash
# 1. Open Termux and update packages
pkg update && pkg upgrade

# 2. Install git
pkg install git

# 3. Clone the repository
git clone https://github.com/MrNova420/NPS.git
cd NPS

# 4. Run the installer
bash install.sh
```

The installer will:
- ✅ Install all required packages (Node.js, Python, SSH, etc.)
- ✅ Set up directory structure
- ✅ Configure SSH server
- ✅ Install Python and Node.js dependencies
- ✅ Create service management scripts

#### On PC (for remote control):

```bash
# 1. Clone the repository
git clone https://github.com/MrNova420/NPS.git
cd NPS

# 2. Run the installer
bash install.sh
```

The installer will:
- ✅ Install dashboard dependencies
- ✅ Install CLI dependencies
- ✅ Create configuration template
- ✅ Set up launcher scripts

---

### 📱 Method 2: Manual Android Setup

If you prefer to do it step by step:

```bash
# 1. Install Termux from F-Droid
# Download from: https://f-droid.org/packages/com.termux/

# 2. Update Termux packages
pkg update && pkg upgrade -y

# 3. Install required packages
pkg install -y git nodejs python openssh

# 4. Clone the repository
git clone https://github.com/MrNova420/NPS.git
cd NPS

# 5. Run the setup script
bash setup.sh

# 6. Install Python dependencies
pip install -r requirements.txt

# 7. Start SSH server
sshd

# 8. Find your IP address
ifconfig
# Look for wlan0 or similar, note the inet address (e.g., 192.168.1.50)

# 9. Start services
~/server/scripts/service-manager.sh start

# 10. Check status
~/server/scripts/service-manager.sh status
```

---

### 💻 Method 3: Manual PC Setup

To control your Android device from PC:

```bash
# 1. Clone the repository
git clone https://github.com/MrNova420/NPS.git
cd NPS

# 2. Run the setup script
bash setup.sh

# 3. Install dependencies manually
cd dashboard
npm install
cd ../cli
npm install
cd ..

# 4. Install Python dependencies (optional)
pip install -r requirements.txt

# 5. Configure connection to Android device
# Edit the .env file created by setup.sh
nano .env

# Change these values:
# ANDROID_HOST=192.168.1.50  # Your Android device IP
# ANDROID_PORT=8022
# ANDROID_USER=u0_a  # Run 'whoami' on Android to get this

# 6. Test SSH connection to Android
ssh -p 8022 <username>@<android-ip>

# 7. Start the dashboard
./start-dashboard.sh
# Or: cd dashboard && npm start
```

---

## Verification

After installation, verify everything is set up correctly:

```bash
bash verify-install.sh
```

This will check:
- ✅ All required commands are available
- ✅ All project files are present
- ✅ Dependencies are installed
- ✅ Project structure is correct

---

## Common Issues and Solutions

### Issue 1: "bash: install.sh: No such file or directory"

**Solution:**
```bash
# Make sure you're in the NPS directory
cd NPS
ls -la install.sh  # Should show the file

# If it doesn't exist, pull latest changes
git pull origin main
```

### Issue 2: "npm -y: command not found"

This was a bug in older versions. **Solution:**
```bash
# Pull the latest version
git pull origin main

# Run installer again
bash install.sh
```

### Issue 3: Python packages won't install

**Solution:**
```bash
# Update pip first
pip install --upgrade pip

# Then install requirements
pip install -r requirements.txt

# If specific packages fail (e.g., onnxruntime), install others:
pip install flask numpy requests schedule
```

### Issue 4: Can't connect from PC to Android

**Checklist:**
1. ✅ SSH server is running on Android: Run `pgrep sshd` (should show a number)
   - If not running: `sshd`
2. ✅ You have the correct IP: Run `ifconfig` on Android
3. ✅ Port 8022 is not blocked by firewall
4. ✅ Both devices are on same WiFi network
5. ✅ Test manually: `ssh -p 8022 <username>@<android-ip>`

### Issue 5: Dashboard won't start - "EADDRINUSE"

**Solution:**
```bash
# Another process is using port 3000
# Find and kill it:
kill $(lsof -ti:3000)

# Or change the port in .env:
echo "PORT=3001" >> .env
```

### Issue 6: "Out of space" during installation

**Solution:**
```bash
# Clean Termux cache
pkg clean
rm -rf ~/.cache/*

# Check available space
df -h

# If still low, uninstall unused packages
pkg list-installed | less
# Then: pkg uninstall <package-name>
```

---

## What to Do After Installation

### On Android:

1. **Start services:**
   ```bash
   ~/server/scripts/service-manager.sh start
   ```

2. **Check system info:**
   ```bash
   ~/server/scripts/system-info.sh
   ```

3. **Monitor resources:**
   ```bash
   htop
   ```

4. **Keep Termux running:**
   - Acquire wakelock: `termux-wake-lock`
   - Or use `tmux` to keep sessions alive

### On PC:

1. **Start the dashboard:**
   ```bash
   cd dashboard
   npm start
   ```
   Access at: http://localhost:3000

2. **Use the CLI:**
   ```bash
   cd cli
   node manager-cli.js
   ```

3. **Connect to Android:**
   ```bash
   ssh -p 8022 <username>@<android-ip>
   ```

---

## Testing Your Installation

### Quick Test on Android:

```bash
# 1. Check if SSH is running
pgrep sshd && echo "SSH OK" || echo "SSH not running"

# 2. Check if services are running
~/server/scripts/service-manager.sh status

# 3. Test Python
python -c "import flask; print('Python OK')"

# 4. Test Node.js
node -e "console.log('Node.js OK')"
```

### Quick Test from PC:

```bash
# 1. Test SSH connection
ssh -p 8022 <username>@<android-ip> "echo 'SSH OK'"

# 2. Test dashboard
cd dashboard
node backend/server.js &
# Wait a few seconds
curl http://localhost:3000/api/health
# Should return {"status":"ok"}

# 3. Kill test server
kill %1
```

---

## Next Steps

Once everything is installed and verified:

1. 📖 Read [START_HERE.md](START_HERE.md) for feature overview
2. 🚀 Try [QUICKSTART.md](QUICKSTART.md) for deploying your first server
3. 📚 Check [ADVANCED_README.md](ADVANCED_README.md) for advanced features
4. 🛠️ Configure [PRODUCTION_README.md](PRODUCTION_README.md) for production use

---

## Getting Help

- 📋 Run `verify-install.sh` to diagnose issues
- 📋 Run `test-install.sh` to run integration tests
- 📖 Check the [Troubleshooting](#common-issues-and-solutions) section
- 🐛 Report bugs: https://github.com/MrNova420/NPS/issues
- 💬 Community: r/termux, r/selfhosted

---

## Summary of Commands

### Installation:
```bash
# Quick start
git clone https://github.com/MrNova420/NPS.git
cd NPS
bash install.sh
```

### Verification:
```bash
bash verify-install.sh
bash test-install.sh
```

### Starting Services (Android):
```bash
sshd  # Start SSH
~/server/scripts/service-manager.sh start
```

### Starting Dashboard (PC):
```bash
cd dashboard
npm start
```

---

**🎉 You're all set! Welcome to NPS!**
