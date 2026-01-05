# 🚀 START HERE - Android Server Manager v2.0

## What You Have Now

**The most advanced Android server management platform** - Transform your Android phone into a professional server with:

✅ **Beautiful Web Dashboard** - Manage everything visually  
✅ **9 One-Click Server Templates** - Deploy in seconds  
✅ **Real-Time Monitoring** - Live resource tracking  
✅ **Smart Orchestration** - Automatic resource management  
✅ **Professional CLI** - For power users  
✅ **Full REST API** - Automate everything  

## Quick Start (3 Steps)

### Step 1: Setup Android Phone (5 minutes)

```bash
# 1. Install Termux from F-Droid (NOT Play Store!)
# Download: https://f-droid.org/packages/com.termux/

# 2. In Termux, run:
pkg update && pkg upgrade
pkg install git

# 3. Clone or copy this project to your phone
# Then run:
bash setup.sh

# 4. Note your IP address:
ifconfig
```

### Step 2: Setup Your PC (2 minutes)

```bash
# Navigate to project directory
cd android-server-control

# Run setup
bash setup.sh

# Edit .env with your phone's IP
nano .env
# Change: ANDROID_HOST=192.168.1.XXX
```

### Step 3: Launch Dashboard (1 minute)

```bash
# Start the dashboard
./start-dashboard.sh

# Or manually:
cd dashboard
npm start

# Open in browser:
http://localhost:3000
```

## 🎉 You're Done!

You should now see a beautiful dashboard with server templates!

## Create Your First Server

### Using Web Dashboard (Easiest)

1. **Click any template card** (e.g., "Static Website")
2. **Fill in the name** (e.g., "my-website")
3. **Click "Create Server"**
4. **Watch it deploy automatically!**
5. **Access your server** at `http://<phone-ip>:<port>`

### Using CLI

```bash
# Start CLI
./start-cli.sh

# Or manually:
cd cli
node manager-cli.js

# Follow the interactive menu
```

### Using API

```bash
curl -X POST http://localhost:3000/api/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-website",
    "type": "web-static"
  }'
```

## 📚 What to Read Next

**For Beginners:**
1. `QUICKSTART.md` - Detailed quick start
2. `ADVANCED_README.md` - Feature overview

**For Advanced Users:**
3. `FEATURES.md` - Complete feature list
4. `docs/SETUP_GUIDE.md` - Comprehensive setup
5. `docs/SERVICE_EXAMPLES.md` - Service examples

**For Reference:**
6. `docs/REFERENCE.md` - Command reference
7. `PROJECT_SUMMARY.txt` - Project overview

## 🎨 Available Server Templates

Click any template in the dashboard to deploy:

### Web Servers
- 🌐 **Static Website** - HTML/CSS/JS hosting
- 🟢 **Node.js API** - Express REST API
- 🐍 **Python Flask** - Full web framework

### Databases
- 🐘 **PostgreSQL** - SQL database
- 🔴 **Redis** - In-memory cache

### Gaming
- ⛏️ **Minecraft** - Java Edition server

### Bots & Apps
- 🤖 **Discord Bot** - Discord.js bot
- ☁️ **File Storage** - Personal cloud
- 🧠 **AI Inference** - ML model server

## 💡 Example Use Cases

### Host a Personal Website
```javascript
1. Click "Static Website" template
2. Name: "my-portfolio"
3. Upload your HTML files to: ~/server/instances/<id>/public/
4. Access: http://<phone-ip>:8080
```

### Create an API Server
```javascript
1. Click "Node.js API" template
2. Name: "my-api"
3. Configure CORS and rate limiting
4. API available at: http://<phone-ip>:3000/api
```

### Run Minecraft Server
```javascript
1. Click "Minecraft Server" template
2. Set max players, difficulty, memory
3. Connect with: <phone-ip>:25565
4. Optimized Paper server ready!
```

## 🔧 Common Commands

### Dashboard
```bash
./start-dashboard.sh              # Start dashboard
cd dashboard && npm start         # Alternative
```

### CLI
```bash
./start-cli.js                    # Interactive menu
node cli/manager-cli.js           # Same
```

### Server Management
```bash
# Via API
curl http://localhost:3000/api/servers              # List
curl -X POST .../api/servers/:id/start              # Start
curl -X POST .../api/servers/:id/stop               # Stop
curl .../api/servers/:id/logs                       # Logs
```

### Android Commands
```bash
# On your phone
~/server/scripts/service-manager.sh status   # Check services
~/server/scripts/system-info.sh              # System info
htop                                         # Resource monitor
```

## ❓ Troubleshooting

### Can't Connect to Dashboard?
```bash
# Check SSH works:
ssh -p 8022 user@<phone-ip>

# Check IP is correct in .env:
cat .env

# Check dashboard is running:
ps aux | grep node
```

### Server Won't Start?
```bash
# Check logs in dashboard
# Or manually:
cat ~/server/instances/<server-id>/logs/server.log

# Check port availability:
netstat -tuln | grep <port>
```

### Out of Resources?
```bash
# Stop unused servers in dashboard
# Or check resources:
free -h              # Memory
df -h               # Disk
htop                # CPU
```

## 🎯 Next Steps

After your first server works:

1. ✅ Try different templates
2. ✅ Monitor resource usage
3. ✅ Setup automated backups
4. ✅ Configure remote access (VPN/DDNS)
5. ✅ Create custom templates
6. ✅ Share your setup!

## 📞 Getting Help

- 📖 Check documentation in `docs/`
- 🐛 Known issues? See troubleshooting guides
- 💬 Join r/termux community
- 🌟 Star the project on GitHub

## 🎊 Success Indicators

You know it's working when:

✅ Dashboard loads at http://localhost:3000  
✅ You see template cards  
✅ System stats show in header  
✅ You can create a server  
✅ Server status shows "running"  
✅ You can access the server  

---

**Congratulations! You now have a professional server management platform!** 🎉

Start creating servers and have fun! 🚀📱💻
