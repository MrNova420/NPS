# Android Server Manager v2.0 - Complete Platform

## 🚀 What's New

This is a **complete rewrite** of the Android Server Management system with enterprise-grade features:

### ✨ Key Features

1. **One-Click Server Deployment**
   - 8+ pre-configured server templates
   - Automatic setup and configuration
   - Zero manual configuration needed

2. **Beautiful Web Dashboard**
   - Real-time server monitoring
   - Visual resource usage graphs
   - One-click server control (start/stop/restart/delete)
   - WebSocket-based live updates

3. **Smart Resource Management**
   - Automatic port allocation
   - Memory and CPU monitoring
   - Intelligent resource optimization
   - Auto-recovery on failures

4. **Server Templates Included**
   - 🌐 Static Website Hosting
   - 🟢 Node.js API Server
   - 🐍 Python Flask Web App
   - 🐘 PostgreSQL Database
   - 🔴 Redis Cache
   - ⛏️ Minecraft Server
   - 🤖 Discord Bot
   - ☁️ File Storage Server
   - 🧠 AI Inference Server

5. **Advanced Management**
   - CLI interface for power users
   - RESTful API for automation
   - Real-time logs viewing
   - Backup and restore
   - Multi-server orchestration

## 📋 Quick Start

### Setup (First Time)

**On Android Phone:**
```bash
# 1. Install Termux from F-Droid
# 2. Run initial setup
bash setup/android/termux-setup.sh

# 3. Create instances directory
mkdir -p ~/server/instances

# 4. Find your IP
ifconfig
```

**On Your PC:**
```bash
cd dashboard
npm install

# Configure connection
export ANDROID_HOST=<your-phone-ip>
export ANDROID_PORT=8022
export ANDROID_USER=<your-username>

# Start dashboard
npm start
```

**Open Dashboard:**
- Visit: http://localhost:3000
- You'll see the beautiful dashboard with all templates

### Create Your First Server

#### Option 1: Web Dashboard (Recommended)
1. Open http://localhost:3000
2. Click any server template card
3. Fill in the configuration
4. Click "Create Server"
5. Watch it deploy automatically!

#### Option 2: CLI
```bash
cd cli
node manager-cli.js
```

#### Option 3: API
```bash
curl -X POST http://localhost:3000/api/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-website",
    "type": "web-static",
    "port": 8080
  }'
```

## 🎨 Available Templates

### Web Servers

**Static Website** (web-static)
- Perfect for HTML/CSS/JS sites
- Nginx-powered
- Auto-configured
- SSL support optional

**Node.js API** (nodejs-api)
- Express.js REST API
- CORS enabled
- Rate limiting
- Auto-npm install

**Flask Web App** (flask-app)
- Full Python web framework
- Template system
- Optional database
- Production-ready

### Databases

**PostgreSQL** (postgresql)
- Full SQL database
- User management
- Automated backups
- Optimized for mobile

**Redis Cache** (redis-cache)
- In-memory data store
- Pub/sub messaging
- Persistence options
- LRU eviction

### Gaming

**Minecraft Server** (minecraft)
- Paper server (optimized)
- Auto-downloads
- Configurable settings
- Memory management

### Bots & Automation

**Discord Bot** (discord-bot)
- Discord.js ready
- Command system
- Auto-reconnect
- Event handling

### Storage & AI

**File Storage** (file-storage)
- Personal cloud
- Password protected
- Web interface
- Upload/download

**AI Inference** (ai-inference)
- ONNX Runtime
- REST API
- Batch processing
- Model management

## 🎯 Usage Examples

### Example 1: Host a Website

```javascript
// Dashboard automatically creates:
POST /api/servers
{
  "name": "my-portfolio",
  "type": "web-static",
  "config": {
    "domain": "mysite.com"
  }
}

// Access at: http://<phone-ip>:8080
```

### Example 2: Run an API Server

```javascript
POST /api/servers
{
  "name": "my-api",
  "type": "nodejs-api",
  "port": 3001,
  "config": {
    "apiName": "my-awesome-api",
    "enableCors": true,
    "rateLimit": 100
  }
}
```

### Example 3: Minecraft Server

```javascript
POST /api/servers
{
  "name": "survival-server",
  "type": "minecraft",
  "config": {
    "serverName": "My Survival World",
    "maxPlayers": 20,
    "difficulty": "normal",
    "memory": 1024
  }
}

// Connect: <phone-ip>:25565
```

### Example 4: Discord Bot

```javascript
POST /api/servers
{
  "name": "my-bot",
  "type": "discord-bot",
  "config": {
    "botToken": "YOUR_BOT_TOKEN",
    "botName": "MyBot",
    "prefix": "!"
  }
}
```

## 📊 Dashboard Features

### Real-Time Monitoring
- CPU usage per server
- Memory consumption
- Uptime tracking
- Request counting
- Live status updates

