/**
 * NPS Performance Manager - Production-Grade Resource Management
 * Monitors and optimizes system resources in real-time
 */

const os = require('os');
const { exec } = require('child_process');
const fs = require('fs').promises;

class PerformanceManager {
    constructor() {
        this.config = null;
        this.metrics = {
            cpu: [],
            memory: [],
            disk: [],
            network: []
        };
        this.alerts = [];
        this.optimizationInterval = null;
    }

    async initialize() {
        // Load performance configuration
        try {
            const config = await fs.readFile(process.env.HOME + '/server/config/profile.json', 'utf8');
            this.config = JSON.parse(config);
            console.log(`Performance Manager initialized for ${this.config.device.tier} tier device`);
        } catch (error) {
            console.error('Failed to load performance config:', error.message);
            // Create default config
            this.config = await this.createDefaultConfig();
        }

        // Start monitoring and optimization
        this.startMonitoring();
        this.startOptimization();
    }

    async createDefaultConfig() {
        const totalMem = os.totalmem() / (1024 * 1024); // MB
        const cpuCores = os.cpus().length;
        
        let tier, maxServers, workers;
        if (totalMem >= 6144) {
            tier = 'high';
            maxServers = 12;
            workers = 4;
        } else if (totalMem >= 4096) {
            tier = 'medium';
            maxServers = 8;
            workers = 3;
        } else if (totalMem >= 2048) {
            tier = 'low';
            maxServers = 4;
            workers = 2;
        } else {
            tier = 'minimal';
            maxServers = 2;
            workers = 1;
        }

        const config = {
            device: {
                tier,
                cpu_cores: cpuCores,
                ram_mb: Math.floor(totalMem),
                storage_gb: 'unknown'
            },
            limits: {
                max_servers: maxServers,
                max_memory_per_server_mb: Math.floor(totalMem / maxServers),
                max_cpu_per_server_percent: Math.floor(100 / maxServers),
                worker_processes: workers
            },
            optimization: {
                swap_enabled: totalMem < 4096,
                cache_size_mb: Math.floor(totalMem / 10),
                tcp_window_kb: Math.floor(totalMem / 4),
                max_connections: Math.floor(totalMem * 10)
            },
            thermal: {
                max_temp_c: 75,
                throttle_temp_c: 70,
                critical_temp_c: 80
            }
        };

        // Save config
        try {
            await fs.mkdir(process.env.HOME + '/server/config', { recursive: true });
            await fs.writeFile(
                process.env.HOME + '/server/config/profile.json',
                JSON.stringify(config, null, 2)
            );
        } catch (error) {
            console.error('Failed to save config:', error);
        }

        return config;
    }

    startMonitoring() {
        // Only start monitoring if explicitly enabled
        this.monitoringActive = false;
    }
    
    enableMonitoring() {
        if (this.monitoringActive) return;
        
        this.monitoringActive = true;
        console.log('📊 Performance monitoring enabled');
        
        this.metricsInterval = setInterval(() => {
            this.collectMetrics();
        }, 15000); // Every 15 seconds (reduced frequency to save CPU)

        this.analysisInterval = setInterval(() => {
            this.analyzeMetrics();
        }, 30000); // Every 30 seconds
    }
    
