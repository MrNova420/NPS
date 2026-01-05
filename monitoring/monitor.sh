#!/data/data/com.termux/files/usr/bin/bash
# Real-time monitoring script for Android Server

LOG_DIR="$HOME/server/logs"
mkdir -p "$LOG_DIR"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

while true; do
    clear
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Android Server Monitoring Dashboard${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    
    # Date and uptime
    echo -e "${YELLOW}Date:${NC} $(date)"
    echo -e "${YELLOW}Uptime:${NC} $(uptime -p)"
    echo ""
    
    # CPU Usage
    echo -e "${YELLOW}CPU Usage:${NC}"
    top -bn1 | grep "CPU:" | head -1
    echo ""
    
    # Memory Usage
    echo -e "${YELLOW}Memory Usage:${NC}"
    free -h | grep -E "Mem|Swap"
    echo ""
    
    # Disk Usage
    echo -e "${YELLOW}Disk Usage:${NC}"
    df -h $HOME | tail -1
    echo ""
    
    # Network
    echo -e "${YELLOW}Network:${NC}"
    ip addr show wlan0 2>/dev/null | grep "inet " || echo "No network"
    echo ""
    
    # Battery (if available)
    echo -e "${YELLOW}Battery:${NC}"
    termux-battery-status 2>/dev/null | grep -E "percentage|temperature" || echo "N/A"
    echo ""
    
    # Active Services
    echo -e "${YELLOW}Active Services:${NC}"
    pgrep -a sshd && echo -e "${GREEN}✓ SSH${NC}" || echo -e "${RED}✗ SSH${NC}"
    pgrep -a redis-server && echo -e "${GREEN}✓ Redis${NC}" || echo -e "${RED}✗ Redis${NC}"
    pgrep -a nginx && echo -e "${GREEN}✓ Nginx${NC}" || echo -e "${RED}✗ Nginx${NC}"
    pgrep -a postgres && echo -e "${GREEN}✓ PostgreSQL${NC}" || echo -e "${RED}✗ PostgreSQL${NC}"
    echo ""
    
    # Connections
    echo -e "${YELLOW}Active Connections:${NC}"
    netstat -tn 2>/dev/null | grep ESTABLISHED | wc -l || echo "0"
    echo ""
    
    # Top 5 Processes
    echo -e "${YELLOW}Top 5 Processes:${NC}"
    ps aux --sort=-%cpu | head -6 | tail -5
    
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo "Press Ctrl+C to exit | Refreshing in 5s..."
    
    sleep 5
done
