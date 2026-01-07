# NPS Quick Usage Guide

## 🚀 Quick Start (5 Minutes)

This guide gets you up and running with NPS in the fastest way possible.

---

## Step 1: Install on Android (3 minutes)

### On your Android phone in Termux:

```bash
# Update packages
pkg update && pkg upgrade -y

# Install and clone
pkg install git -y
git clone https://github.com/MrNova420/NPS.git
cd NPS

# Run installer (does everything automatically)
bash install.sh
```

**Wait for installation to complete** - it will install Node.js, Python, SSH, and all dependencies.

---

## Step 2: Start SSH Server (30 seconds)

### Still in Termux on Android:

```bash
# Start SSH server
sshd

# Find your phone's IP address
bash get-ip.sh
```

**Alternative methods to find IP:**
```bash
# Method 1: Using ip command (works on all Android)
ip addr show wlan0 | grep "inet " | awk '{print $2}' | cut -d/ -f1

# Method 2: Using hostname (if available)
hostname -I | awk '{print $1}'

# Method 3: Check Android Settings
# Settings → Network & Internet → WiFi → (tap your network)
```

**Look for your IP address:**
- Usually starts with `192.168.` or `10.`
- Example: `192.168.1.50`
- **Write this IP down!** You'll need it in the next step

**Example output from get-ip.sh:**
```
📶 WiFi (wlan0): 192.168.1.50
                 ^^^^^^^^^^^^  <-- This is your phone's IP!

✅ Use this IP to connect from your PC:
   ssh -p 8022 u0_a257@192.168.1.50
```

---

## Step 3: Test SSH Connection (1 minute)

### Get your Termux username:

```bash
# On Android, run:
whoami
```

This will show something like `u0_a257` - **write this down too!**

### Test if SSH works:

```bash
# Still on Android, test SSH to yourself:
ssh -p 8022 localhost
# Type 'yes' when asked, then enter your password
# Type 'exit' to close the connection
```

If this works, SSH is ready! ✅

---

## Step 4: Connect from PC (Optional, 1 minute)

### On your PC:

```bash
# Clone the repository
git clone https://github.com/MrNova420/NPS.git
cd NPS

# Run installer
bash install.sh
```

### Configure the connection:

```bash
# Edit the .env file
nano .env
```

**Change these lines:**
```bash
ANDROID_HOST=192.168.1.50    # Your phone's IP from Step 2
ANDROID_PORT=8022             # Keep this as 8022
ANDROID_USER=u0_a257          # Your username from Step 3
```

Press `Ctrl+O` to save, then `Ctrl+X` to exit.

### Test connection from PC:

```bash
# Test SSH connection (replace with YOUR values)
ssh -p 8022 u0_a257@192.168.1.50

# Type 'yes' when asked
# Enter your password
# You should now be connected to your phone!
# Type 'exit' to disconnect
```

If this works, you're connected! ✅

---

## Step 5: Start the Dashboard (PC only)

### On your PC:

```bash
# Make sure you're in the NPS directory
cd NPS

# Start the dashboard
cd dashboard
npm start
```

**Open your browser:**
- Go to: `http://localhost:3000`
- You should see the NPS Dashboard!

---

## 🎉 You're Done!

You can now:
- ✅ Manage your Android phone from the dashboard
- ✅ Deploy servers with one click
- ✅ Monitor system resources
- ✅ Use SSH to access your phone

---

## 🆘 Quick Troubleshooting

### Problem: Can't find my IP address

**Solution:**
```bash
# On Android - Use our helper script:
bash get-ip.sh

# Or manually:
# Method 1: ip command (most reliable)
ip addr show wlan0 | grep "inet " | awk '{print $2}' | cut -d/ -f1

# Method 2: hostname command
hostname -I | awk '{print $1}'

# Method 3: Check in Android Settings
# Settings → WiFi → Tap your network → IP address shown there
```

### Problem: SSH connection refused

**Solution:**
```bash
# On Android, check if SSH is running:
pgrep sshd

# If nothing shows up, start it:
sshd

# Verify it's running:
pgrep sshd
# Should show a number (process ID)
```

### Problem: Wrong password

**Solution:**
```bash
# On Android, reset your password:
passwd

# Enter new password twice
# Try connecting again
```

### Problem: Dashboard won't start

**Solution:**
```bash
# Make sure dependencies are installed:
cd dashboard
npm install

# Check if port 3000 is already in use:
lsof -ti:3000

# If a number shows up, kill that process:
kill $(lsof -ti:3000)

# Try starting again:
npm start
```

### Problem: Can't connect from PC to Android

**Checklist:**
1. ✅ SSH server running on Android: `pgrep sshd`
2. ✅ Both devices on same WiFi network
3. ✅ Correct IP in .env file
4. ✅ Correct username in .env file
5. ✅ Test manually: `ssh -p 8022 username@ip-address`

---

## 📋 Quick Commands Reference

### On Android:

```bash
# Start SSH
sshd

# Find IP (use helper script)
bash get-ip.sh

# Or manually:
ip addr show wlan0 | grep "inet " | awk '{print $2}' | cut -d/ -f1

# Get username
whoami

# Start services
~/server/scripts/service-manager.sh start

# Check status
~/server/scripts/service-manager.sh status

# View system info
~/server/scripts/system-info.sh
```

### On PC:

```bash
# Connect to Android
ssh -p 8022 username@phone-ip

# Start dashboard
cd dashboard && npm start

# Use CLI
cd cli && node manager-cli.js
```

---

## 🔄 What's Next?

Now that you're set up, check out:
- **USAGE_GUIDE.md** - In-depth guide with all features
- **START_HERE.md** - Overview of available server templates
- **QUICKSTART.md** - Deploy your first server

---

## 💡 Pro Tips

1. **Keep SSH running:** Use `tmux` or `screen` to keep SSH alive when you close Termux
2. **Static IP:** Set a static IP on your phone in WiFi settings so it doesn't change
3. **Wake lock:** Run `termux-wake-lock` to prevent Android from sleeping
4. **Port forwarding:** If you want external access, forward port 8022 in your router

---

**Need more help?** See USAGE_GUIDE.md for detailed explanations!