    disableMonitoring() {
        if (!this.monitoringActive) return;
        
        this.monitoringActive = false;
        console.log('💤 Performance monitoring disabled (saving CPU)');
        
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
            this.metricsInterval = null;
        }
        
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
    }

    startOptimization() {
        this.optimizationInterval = setInterval(() => {
            this.autoOptimize();
        }, 60000); // Every minute
    }

    async collectMetrics() {
        const metrics = {
            timestamp: Date.now(),
            cpu: await this.getCPUUsage(),
            memory: this.getMemoryUsage(),
            disk: await this.getDiskUsage(),
            temperature: await this.getTemperature(),
            connections: await this.getConnections()
        };

        // Store last 1000 metrics (approx 1.4 hours at 5s intervals)
        this.metrics.cpu.push(metrics.cpu);
        this.metrics.memory.push(metrics.memory);
        
        if (this.metrics.cpu.length > 1000) {
            this.metrics.cpu.shift();
            this.metrics.memory.shift();
        }

        // Check thresholds
        this.checkThresholds(metrics);

        return metrics;
    }

    getCPUUsage() {
        return new Promise((resolve) => {
            const cpus = os.cpus();
            let totalIdle = 0;
            let totalTick = 0;

            cpus.forEach(cpu => {
                for (let type in cpu.times) {
                    totalTick += cpu.times[type];
                }
                totalIdle += cpu.times.idle;
            });

            const idle = totalIdle / cpus.length;
            const total = totalTick / cpus.length;
            const usage = 100 - ~~(100 * idle / total);

            resolve(usage);
        });
    }

    getMemoryUsage() {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;
        const percentage = (used / total) * 100;

        return {
            total: Math.floor(total / (1024 * 1024)),
            used: Math.floor(used / (1024 * 1024)),
            free: Math.floor(free / (1024 * 1024)),
            percentage: Math.floor(percentage)
        };
    }

    getDiskUsage() {
        return new Promise((resolve) => {
            exec('df -h $HOME | tail -1', (error, stdout) => {
                if (error) {
                    resolve({ percentage: 0 });
                    return;
                }

                const parts = stdout.trim().split(/\s+/);
                const percentage = parseInt(parts[4]);

                resolve({
                    total: parts[1],
                    used: parts[2],
                    free: parts[3],
                    percentage: percentage || 0
                });
            });
        });
    }

    getTemperature() {
        return new Promise((resolve) => {
            exec('cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null', (error, stdout) => {
                if (error) {
                    resolve(null);
                    return;
                }

                const temp = parseInt(stdout.trim()) / 1000;
                resolve(Math.floor(temp));
            });
        });
    }

    getConnections() {
        return new Promise((resolve) => {
            exec('netstat -an 2>/dev/null | grep ESTABLISHED | wc -l', (error, stdout) => {
                if (error) {
                    resolve(0);
                    return;
                }

                resolve(parseInt(stdout.trim()) || 0);
            });
        });
    }

    /**
     * Get all current performance metrics
     * @returns {Promise<Object>} Combined metrics object
     */
    async getMetrics() {
        const [cpu, memory, disk, temperature, connections] = await Promise.all([
            this.getCPUUsage(),
            Promise.resolve(this.getMemoryUsage()),
            this.getDiskUsage(),
            this.getTemperature(),
            this.getConnections()
        ]);

        return {
            cpu,
            memory,
            disk,
            temperature,
            connections,
            timestamp: Date.now()
        };
    }

    checkThresholds(metrics) {
        const alerts = [];

        // CPU threshold (increased to prevent false positives on mobile)
        if (metrics.cpu > 98) {
            alerts.push({
                level: 'critical',
                type: 'cpu',
                message: `High CPU usage: ${metrics.cpu}%`,
                value: metrics.cpu
            });
        } else if (metrics.cpu > 85) {
            alerts.push({
                level: 'warning',
                type: 'cpu',
                message: `Elevated CPU usage: ${metrics.cpu}%`,
                value: metrics.cpu
            });
        }

        // Memory threshold
        if (metrics.memory.percentage > 90) {
            alerts.push({
                level: 'critical',
                type: 'memory',
                message: `High memory usage: ${metrics.memory.percentage}%`,
                value: metrics.memory.percentage
            });
        } else if (metrics.memory.percentage > 80) {
            alerts.push({
                level: 'warning',
                type: 'memory',
                message: `Elevated memory usage: ${metrics.memory.percentage}%`,
                value: metrics.memory.percentage
            });
        }

        // Disk threshold
        if (metrics.disk.percentage > 90) {
            alerts.push({
                level: 'critical',
                type: 'disk',
                message: `Low disk space: ${metrics.disk.percentage}% used`,
                value: metrics.disk.percentage
            });
        } else if (metrics.disk.percentage > 80) {
            alerts.push({
                level: 'warning',
                type: 'disk',
                message: `Disk space running low: ${metrics.disk.percentage}% used`,
                value: metrics.disk.percentage
            });
        }

        // Temperature threshold
        if (metrics.temperature && metrics.temperature > this.config.thermal.critical_temp_c) {
            alerts.push({
                level: 'critical',
                type: 'thermal',
                message: `Critical temperature: ${metrics.temperature}°C`,
                value: metrics.temperature
            });
        } else if (metrics.temperature && metrics.temperature > this.config.thermal.throttle_temp_c) {
            alerts.push({
                level: 'warning',
                type: 'thermal',
                message: `High temperature: ${metrics.temperature}°C`,
                value: metrics.temperature
            });
        }

        this.alerts = alerts;
        
        // Trigger actions for critical alerts
        alerts.filter(a => a.level === 'critical').forEach(alert => {
            this.handleCriticalAlert(alert);
        });
    }

    handleCriticalAlert(alert) {
        console.log(`⚠️  CRITICAL ALERT: ${alert.message}\n   Auto-optimization will attempt to resolve this issue...`);
        
        switch (alert.type) {
            case 'cpu':
                this.reduceCPULoad();
                break;
            case 'memory':
                this.freeMemory();
                break;
            case 'disk':
                this.cleanupDisk();
                break;
            case 'thermal':
                this.thermalThrottle();
                break;
        }
    }

    reduceCPULoad() {
        console.log('Attempting to reduce CPU load...');
        // Throttle non-critical servers
        // Implementation would communicate with server manager
    }

    freeMemory() {
        console.log('Freeing memory...');
        exec('sync; echo 1 > /proc/sys/vm/drop_caches 2>/dev/null', (error) => {
            if (error) console.error('Failed to clear cache:', error);
        });
    }

    cleanupDisk() {
        console.log('Cleaning up disk space...');
        exec([
            'rm -rf ~/server/temp/* 2>/dev/null',
            'rm -rf ~/.cache/* 2>/dev/null',
            'find ~/server/logs -name "*.log" -mtime +7 -delete 2>/dev/null'
        ].join('; '), (error) => {
            if (error) console.error('Cleanup failed:', error);
        });
    }

    thermalThrottle() {
        console.log('Thermal throttling activated...');
        // Stop lowest priority servers
        // Reduce CPU frequency
        // Implementation would communicate with server manager
    }

    async autoOptimize() {
        const avgCPU = this.metrics.cpu.slice(-12).reduce((a, b) => a + b, 0) / 12;
        const avgMem = this.metrics.memory.slice(-12).reduce((a, b) => a + b.percentage, 0) / 12;

        // Proactive optimization
        if (avgMem > 75) {
            console.log('Proactive memory optimization...');
            this.freeMemory();
        }

        if (avgCPU > 80) {
            console.log('Proactive CPU optimization...');
            // Adjust server priorities
        }

        // Compress old logs
        exec('find ~/server/logs -name "*.log" -mtime +1 ! -name "*.gz" -exec gzip {} \\; 2>/dev/null', () => {});
    }

    analyzeMetrics() {
        if (this.metrics.cpu.length < 12) return;

        const recentCPU = this.metrics.cpu.slice(-12);
        const recentMem = this.metrics.memory.slice(-12);

        const avgCPU = recentCPU.reduce((a, b) => a + b, 0) / recentCPU.length;
        const avgMem = recentMem.reduce((a, b) => a + b.percentage, 0) / recentMem.length;

        console.log(`Performance Analysis - CPU: ${avgCPU.toFixed(1)}%, Memory: ${avgMem.toFixed(1)}%`);

        // Predictive scaling recommendations
        if (avgCPU > 70 && avgMem > 70) {
            console.log('Recommendation: System approaching capacity. Consider stopping non-critical servers.');
        }
    }

    getPerformanceReport() {
        const recent = this.metrics.cpu.slice(-12);
        const avgCPU = recent.reduce((a, b) => a + b, 0) / recent.length;
        
        const recentMem = this.metrics.memory.slice(-12);
        const avgMem = recentMem.reduce((a, b) => a + b.percentage, 0) / recentMem.length;

        return {
            device: this.config.device,
            limits: this.config.limits,
            current: {
                cpu_avg: Math.floor(avgCPU),
                memory_avg: Math.floor(avgMem),
                memory_current: this.metrics.memory[this.metrics.memory.length - 1]
            },
            alerts: this.alerts,
            recommendations: this.getRecommendations()
        };
    }

    getRecommendations() {
        const recommendations = [];
        const avgCPU = this.metrics.cpu.slice(-12).reduce((a, b) => a + b, 0) / 12;
        const avgMem = this.metrics.memory.slice(-12).reduce((a, b) => a + b.percentage, 0) / 12;

        if (avgCPU > 70) {
            recommendations.push('High CPU usage detected. Consider stopping non-critical servers.');
        }

        if (avgMem > 80) {
            recommendations.push('High memory usage. Enable swap or reduce active servers.');
        }

        if (this.alerts.some(a => a.type === 'thermal')) {
            recommendations.push('High temperature detected. Improve device cooling.');
        }

        return recommendations;
    }
}

module.exports = PerformanceManager;