### Server Management
- Start/Stop/Restart with one click
- View real-time logs
- Delete servers safely
- Auto-restart on crash
- Health checks

### System Overview
- Total system resources
- Active server count
- Network statistics
- Storage usage

## 🔧 Advanced Features

### Auto-Recovery
Servers automatically restart if they crash:
```javascript
// Built into each template
process.on('uncaughtException', (error) => {
    log.error(error);
    // Auto-restart logic
});
```

### Resource Optimization
```javascript
// Automatic port allocation
findAvailablePort() {
    const usedPorts = new Set(servers.map(s => s.port));
    let port = 8000;
    while (usedPorts.has(port)) port++;
    return port;
}
```

### Smart Load Balancing
```javascript
// Distribute load across servers
const optimalServer = servers
    .filter(s => s.status === 'running')
    .sort((a, b) => a.stats.cpu - b.stats.cpu)[0];
```

## 🔌 API Reference

### Servers

```bash
# List all servers
GET /api/servers

# Create server
POST /api/servers
Body: { name, type, port?, config? }

# Control server
POST /api/servers/:id/start
POST /api/servers/:id/stop
POST /api/servers/:id/restart
POST /api/servers/:id/delete

# Get logs
GET /api/servers/:id/logs
```

### Templates

```bash
# List templates
GET /api/templates

# Get template details
GET /api/templates/:type
```

### System

```bash
# System stats
GET /api/system/stats

# Execute command
POST /api/system/execute
Body: { command }
```

## 🎛️ Configuration

### Environment Variables

```bash
# Dashboard connection
export ANDROID_HOST=192.168.1.100
export ANDROID_PORT=8022
export ANDROID_USER=u0_a123

# Dashboard settings
export PORT=3000
export NODE_ENV=production

# Security (optional)
export API_KEY=your-secret-key
export ENABLE_AUTH=true
```

### Server Config

Each server template has customizable options:

```javascript
module.exports = {
    name: 'My Template',
    configOptions: [
        {
            name: 'apiKey',
            label: 'API Key',
            type: 'password',
            required: true
        },
        {
            name: 'maxConnections',
            label: 'Max Connections',
            type: 'number',
            default: 100
        }
    ]
};
```

## 🔒 Security Best Practices

1. **Use SSH Keys**
```bash
ssh-keygen -t rsa -b 4096
ssh-copy-id -p 8022 user@phone-ip
```

2. **Enable Firewall**
```bash
# On Android (if rooted)
pkg install iptables
# Configure rules
```

3. **Use VPN**
```bash
pkg install wireguard-tools
# Setup VPN tunnel
```

4. **Regular Backups**
```bash
# Automated in dashboard
# Manual: tar -czf backup.tar.gz ~/server/instances
```

## 📈 Performance Tips

### Memory Optimization
- Limit concurrent servers
- Set appropriate memory limits
- Use Redis for caching
- Enable gzip compression

### CPU Optimization
- Use worker processes
- Enable clustering
- Implement rate limiting
- Cache static assets

### Storage Optimization
- Regular log rotation
- Clean old instances
- Compress backups
- Monitor disk usage

## 🐛 Troubleshooting

### Server Won't Start
```bash
# Check logs
cat ~/server/instances/<server-id>/logs/server.log

# Check port
netstat -tuln | grep <port>

# Check resources
free -h
```

### Dashboard Not Connecting
```bash
# Test SSH
ssh -p 8022 user@phone-ip

# Check firewall
# Check IP address
ifconfig
```

### High Resource Usage
```bash
# Check per-server usage
htop

# Stop unused servers
# Optimize configurations
# Add more RAM if possible
```

## 🎓 Creating Custom Templates

```javascript
// server-templates/my-template.js
module.exports = {
    name: 'My Custom Server',
    description: 'Description here',
    category: 'Custom',
    icon: '🎯',
    defaultPort: 9000,
    requirements: ['package1', 'package2'],
    
    configOptions: [
        { name: 'setting1', label: 'Setting 1', type: 'text' }
    ],

    async deploy(server, sshExec) {
        // Setup logic
        const path = `~/server/instances/${server.id}`;
        await sshExec(`mkdir -p ${path}`);
        // ... create files, start service
        return { path, port: server.port };
    },

    async start(server, sshExec) {
        // Start logic
    },

    async stop(server, sshExec) {
        // Stop logic
    },

    async delete(server, sshExec) {
        // Cleanup logic
    }
};
```

## 📚 Additional Resources

- [Templates Guide](docs/TEMPLATES.md)
- [API Documentation](docs/API.md)
- [Security Guide](docs/SECURITY.md)
- [Performance Tuning](docs/PERFORMANCE.md)

## 🤝 Contributing

Want to add more templates? See [CONTRIBUTING.md](CONTRIBUTING.md)

## 📄 License

MIT License - Use freely!

---

**Built with ❤️ for turning Android devices into powerful servers**

Transform your old Android phone into a production-ready server today! 🚀📱
