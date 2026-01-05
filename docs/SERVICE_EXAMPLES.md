# Example Service Configurations

## Web Applications

### Node.js App
```bash
# On Android
cd ~/server/web
npm init -y
npm install express

# Create app
cat > app.js << 'EOF'
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Hello from Android!'));
app.listen(3000, () => console.log('Running on port 3000'));
EOF

# Run
node app.js
```

### Python Flask App
```bash
# Install Flask
pip install flask

# Create app
cat > ~/server/web/app.py << 'EOF'
from flask import Flask
app = Flask(__name__)

@app.route('/')
def hello():
    return 'Hello from Android Flask!'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
EOF

# Run
python ~/server/web/app.py
```

## Database Configs

### Redis Cache
```bash
# Start Redis
redis-server --daemonize yes

# Test
redis-cli ping  # Should return PONG

# Set/Get data
redis-cli set mykey "Hello"
redis-cli get mykey
```

### SQLite Database
```bash
# Create database
sqlite3 ~/server/data/mydb.sqlite << 'EOF'
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT,
    email TEXT
);
INSERT INTO users VALUES (1, 'John', 'john@example.com');
SELECT * FROM users;
EOF
```

### PostgreSQL
```bash
# After setup-postgres.sh
pg_ctl -D $PREFIX/var/lib/postgresql start

# Create database and user
createdb appdb
psql appdb << 'EOF'
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    price DECIMAL(10,2)
);
INSERT INTO products (name, price) VALUES ('Widget', 19.99);
EOF
```

## File/Storage Services

### Syncthing (P2P Sync)
```bash
# Install
pkg install syncthing

# Start
syncthing

# Access web UI: http://<phone-ip>:8384
```

### Simple File Browser
```bash
# Python HTTP server with upload
pip install uploadserver

# Run
python -m uploadserver 8000
# Access: http://<phone-ip>:8000
```

### FTP Server
```bash
# Install
pkg install busybox

# Start FTP
tcpsvd -vE 0.0.0.0 2121 ftpd -w ~/storage/shared
```

## Game Servers

### Minecraft Bedrock Server
```bash
# Download
cd ~/server
wget https://minecraft.azureedge.net/bin-linux/bedrock-server-1.20.50.03.zip
unzip bedrock-server-*.zip -d minecraft

# Run
cd minecraft
LD_LIBRARY_PATH=. ./bedrock_server
# Default port: 19132 (UDP)
```

### Minetest Server (Lighter alternative)
```bash
pkg install minetest
minetest --server
# Port: 30000
```

## AI/ML Services

### ONNX Runtime Server
```bash
# Install
pip install onnxruntime flask

# Create inference server
cat > ~/server/ai/inference.py << 'EOF'
from flask import Flask, request, jsonify
import onnxruntime as ort
import numpy as np

app = Flask(__name__)
session = ort.InferenceSession("model.onnx")

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json['data']
    input_data = np.array(data, dtype=np.float32)
    outputs = session.run(None, {session.get_inputs()[0].name: input_data})
    return jsonify({'prediction': outputs[0].tolist()})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
EOF
```

### Llama.cpp (Local LLM)
```bash
# Install
pkg install git cmake
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
make

# Download model (quantized)
wget https://huggingface.co/TheBloke/Llama-2-7B-GGUF/resolve/main/llama-2-7b.Q4_0.gguf

# Run server
./server -m llama-2-7b.Q4_0.gguf -c 2048 --host 0.0.0.0 --port 8080
```

## Media Servers

### Simple Video Streaming
```bash
# Install ffmpeg
pkg install ffmpeg

# Stream video
ffmpeg -re -i video.mp4 -c:v libx264 -c:a aac -f flv rtmp://localhost/live/stream
```

### Music Server
```bash
# Python HTTP server for music
cd ~/storage/shared/Music
python -m http.server 8888
# Access: http://<phone-ip>:8888
```

## Automation & Bots

