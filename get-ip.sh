#!/data/data/com.termux/files/usr/bin/bash
# Advanced IP Detection Script for Android/Termux
# Finds the real, usable IP address with multiple fallback methods

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}   Advanced IP Address Detection for Android/Termux${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Array to store found IPs with their interface names
declare -A ip_addresses

# Function to validate if IP is private/local network IP
is_local_ip() {
    local ip=$1
    # Check if IP matches local network patterns
    if [[ $ip =~ ^192\.168\. ]] || \
       [[ $ip =~ ^10\. ]] || \
       [[ $ip =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]]; then
        return 0
    fi
    return 1
}

# Function to check if IP is reachable from local network
test_ip_connectivity() {
    local ip=$1
    # Try to bind to the IP (simple connectivity test)
    timeout 1 bash -c "echo >/dev/tcp/$ip/0" 2>/dev/null && return 0 || return 1
}

echo -e "${YELLOW}🔍 Scanning for network interfaces...${NC}"
echo ""

# Method 1: Using 'ip' command (most reliable on modern Android)
if command -v ip >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Using 'ip' command${NC}"
    
    # Get all network interfaces with IP addresses
    while IFS= read -r line; do
        if [[ $line =~ inet\ ([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+) ]]; then
            ip_addr="${BASH_REMATCH[1]}"
            # Skip localhost
            if [[ $ip_addr != "127.0.0.1" ]]; then
                # Get interface name from next line or previous line
                iface=$(echo "$line" | awk '{print $NF}')
                ip_addresses[$iface]=$ip_addr
            fi
        fi
    done < <(ip -4 addr show 2>/dev/null)
fi

# Method 2: Using 'ifconfig' command (fallback for older systems)
if command -v ifconfig >/dev/null 2>&1 && [ ${#ip_addresses[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ Using 'ifconfig' command (fallback)${NC}"
    
    current_iface=""
    while IFS= read -r line; do
        # Detect interface name
        if [[ $line =~ ^([a-zA-Z0-9]+): ]]; then
            current_iface="${BASH_REMATCH[1]}"
        fi
        # Detect IP address
        if [[ $line =~ inet[[:space:]]+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+) ]]; then
            ip_addr="${BASH_REMATCH[1]}"
            if [[ $ip_addr != "127.0.0.1" ]] && [[ -n $current_iface ]]; then
                ip_addresses[$current_iface]=$ip_addr
            fi
        fi
    done < <(ifconfig 2>/dev/null)
fi

# Method 3: Using 'hostname' command
if command -v hostname >/dev/null 2>&1; then
    host_ips=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -v "127.0.0.1" | head -3)
    if [ -n "$host_ips" ]; then
        echo -e "${GREEN}✓ Found IPs via 'hostname' command${NC}"
        idx=1
        while IFS= read -r hip; do
            if [ -n "$hip" ]; then
                ip_addresses["host$idx"]=$hip
                ((idx++))
            fi
        done <<< "$host_ips"
    fi
fi

# Method 4: Using termux-wifi-connectioninfo (if available)
if command -v termux-wifi-connectioninfo >/dev/null 2>&1; then
    wifi_ip=$(termux-wifi-connectioninfo 2>/dev/null | grep -oP '"ip":\s*"\K[^"]+' | head -1)
    if [ -n "$wifi_ip" ] && [ "$wifi_ip" != "127.0.0.1" ]; then
        echo -e "${GREEN}✓ Found IP via 'termux-wifi-connectioninfo'${NC}"
        ip_addresses["termux-wifi"]=$wifi_ip
    fi
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Now analyze and display the IPs
if [ ${#ip_addresses[@]} -eq 0 ]; then
    echo -e "${RED}❌ No IP addresses found!${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting steps:${NC}"
    echo "1. Make sure you're connected to WiFi"
    echo "2. Check WiFi settings on your phone"
    echo "3. Try: pkg install iproute2 net-tools"
    echo "4. Restart Termux and try again"
    echo ""
    exit 1
fi

# Find the best IP to use (prioritize wlan, then others)
best_ip=""
best_iface=""

# Priority order for interface names
priority_patterns=("wlan" "wifi" "eth" "usb" "rmnet" "dummy")

echo -e "${CYAN}📱 Found IP Address(es):${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# First pass: display all IPs and identify the best one
for iface in "${!ip_addresses[@]}"; do
    ip="${ip_addresses[$iface]}"
    
    # Determine IP type
    ip_type=""
    if is_local_ip "$ip"; then
        ip_type="${GREEN}[Local Network]${NC}"
        
        # Check against priority patterns to find best IP
        for pattern in "${priority_patterns[@]}"; do
            if [[ $iface =~ $pattern ]] && [[ -z $best_ip ]]; then
                best_ip=$ip
                best_iface=$iface
            fi
        done
        
        # If no match yet and this is a local IP, use it
        if [[ -z $best_ip ]]; then
            best_ip=$ip
            best_iface=$iface
        fi
    else
        ip_type="${YELLOW}[Public/Other]${NC}"
    fi
    
    # Display with highlighting if it's the best choice
    if [[ $ip == $best_ip ]]; then
        echo -e "  ${GREEN}★ $iface${NC}: ${CYAN}$ip${NC} $ip_type ${GREEN}← RECOMMENDED${NC}"
    else
        echo -e "    $iface: $ip $ip_type"
    fi
done

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Display the recommended IP prominently
if [ -n "$best_ip" ]; then
    echo -e "${GREEN}✅ Your Main IP Address:${NC} ${CYAN}${best_ip}${NC}"
    echo -e "${GREEN}   Interface:${NC} ${best_iface}"
    echo ""
    
    # Get username
    username=$(whoami)
    
    echo -e "${YELLOW}📋 Connection Information:${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${CYAN}From PC:${NC}"
    echo -e "  SSH: ${GREEN}ssh -p 8022 $username@$best_ip${NC}"
    echo -e "  Dashboard: ${GREEN}http://$best_ip:3000${NC}"
    echo ""
    echo -e "${CYAN}For .env file:${NC}"
    echo -e "  ${GREEN}ANDROID_HOST=$best_ip${NC}"
    echo -e "  ${GREEN}ANDROID_PORT=8022${NC}"
    echo -e "  ${GREEN}ANDROID_USER=$username${NC}"
    echo ""
    
    # Save to a file for easy reference
    cat > /tmp/nps-connection-info.txt << EOF
# NPS Connection Information
# Generated: $(date)

IP Address: $best_ip
Interface: $best_iface
Username: $username

SSH Command:
ssh -p 8022 $username@$best_ip

.env Configuration:
ANDROID_HOST=$best_ip
ANDROID_PORT=8022
ANDROID_USER=$username
EOF
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}💡 Connection info saved to:${NC} /tmp/nps-connection-info.txt"
    echo ""
    
    # Additional helpful info
    echo -e "${CYAN}📝 Quick Actions:${NC}"
    echo "  • Test SSH: ${YELLOW}ssh -p 8022 $username@$best_ip${NC}"
    echo "  • Check if SSH running: ${YELLOW}pgrep sshd${NC}"
    echo "  • Start SSH server: ${YELLOW}sshd${NC}"
    echo "  • View this info again: ${YELLOW}cat /tmp/nps-connection-info.txt${NC}"
    echo ""
    
    # Network quality check
    echo -e "${CYAN}🔍 Network Check:${NC}"
    
    # Check if we can resolve DNS
    if command -v ping >/dev/null 2>&1; then
        if ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1; then
            echo -e "  ${GREEN}✓${NC} Internet connectivity: OK"
        else
            echo -e "  ${YELLOW}⚠${NC} Internet connectivity: Limited or None"
        fi
    fi
    
    # Check WiFi signal (if available)
    if command -v termux-wifi-connectioninfo >/dev/null 2>&1; then
        rssi=$(termux-wifi-connectioninfo 2>/dev/null | grep -oP '"rssi":\s*\K[^,}]+')
        if [ -n "$rssi" ]; then
            if [ "$rssi" -gt -50 ]; then
                signal="${GREEN}Excellent${NC}"
            elif [ "$rssi" -gt -60 ]; then
                signal="${GREEN}Good${NC}"
            elif [ "$rssi" -gt -70 ]; then
                signal="${YELLOW}Fair${NC}"
            else
                signal="${RED}Weak${NC}"
            fi
            echo -e "  ${GREEN}✓${NC} WiFi signal: $signal ($rssi dBm)"
        fi
    fi
    
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ Ready to connect!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
else
    echo -e "${RED}❌ Could not determine the best IP address${NC}"
    echo -e "${YELLOW}Please check your network connection and try again${NC}"
    echo ""
    exit 1
fi

