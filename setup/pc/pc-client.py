#!/usr/bin/env python3
"""
Android Server Control Panel - PC Client
Remote management interface for Android server
"""

import subprocess
import sys
import json
import argparse
from pathlib import Path

class AndroidServerClient:
    def __init__(self, host, port=8022, user=None):
        self.host = host
        self.port = port
        self.user = user or "u0_a"
        
    def ssh_command(self, command):
        """Execute command on Android server via SSH"""
        ssh_cmd = [
            "ssh",
            "-p", str(self.port),
            f"{self.user}@{self.host}",
            command
        ]
        try:
            result = subprocess.run(ssh_cmd, capture_output=True, text=True)
            return result.stdout, result.stderr, result.returncode
        except Exception as e:
            return "", str(e), 1
    
    def get_system_info(self):
        """Get system information from Android server"""
        stdout, stderr, code = self.ssh_command("~/server/scripts/system-info.sh")
        if code == 0:
            print(stdout)
        else:
            print(f"Error: {stderr}")
    
    def service_control(self, action):
        """Control services on Android server"""
        stdout, stderr, code = self.ssh_command(f"~/server/scripts/service-manager.sh {action}")
        if code == 0:
            print(stdout)
        else:
            print(f"Error: {stderr}")
    
    def deploy_file(self, local_path, remote_path):
        """Deploy file to Android server"""
        scp_cmd = [
            "scp",
            "-P", str(self.port),
            local_path,
            f"{self.user}@{self.host}:{remote_path}"
        ]
        try:
            subprocess.run(scp_cmd, check=True)
            print(f"Deployed {local_path} to {remote_path}")
        except subprocess.CalledProcessError as e:
            print(f"Error deploying file: {e}")
    
    def fetch_file(self, remote_path, local_path):
        """Fetch file from Android server"""
        scp_cmd = [
            "scp",
            "-P", str(self.port),
            f"{self.user}@{self.host}:{remote_path}",
            local_path
        ]
        try:
            subprocess.run(scp_cmd, check=True)
            print(f"Fetched {remote_path} to {local_path}")
        except subprocess.CalledProcessError as e:
            print(f"Error fetching file: {e}")
    
    def monitor(self):
        """Real-time monitoring"""
        print("Starting monitoring (Ctrl+C to stop)...")
        ssh_cmd = [
            "ssh",
            "-p", str(self.port),
            f"{self.user}@{self.host}",
            "htop"
        ]
        try:
            subprocess.run(ssh_cmd)
        except KeyboardInterrupt:
            print("\nMonitoring stopped")
    
    def interactive_shell(self):
        """Open interactive SSH shell"""
        ssh_cmd = [
            "ssh",
            "-p", str(self.port),
            f"{self.user}@{self.host}"
        ]
        subprocess.run(ssh_cmd)

def main():
    parser = argparse.ArgumentParser(description="Android Server Control Client")
    parser.add_argument("host", help="Android server IP address")
    parser.add_argument("-p", "--port", type=int, default=8022, help="SSH port (default: 8022)")
    parser.add_argument("-u", "--user", help="SSH username")
    
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    # Info command
    subparsers.add_parser("info", help="Get system information")
    
    # Service command
    service_parser = subparsers.add_parser("service", help="Control services")
    service_parser.add_argument("action", choices=["start", "stop", "status"], help="Service action")
    
    # Deploy command
    deploy_parser = subparsers.add_parser("deploy", help="Deploy file to server")
    deploy_parser.add_argument("local", help="Local file path")
    deploy_parser.add_argument("remote", help="Remote file path")
    
    # Fetch command
    fetch_parser = subparsers.add_parser("fetch", help="Fetch file from server")
    fetch_parser.add_argument("remote", help="Remote file path")
    fetch_parser.add_argument("local", help="Local file path")
    
    # Monitor command
    subparsers.add_parser("monitor", help="Real-time resource monitoring")
    
    # Shell command
    subparsers.add_parser("shell", help="Open interactive shell")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    client = AndroidServerClient(args.host, args.port, args.user)
    
    if args.command == "info":
        client.get_system_info()
    elif args.command == "service":
        client.service_control(args.action)
    elif args.command == "deploy":
        client.deploy_file(args.local, args.remote)
    elif args.command == "fetch":
        client.fetch_file(args.remote, args.local)
    elif args.command == "monitor":
        client.monitor()
    elif args.command == "shell":
        client.interactive_shell()

if __name__ == "__main__":
    main()