### Telegram Bot
```bash
# Install
pip install python-telegram-bot

# Create bot
cat > ~/server/bots/telegram_bot.py << 'EOF'
from telegram.ext import Updater, CommandHandler

def start(update, context):
    update.message.reply_text('Hello from Android server!')

def system_info(update, context):
    import subprocess
    info = subprocess.check_output(['~/server/scripts/system-info.sh'])
    update.message.reply_text(info.decode())

updater = Updater('YOUR_BOT_TOKEN', use_context=True)
updater.dispatcher.add_handler(CommandHandler('start', start))
updater.dispatcher.add_handler(CommandHandler('info', system_info))
updater.start_polling()
updater.idle()
EOF

python ~/server/bots/telegram_bot.py
```

### Discord Bot
```bash
# Install
pip install discord.py

# Create bot
cat > ~/server/bots/discord_bot.py << 'EOF'
import discord
from discord.ext import commands

bot = commands.Bot(command_prefix='!')

@bot.command()
async def ping(ctx):
    await ctx.send(f'Pong! {round(bot.latency * 1000)}ms')

@bot.command()
async def serverinfo(ctx):
    import subprocess
    info = subprocess.check_output(['~/server/scripts/system-info.sh'])
    await ctx.send(f'```{info.decode()}```')

bot.run('YOUR_BOT_TOKEN')
EOF

python ~/server/bots/discord_bot.py
```

## Development Tools

### Git Server (Gitea)
```bash
# Download Gitea ARM binary
wget https://dl.gitea.io/gitea/1.21/gitea-1.21-linux-arm64
chmod +x gitea-1.21-linux-arm64

# Run
./gitea-1.21-linux-arm64 web --port 3000
# Access: http://<phone-ip>:3000
```

### Code Server (VS Code in Browser)
```bash
# Install
curl -fsSL https://code-server.dev/install.sh | sh

# Run
code-server --bind-addr 0.0.0.0:8443
# Access: http://<phone-ip>:8443
```

## Monitoring & Logging

### Netdata (System Monitoring)
```bash
# Install
pkg install netdata

# Start
netdata

# Access: http://<phone-ip>:19999
```

### Log Aggregator
```bash
# Simple log viewer
cat > ~/server/scripts/view-logs.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
tail -f ~/server/logs/*.log
EOF

chmod +x ~/server/scripts/view-logs.sh
```

## API Gateway

### Nginx Reverse Proxy Config
```nginx
# Add to nginx.conf
server {
    listen 80;
    server_name api.yourdomain.com;
    
    location /api/v1 {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }
    
    location /api/v2 {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
    }
}
```

## Cron Jobs / Scheduled Tasks

```bash
# Install cron
pkg install cronie

# Edit crontab
crontab -e

# Add tasks:
# Backup every day at 2 AM
0 2 * * * ~/server/scripts/backup.sh

# Clean temp files daily at 3 AM
0 3 * * * rm -rf ~/server/temp/*

# Check disk space every hour
0 * * * * ~/server/scripts/check-disk.sh

# Update packages weekly (Sunday 4 AM)
0 4 * * 0 pkg update && pkg upgrade -y

# Start cron service
sv-enable crond
```

## Docker Alternative (Proot Containers)

```bash
# Install proot-distro
pkg install proot-distro

# List available distros
proot-distro list

# Install Ubuntu
proot-distro install ubuntu

# Login
proot-distro login ubuntu

# Inside Ubuntu, install services
apt update
apt install nginx postgresql redis-server
```

## Performance Optimization

### System Tuning Script
```bash
cat > ~/server/scripts/optimize.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash

# Clear cache
sync
echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true

# Optimize swappiness (if root)
echo 10 > /proc/sys/vm/swappiness 2>/dev/null || true

# Kill unnecessary processes
pkill -f "com.google.android.gms"
pkill -f "com.android.vending"

echo "Optimization complete"
EOF

chmod +x ~/server/scripts/optimize.sh
```

---

These are starting templates - customize them for your needs!
