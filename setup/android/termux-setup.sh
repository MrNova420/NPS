#!/data/data/com.termux/files/usr/bin/bash
# Termux Initial Setup Script for Android Server

set -e

echo "=================================="
echo "Android Server Setup - Termux"
echo "=================================="
echo ""

# Update and upgrade packages
echo "[1/8] Updating package lists..."
pkg update -y
pkg upgrade -y

# Install essential packages
echo "[2/8] Installing essential packages..."
pkg install -y \
    openssh \
    python \
    nodejs \
    git \
    wget \
    curl \
    nano \
    htop \
    tmux \
    termux-api \
    termux-services

# Install server packages
echo "[3/8] Installing server packages..."
pkg install -y \
    nginx \
    postgresql \
    redis \
    sqlite \
    proot \
    proot-distro

# Setup storage access
echo "[4/8] Setting up storage access..."
termux-setup-storage

# Configure SSH
echo "[5/8] Configuring SSH server..."
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Generate SSH key if not exists
if [ ! -f ~/.ssh/id_rsa ]; then
    ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""
fi

# Configure sshd
mkdir -p $PREFIX/etc/ssh
echo "PasswordAuthentication yes" >> $PREFIX/etc/ssh/sshd_config
echo "PubkeyAuthentication yes" >> $PREFIX/etc/ssh/sshd_config
echo "Port 8022" >> $PREFIX/etc/ssh/sshd_config

# Set password
echo "[6/8] Please set a password for SSH access:"
passwd

# Create project directories
echo "[7/8] Creating project directories..."
mkdir -p ~/server/{web,data,logs,backups,scripts}
mkdir -p ~/server/services/{nginx,database,storage}

# Create service management script
cat > ~/server/scripts/service-manager.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash

case "$1" in
    start)
        echo "Starting services..."
        sshd
        redis-server --daemonize yes
        echo "Services started"
        ;;
    stop)
        echo "Stopping services..."
        pkill sshd
        pkill redis-server
        echo "Services stopped"
        ;;
    status)
        echo "Service Status:"
        echo "SSH: $(pgrep sshd > /dev/null && echo 'Running' || echo 'Stopped')"
        echo "Redis: $(pgrep redis-server > /dev/null && echo 'Running' || echo 'Stopped')"
        ;;
    *)
        echo "Usage: $0 {start|stop|status}"
        exit 1
        ;;
esac
EOF

chmod +x ~/server/scripts/service-manager.sh

# Create system info script
cat > ~/server/scripts/system-info.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash

echo "===== Android Server System Info ====="
echo ""
echo "Device Info:"
termux-battery-status 2>/dev/null || echo "Battery: N/A"
echo ""
echo "CPU Usage:"
top -bn1 | grep "CPU:" | head -1
echo ""
echo "Memory:"
free -h
echo ""
echo "Storage:"
df -h $HOME
echo ""
echo "Network:"
ip addr show wlan0 2>/dev/null | grep "inet " || echo "No network info"
echo ""
echo "Active Services:"
ps aux | grep -E "sshd|redis|nginx|postgres" | grep -v grep
EOF

chmod +x ~/server/scripts/system-info.sh

# Setup complete
echo "[8/8] Setup complete!"
echo ""
echo "=================================="
echo "Next Steps:"
echo "=================================="
echo "1. Start services: ~/server/scripts/service-manager.sh start"
echo "2. Check status: ~/server/scripts/service-manager.sh status"
echo "3. View system info: ~/server/scripts/system-info.sh"
echo "4. Find your IP: ifconfig"
echo "5. Connect from PC: ssh -p 8022 \$(whoami)@<phone-ip>"
echo ""
echo "SSH Port: 8022"
echo "Username: $(whoami)"
echo ""
echo "Your SSH public key (add to PC):"
cat ~/.ssh/id_rsa.pub
echo ""
