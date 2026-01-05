/**
 * NPS Network Manager - Network Performance & Traffic Management
 * Optimized for 86 Mbps down / 12 Mbps up connection
 * Manages bandwidth, connections, and network quality
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const EventEmitter = require('events');

class NetworkManager extends EventEmitter {
    constructor() {
        super();
        
        // Network specifications (from device specs)
        this.specs = {
            downloadMbps: 86,
            uploadMbps: 12,
            maxConnections: 1000,
            latencyMs: 33
        };

        // Current state
        this.state = {
            connections: 0,
            bandwidthUsage: {
                download: 0,
                upload: 0
            },
            activeServers: new Map(),
            trafficStats: {
                bytesReceived: 0,
                bytesSent: 0,
                packetsReceived: 0,
                packetsSent: 0
            },
            lastCheck: null
        };

        // QoS (Quality of Service) rules
        this.qosRules = new Map();
        
        // Bandwidth allocation per server
        this.allocations = new Map();
        
        this.checkInterval = 5000; // Check every 5 seconds
    }

    async initialize() {
        console.log('🌐 Network Manager initializing...');
        
        // Detect network interface
        await this.detectNetworkInterface();
        
        // Apply network optimizations
        await this.applyOptimizations();
        
        // Start monitoring
        this.startMonitoring();
        
        console.log('🌐 Network Manager active');
    }

    async detectNetworkInterface() {
        try {
            // Find primary network interface
            const { stdout } = await execAsync('ip route | grep default | awk \'{print $5}\' | head -1');
            this.primaryInterface = stdout.trim() || 'wlan0';
            console.log(`Primary network interface: ${this.primaryInterface}`);
        } catch (error) {
            this.primaryInterface = 'wlan0'; // Default to wlan0 on Android
        }
    }

    async applyOptimizations() {
        try {
            // TCP optimizations for better performance
            const optimizations = [
                // TCP window scaling
                'sysctl -w net.ipv4.tcp_window_scaling=1',
                
                // TCP timestamps
                'sysctl -w net.ipv4.tcp_timestamps=1',
                
                // TCP selective acknowledgments
                'sysctl -w net.ipv4.tcp_sack=1',
                
                // Increase TCP buffer sizes
                'sysctl -w net.core.rmem_max=16777216',
                'sysctl -w net.core.wmem_max=16777216',
                'sysctl -w net.ipv4.tcp_rmem="4096 87380 16777216"',
                'sysctl -w net.ipv4.tcp_wmem="4096 65536 16777216"',
                
                // TCP congestion control (BBR if available, otherwise cubic)
                'sysctl -w net.ipv4.tcp_congestion_control=bbr || sysctl -w net.ipv4.tcp_congestion_control=cubic',
                
                // Increase connection tracking
                'sysctl -w net.netfilter.nf_conntrack_max=1000000 2>/dev/null || true',
                
                // TCP keepalive settings
                'sysctl -w net.ipv4.tcp_keepalive_time=600',
                'sysctl -w net.ipv4.tcp_keepalive_intvl=60',
                'sysctl -w net.ipv4.tcp_keepalive_probes=3',
                
                // Reduce TIME_WAIT connections
                'sysctl -w net.ipv4.tcp_fin_timeout=30',
                'sysctl -w net.ipv4.tcp_tw_reuse=1'
            ];

            for (const cmd of optimizations) {
                try {
                    await execAsync(cmd);
                } catch {
                    // Some optimizations may fail without root, that's ok
                }
            }

            console.log('Applied network optimizations');
        } catch (error) {
            console.warn('Some network optimizations failed (may require root)');
        }
    }

    startMonitoring() {
        setInterval(async () => {
            await this.updateNetworkStats();
        }, this.checkInterval);
    }

    async updateNetworkStats() {
        try {
            // Get connection count
            const connections = await this.getConnectionCount();
            this.state.connections = connections;

            // Get traffic stats
            const traffic = await this.getTrafficStats();
            this.state.trafficStats = traffic;

            // Calculate bandwidth usage
            if (this.state.lastCheck) {
                const elapsed = (Date.now() - this.state.lastCheck) / 1000; // seconds
                const bytesReceivedDelta = traffic.bytesReceived - (this.state.previousTraffic?.bytesReceived || 0);
                const bytesSentDelta = traffic.bytesSent - (this.state.previousTraffic?.bytesSent || 0);

                // Convert to Mbps
                this.state.bandwidthUsage.download = (bytesReceivedDelta * 8) / (elapsed * 1000000);
                this.state.bandwidthUsage.upload = (bytesSentDelta * 8) / (elapsed * 1000000);
            }

            this.state.previousTraffic = { ...traffic };
            this.state.lastCheck = Date.now();

            // Check thresholds
            this.checkThresholds();
        } catch (error) {
            console.error('Network stats update failed:', error.message);
        }
    }

    async getConnectionCount() {
        try {
            const { stdout } = await execAsync('netstat -an 2>/dev/null | grep ESTABLISHED | wc -l');
            return parseInt(stdout.trim()) || 0;
        } catch {
            return 0;
        }
    }

    async getTrafficStats() {
        try {
            const { stdout } = await execAsync(`cat /sys/class/net/${this.primaryInterface}/statistics/rx_bytes`);
            const { stdout: tx } = await execAsync(`cat /sys/class/net/${this.primaryInterface}/statistics/tx_bytes`);
            const { stdout: rxPackets } = await execAsync(`cat /sys/class/net/${this.primaryInterface}/statistics/rx_packets`);
            const { stdout: txPackets } = await execAsync(`cat /sys/class/net/${this.primaryInterface}/statistics/tx_packets`);

            return {
                bytesReceived: parseInt(stdout.trim()) || 0,
                bytesSent: parseInt(tx.trim()) || 0,
                packetsReceived: parseInt(rxPackets.trim()) || 0,
                packetsSent: parseInt(txPackets.trim()) || 0
            };
        } catch {
            return {
                bytesReceived: 0,
                bytesSent: 0,
                packetsReceived: 0,
                packetsSent: 0
            };
        }
    }

    checkThresholds() {
        // Check if we're approaching bandwidth limits
        const downloadUsage = (this.state.bandwidthUsage.download / this.specs.downloadMbps) * 100;
        const uploadUsage = (this.state.bandwidthUsage.upload / this.specs.uploadMbps) * 100;

        if (uploadUsage > 80) {
            this.emit('network:bandwidth-warning', {
                type: 'upload',
                usage: uploadUsage,
                message: 'Upload bandwidth usage over 80%'
            });
        }

        if (downloadUsage > 80) {
            this.emit('network:bandwidth-warning', {
                type: 'download',
                usage: downloadUsage,
                message: 'Download bandwidth usage over 80%'
            });
        }

        // Check connection count
        const connectionUsage = (this.state.connections / this.specs.maxConnections) * 100;
        if (connectionUsage > 80) {
            this.emit('network:connections-warning', {
                connections: this.state.connections,
                limit: this.specs.maxConnections,
                message: 'Connection count over 80% of limit'
            });
        }
    }

    /**
     * Allocate bandwidth for a server
     */
    allocateBandwidth(serverId, requirements) {
        const { downloadMbps = 0, uploadMbps = 0, priority = 'normal' } = requirements;

        // Check if bandwidth is available
        const currentDownload = Array.from(this.allocations.values())
            .reduce((sum, alloc) => sum + alloc.downloadMbps, 0);
        const currentUpload = Array.from(this.allocations.values())
            .reduce((sum, alloc) => sum + alloc.uploadMbps, 0);

        const availableDownload = this.specs.downloadMbps * 0.9 - currentDownload; // Reserve 10%
        const availableUpload = this.specs.uploadMbps * 0.9 - currentUpload; // Reserve 10%

        if (downloadMbps > availableDownload || uploadMbps > availableUpload) {
            throw new Error('Insufficient bandwidth available');
        }

        // Create allocation
        const allocation = {
            serverId,
            downloadMbps,
            uploadMbps,
            priority,
            timestamp: Date.now()
        };

        this.allocations.set(serverId, allocation);
        console.log(`Allocated bandwidth for ${serverId}: ${downloadMbps}↓ / ${uploadMbps}↑ Mbps`);

        return allocation;
    }

    /**
     * Release bandwidth allocation
     */
    releaseBandwidth(serverId) {
        this.allocations.delete(serverId);
        console.log(`Released bandwidth for ${serverId}`);
    }

    /**
     * Apply QoS (traffic shaping) - requires root
     */
    async applyQoS(serverId, port, priority = 'normal') {
        try {
            // Use tc (traffic control) to shape traffic
            // This requires root access and may not work on all devices
            
            const priorityMap = {
                'high': 1,
                'normal': 2,
                'low': 3
            };

            const prioClass = priorityMap[priority] || 2;

            // Mark packets from this port
            await execAsync(`iptables -t mangle -A OUTPUT -p tcp --sport ${port} -j CLASSIFY --set-class 1:${prioClass}`);
            
            this.qosRules.set(serverId, { port, priority });
            console.log(`Applied QoS for ${serverId} on port ${port} with priority ${priority}`);
            
            return true;
        } catch (error) {
            console.warn('QoS application failed (requires root)');
            return false;
        }
    }

    /**
     * Remove QoS rule
     */
    async removeQoS(serverId) {
        const rule = this.qosRules.get(serverId);
        if (!rule) return;

        try {
            await execAsync(`iptables -t mangle -D OUTPUT -p tcp --sport ${rule.port} -j CLASSIFY --set-class 1:${rule.priority}`);
            this.qosRules.delete(serverId);
        } catch (error) {
            console.warn('QoS removal failed');
        }
    }

    /**
     * Get network performance metrics
     */
    getMetrics() {
        return {
            connections: this.state.connections,
            bandwidth: {
                download: {
                    current: this.state.bandwidthUsage.download.toFixed(2),
                    max: this.specs.downloadMbps,
                    usage: ((this.state.bandwidthUsage.download / this.specs.downloadMbps) * 100).toFixed(1)
                },
                upload: {
                    current: this.state.bandwidthUsage.upload.toFixed(2),
                    max: this.specs.uploadMbps,
                    usage: ((this.state.bandwidthUsage.upload / this.specs.uploadMbps) * 100).toFixed(1)
                }
            },
            traffic: {
                received: this.formatBytes(this.state.trafficStats.bytesReceived),
                sent: this.formatBytes(this.state.trafficStats.bytesSent),
                packets: {
                    received: this.state.trafficStats.packetsReceived,
                    sent: this.state.trafficStats.packetsSent
                }
            },
            allocations: Array.from(this.allocations.values())
        };
    }

    /**
     * Test network latency
     */
    async testLatency(host = '8.8.8.8') {
        try {
            const { stdout } = await execAsync(`ping -c 4 ${host} | tail -1 | awk -F '/' '{print $5}'`);
            const latency = parseFloat(stdout.trim());
            return isNaN(latency) ? null : latency;
        } catch {
            return null;
        }
    }

    /**
     * Get bandwidth recommendations
     */
    getBandwidthRecommendations() {
        const metrics = this.getMetrics();
        const recommendations = [];

        // Check upload bandwidth (this is the main constraint on the TCL T608G)
        if (parseFloat(metrics.bandwidth.upload.usage) > 80) {
            recommendations.push({
                type: 'warning',
                resource: 'upload-bandwidth',
                message: 'Upload bandwidth near capacity',
                suggestion: 'Limit number of upload-heavy services (file sharing, backups)'
            });
        }

        // Check connection count
        if (this.state.connections > this.specs.maxConnections * 0.8) {
            recommendations.push({
                type: 'warning',
                resource: 'connections',
                message: 'High connection count',
                suggestion: 'Consider connection pooling or rate limiting'
            });
        }

        return recommendations;
    }

    /**
     * Format bytes to human-readable format
     */
    formatBytes(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Check if network can handle a new server
     */
    canAllocate(requirements) {
        const { downloadMbps = 0, uploadMbps = 0, connections = 0 } = requirements;

        const currentDownload = Array.from(this.allocations.values())
            .reduce((sum, alloc) => sum + alloc.downloadMbps, 0);
        const currentUpload = Array.from(this.allocations.values())
            .reduce((sum, alloc) => sum + alloc.uploadMbps, 0);

        const availableDownload = this.specs.downloadMbps * 0.9 - currentDownload;
        const availableUpload = this.specs.uploadMbps * 0.9 - currentUpload;
        const availableConnections = this.specs.maxConnections - this.state.connections;

        return {
            canAllocate: downloadMbps <= availableDownload && 
                        uploadMbps <= availableUpload &&
                        connections <= availableConnections,
            available: {
                downloadMbps: availableDownload,
                uploadMbps: availableUpload,
                connections: availableConnections
            },
            required: requirements
        };
    }

    /**
     * Get network health status
     */
    async getHealthStatus() {
        const latency = await this.testLatency();
        const metrics = this.getMetrics();

        let status = 'healthy';
        const issues = [];

        if (latency && latency > 100) {
            status = 'degraded';
            issues.push('High latency detected');
        }

        if (parseFloat(metrics.bandwidth.upload.usage) > 90) {
            status = 'degraded';
            issues.push('Upload bandwidth saturated');
        }

        if (this.state.connections > this.specs.maxConnections * 0.9) {
            status = 'degraded';
            issues.push('Connection limit approaching');
        }

        return {
            status,
            latency,
            issues,
            metrics
        };
    }
}

module.exports = NetworkManager;
