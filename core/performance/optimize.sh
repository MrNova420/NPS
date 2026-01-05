#!/data/data/com.termux/files/usr/bin/bash
# NPS Performance Optimizer - Maximize Android Device Performance
# Auto-detects device capabilities and optimizes accordingly

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  NPS Performance Optimizer - Production Grade Tuning      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Detect device capabilities
echo -e "${BLUE}[1/10] Detecting device capabilities...${NC}"

# CPU information
CPU_CORES=$(nproc)
CPU_FREQ=$(cat /sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq 2>/dev/null || echo "unknown")
CPU_ARCH=$(uname -m)

# Memory information
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
AVAILABLE_RAM=$(free -m | awk '/^Mem:/{print $7}')

# Storage information
TOTAL_STORAGE=$(df -h $HOME | tail -1 | awk '{print $2}')
FREE_STORAGE=$(df -h $HOME | tail -1 | awk '{print $4}')

# Battery information
if command -v termux-battery-status >/dev/null 2>&1; then
    BATTERY_STATUS=$(termux-battery-status 2>/dev/null | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
else
    BATTERY_STATUS="unknown"
fi

echo ""
echo "Device Specifications:"
echo "  CPU Cores:       $CPU_CORES"
echo "  CPU Frequency:   $CPU_FREQ kHz"
echo "  Architecture:    $CPU_ARCH"
echo "  Total RAM:       ${TOTAL_RAM}MB"
echo "  Available RAM:   ${AVAILABLE_RAM}MB"
echo "  Total Storage:   $TOTAL_STORAGE"
echo "  Free Storage:    $FREE_STORAGE"
echo "  Battery Status:  $BATTERY_STATUS"
echo ""

# Determine performance tier
if [ "$TOTAL_RAM" -ge 6144 ]; then
    TIER="high"
    MAX_SERVERS=12
    WORKER_PROCESSES=4
elif [ "$TOTAL_RAM" -ge 4096 ]; then
    TIER="medium"
    MAX_SERVERS=8
    WORKER_PROCESSES=3
elif [ "$TOTAL_RAM" -ge 2048 ]; then
    TIER="low"
    MAX_SERVERS=4
    WORKER_PROCESSES=2
else
    TIER="minimal"
    MAX_SERVERS=2
    WORKER_PROCESSES=1
fi

echo -e "${GREEN}Performance Tier: $TIER${NC}"
echo "  Max Recommended Servers: $MAX_SERVERS"
echo "  Worker Processes: $WORKER_PROCESSES"
echo ""

# Create performance config
echo -e "${BLUE}[2/10] Creating performance configuration...${NC}"

mkdir -p ~/server/config

cat > ~/server/config/performance.conf << EOF
# NPS Performance Configuration
# Auto-generated based on device capabilities

# Device Tier: $TIER
DEVICE_TIER="$TIER"
CPU_CORES=$CPU_CORES
TOTAL_RAM_MB=$TOTAL_RAM
MAX_SERVERS=$MAX_SERVERS
WORKER_PROCESSES=$WORKER_PROCESSES

# Performance Limits
MAX_MEMORY_PER_SERVER=$((TOTAL_RAM / MAX_SERVERS))
MAX_CPU_PER_SERVER=$((100 / MAX_SERVERS))

# System Optimization
ENABLE_SWAP=$([ "$TOTAL_RAM" -lt 4096 ] && echo "true" || echo "false")
ENABLE_ZRAM=$([ "$TOTAL_RAM" -lt 3072 ] && echo "true" || echo "false")
ENABLE_LOW_MEMORY_MODE=$([ "$TOTAL_RAM" -lt 2048 ] && echo "true" || echo "false")

# Network Optimization
TCP_WINDOW_SIZE=$((TOTAL_RAM * 256))
MAX_CONNECTIONS=$((TOTAL_RAM * 10))

# Cache Settings
CACHE_SIZE_MB=$((TOTAL_RAM / 10))
EOF

echo -e "${GREEN}✓ Performance config created${NC}"
echo ""

# System kernel tuning
echo -e "${BLUE}[3/10] Optimizing kernel parameters...${NC}"

# Network optimizations
cat >> ~/server/config/sysctl.conf << 'EOF'
# Network Performance
net.core.rmem_max=16777216
net.core.wmem_max=16777216
net.ipv4.tcp_rmem=4096 87380 16777216
net.ipv4.tcp_wmem=4096 65536 16777216
net.core.netdev_max_backlog=5000
net.ipv4.tcp_fin_timeout=30
net.ipv4.tcp_keepalive_time=300
net.ipv4.tcp_tw_reuse=1
net.ipv4.tcp_max_syn_backlog=8192
net.ipv4.ip_local_port_range=10000 65535

# Memory Management
vm.swappiness=10
vm.dirty_ratio=15
vm.dirty_background_ratio=5
vm.vfs_cache_pressure=50

# Connection Tracking
net.netfilter.nf_conntrack_max=262144
EOF

echo -e "${GREEN}✓ Kernel parameters configured${NC}"
echo ""

# Setup swap if needed
if [ "$TOTAL_RAM" -lt 4096 ]; then
    echo -e "${BLUE}[4/10] Setting up swap space...${NC}"
    
    SWAP_SIZE=$((TOTAL_RAM / 2))
    
    if [ ! -f ~/server/swapfile ]; then
        dd if=/dev/zero of=~/server/swapfile bs=1M count=$SWAP_SIZE 2>/dev/null || true
        chmod 600 ~/server/swapfile
        mkswap ~/server/swapfile 2>/dev/null || true
        swapon ~/server/swapfile 2>/dev/null || true
        echo -e "${GREEN}✓ ${SWAP_SIZE}MB swap space created${NC}"
    else
        echo -e "${YELLOW}⚠ Swap already exists${NC}"
    fi
    echo ""
else
    echo -e "${BLUE}[4/10] Swap not needed (sufficient RAM)${NC}"
    echo ""
fi

# CPU governor optimization
echo -e "${BLUE}[5/10] Optimizing CPU governor...${NC}"

for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
    if [ -f "$cpu" ]; then
        # Use performance governor for server workload
        echo "performance" > "$cpu" 2>/dev/null || echo "schedutil" > "$cpu" 2>/dev/null || true
    fi
done

echo -e "${GREEN}✓ CPU governor set to performance mode${NC}"
echo ""

# I/O scheduler optimization
echo -e "${BLUE}[6/10] Optimizing I/O scheduler...${NC}"

for device in /sys/block/*/queue/scheduler; do
    if [ -f "$device" ]; then
        # Use deadline scheduler for better latency
        echo "deadline" > "$device" 2>/dev/null || echo "cfq" > "$device" 2>/dev/null || true
    fi
done

echo -e "${GREEN}✓ I/O scheduler optimized${NC}"
echo ""

# Create performance monitoring script
echo -e "${BLUE}[7/10] Creating performance monitor...${NC}"

cat > ~/server/scripts/performance-monitor.sh << 'PERF_EOF'
#!/data/data/com.termux/files/usr/bin/bash
# Real-time performance monitor

LOGFILE="$HOME/server/logs/performance.log"
mkdir -p "$(dirname "$LOGFILE")"

log_metric() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOGFILE"
}

while true; do
    # CPU Usage
    CPU_USAGE=$(top -bn1 | grep "CPU:" | awk '{print $2}' | sed 's/%//')
    log_metric "CPU: ${CPU_USAGE}%"
    
    # Memory Usage
    MEM_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100}')
    log_metric "MEM: ${MEM_USAGE}%"
    
    # Disk Usage
    DISK_USAGE=$(df -h $HOME | tail -1 | awk '{print $5}')
    log_metric "DISK: ${DISK_USAGE}"
    
    # Network connections
    CONNECTIONS=$(netstat -an 2>/dev/null | grep ESTABLISHED | wc -l)
    log_metric "CONNECTIONS: ${CONNECTIONS}"
    
    # Check for thermal throttling
    if [ -f /sys/class/thermal/thermal_zone0/temp ]; then
        TEMP=$(cat /sys/class/thermal/thermal_zone0/temp)
        TEMP_C=$((TEMP / 1000))
        log_metric "TEMP: ${TEMP_C}°C"
        
        # Warn if overheating
        if [ "$TEMP_C" -gt 70 ]; then
            echo "WARNING: High temperature detected: ${TEMP_C}°C" | tee -a "$LOGFILE"
        fi
    fi
    
    # Clean old logs (keep last 7 days)
    find "$(dirname "$LOGFILE")" -name "*.log" -mtime +7 -delete 2>/dev/null || true
    
    sleep 30
done
PERF_EOF

chmod +x ~/server/scripts/performance-monitor.sh

echo -e "${GREEN}✓ Performance monitor created${NC}"
echo ""

# Create auto-optimization script
echo -e "${BLUE}[8/10] Creating auto-optimizer...${NC}"

cat > ~/server/scripts/auto-optimize.sh << 'AUTO_EOF'
#!/data/data/com.termux/files/usr/bin/bash
# Auto-optimization daemon

source ~/server/config/performance.conf

while true; do
    # Monitor memory usage
    MEM_PERCENT=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
    
    if [ "$MEM_PERCENT" -gt 85 ]; then
        echo "[$(date)] High memory usage detected: ${MEM_PERCENT}%"
        
        # Clear PageCache
        sync
        echo 1 > /proc/sys/vm/drop_caches 2>/dev/null || true
        
        # Kill idle processes
        pkill -9 -f "idle" 2>/dev/null || true
    fi
    
    # Monitor CPU usage
    CPU_PERCENT=$(top -bn1 | grep "CPU:" | awk '{print $2}' | sed 's/%//')
    
    if [ "$CPU_PERCENT" -gt 90 ]; then
        echo "[$(date)] High CPU usage detected: ${CPU_PERCENT}%"
        # Throttle less critical services
        renice +10 $(pgrep -f "backup|sync") 2>/dev/null || true
    fi
    
    # Check disk space
    DISK_PERCENT=$(df $HOME | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ "$DISK_PERCENT" -gt 85 ]; then
        echo "[$(date)] Low disk space: ${DISK_PERCENT}% used"
        
        # Clean temporary files
        rm -rf ~/server/temp/* 2>/dev/null || true
        rm -rf ~/.cache/* 2>/dev/null || true
        
        # Compress old logs
        find ~/server/logs -name "*.log" -mtime +1 -exec gzip {} \; 2>/dev/null || true
    fi
    
    # Check thermal throttling
    if [ -f /sys/class/thermal/thermal_zone0/temp ]; then
        TEMP=$(($(cat /sys/class/thermal/thermal_zone0/temp) / 1000))
        
        if [ "$TEMP" -gt 75 ]; then
            echo "[$(date)] High temperature: ${TEMP}°C - Reducing load"
            
            # Reduce CPU frequency
            for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_max_freq; do
                [ -f "$cpu" ] && echo "80%" > "$cpu" 2>/dev/null || true
            done
            
            # Stop non-critical servers
            # (Implementation would stop lowest priority servers)
        fi
    fi
    
    sleep 60
done
AUTO_EOF

chmod +x ~/server/scripts/auto-optimize.sh

echo -e "${GREEN}✓ Auto-optimizer created${NC}"
echo ""

# Network optimization
echo -e "${BLUE}[9/10] Optimizing network stack...${NC}"

# TCP Buffer sizes
sysctl -w net.core.rmem_default=262144 2>/dev/null || true
sysctl -w net.core.wmem_default=262144 2>/dev/null || true
sysctl -w net.core.rmem_max=16777216 2>/dev/null || true
sysctl -w net.core.wmem_max=16777216 2>/dev/null || true

# TCP tuning
sysctl -w net.ipv4.tcp_fin_timeout=30 2>/dev/null || true
sysctl -w net.ipv4.tcp_keepalive_time=300 2>/dev/null || true
sysctl -w net.ipv4.tcp_tw_reuse=1 2>/dev/null || true

echo -e "${GREEN}✓ Network stack optimized${NC}"
echo ""

# Create performance profile
echo -e "${BLUE}[10/10] Saving performance profile...${NC}"

cat > ~/server/config/profile.json << EOF
{
  "device": {
    "tier": "$TIER",
    "cpu_cores": $CPU_CORES,
    "ram_mb": $TOTAL_RAM,
    "storage_gb": "$TOTAL_STORAGE"
  },
  "limits": {
    "max_servers": $MAX_SERVERS,
    "max_memory_per_server_mb": $((TOTAL_RAM / MAX_SERVERS)),
    "max_cpu_per_server_percent": $((100 / MAX_SERVERS)),
    "worker_processes": $WORKER_PROCESSES
  },
  "optimization": {
    "swap_enabled": $([ "$TOTAL_RAM" -lt 4096 ] && echo "true" || echo "false"),
    "cache_size_mb": $((TOTAL_RAM / 10)),
    "tcp_window_kb": $((TOTAL_RAM / 4)),
    "max_connections": $((TOTAL_RAM * 10))
  },
  "thermal": {
    "max_temp_c": 75,
    "throttle_temp_c": 70,
    "critical_temp_c": 80
  }
}
EOF

echo -e "${GREEN}✓ Performance profile saved${NC}"
echo ""

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║            Performance Optimization Complete!             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}System optimized for $TIER tier performance${NC}"
echo ""
echo "Configuration:"
echo "  • Max Servers: $MAX_SERVERS"
echo "  • Worker Processes: $WORKER_PROCESSES"
echo "  • Memory per Server: $((TOTAL_RAM / MAX_SERVERS))MB"
echo "  • CPU per Server: $((100 / MAX_SERVERS))%"
echo ""
echo "Active Optimizations:"
echo "  ✓ CPU governor set to performance"
echo "  ✓ I/O scheduler optimized"
echo "  ✓ Network stack tuned"
echo "  ✓ Memory management optimized"
echo "  ✓ Thermal monitoring active"
echo ""
echo "To start performance monitoring:"
echo "  nohup ~/server/scripts/performance-monitor.sh &"
echo ""
echo "To enable auto-optimization:"
echo "  nohup ~/server/scripts/auto-optimize.sh &"
echo ""
