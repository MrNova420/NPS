/**
 * Enterprise Monitoring & Alerting System
 * Real-time metrics, anomaly detection, predictive analytics
 */

const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class MonitoringManager {
    constructor() {
        this.metrics = {
            system: [],
            servers: new Map(),
            network: [],
            security: []
        };
        
        this.alerts = [];
        this.thresholds = {
            cpu: { warning: 70, critical: 90 },
            memory: { warning: 80, critical: 95 },
            disk: { warning: 85, critical: 95 },
            network: { warning: 80, critical: 95 },
            temperature: { warning: 70, critical: 85 }
        };

        this.alertChannels = [];
        this.anomalyDetection = true;
        this.predictiveAnalytics = true;
        this.baselineMetrics = null;
    }

    async initialize() {
        console.log('📊 Monitoring Manager initializing...');
        
        // Load config
        try {
            const configPath = process.env.HOME + '/server/config/monitoring.json';
            const data = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(data);
            this.thresholds = config.thresholds || this.thresholds;
            this.alertChannels = config.alertChannels || [];
        } catch (error) {
            await this.createDefaultConfig();
        }

        // Start monitoring
        this.startSystemMonitoring();
        this.startAnomalyDetection();
        this.startHealthChecks();
        
        // Calculate baseline after 5 minutes
        setTimeout(() => this.calculateBaseline(), 300000);
        
        console.log('📊 Monitoring Manager active');
    }

    startSystemMonitoring() {
        // Collect metrics every 5 seconds
        setInterval(async () => {
            const metrics = await this.collectSystemMetrics();
            this.metrics.system.push(metrics);
            
            // Keep last 1 hour of data (720 entries at 5s intervals)
            if (this.metrics.system.length > 720) {
                this.metrics.system.shift();
            }

            // Check thresholds
            this.checkThresholds(metrics);
        }, 5000);
    }

    async collectSystemMetrics() {
        const os = require('os');
        
        const metrics = {
            timestamp: Date.now(),
            cpu: await this.getCPUUsage(),
            memory: this.getMemoryUsage(),
            disk: await this.getDiskUsage(),
            network: await this.getNetworkStats(),
            temperature: await this.getTemperature(),
            load: os.loadavg(),
            uptime: os.uptime(),
            processes: await this.getProcessCount()
        };

        return metrics;
    }

    async getCPUUsage() {
        try {
            const { stdout } = await execAsync("top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'");
            return parseFloat(stdout.trim()) || 0;
        } catch {
            return 0;
        }
    }

    getMemoryUsage() {
        const os = require('os');
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;
        
        return {
            total: Math.round(total / 1024 / 1024),
            used: Math.round(used / 1024 / 1024),
            free: Math.round(free / 1024 / 1024),
            percentage: Math.round((used / total) * 100)
        };
    }

    async getDiskUsage() {
        try {
            const { stdout } = await execAsync("df -h $HOME | tail -1 | awk '{print $5}' | sed 's/%//'");
            const percentage = parseInt(stdout.trim());
            return {
                percentage,
                path: process.env.HOME
            };
        } catch {
            return { percentage: 0, path: process.env.HOME };
        }
    }

    async getNetworkStats() {
        try {
            const { stdout } = await execAsync("cat /proc/net/dev | grep wlan0 | awk '{print $2,$10}'");
            const [rx, tx] = stdout.trim().split(' ').map(Number);
            return {
                rx: Math.round(rx / 1024 / 1024), // MB
                tx: Math.round(tx / 1024 / 1024), // MB
                timestamp: Date.now()
            };
        } catch {
            return { rx: 0, tx: 0, timestamp: Date.now() };
        }
    }

    async getTemperature() {
        try {
            const { stdout } = await execAsync("cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null");
            return parseInt(stdout.trim()) / 1000; // Convert to Celsius
        } catch {
            return 0;
        }
    }

    async getProcessCount() {
        try {
            const { stdout } = await execAsync("ps aux | wc -l");
            return parseInt(stdout.trim());
        } catch {
            return 0;
        }
    }

    checkThresholds(metrics) {
        const alerts = [];

        // CPU check
        if (metrics.cpu >= this.thresholds.cpu.critical) {
            alerts.push({
                level: 'critical',
                type: 'cpu',
                message: `CPU usage critical: ${metrics.cpu}%`,
                value: metrics.cpu,
                threshold: this.thresholds.cpu.critical
            });
        } else if (metrics.cpu >= this.thresholds.cpu.warning) {
            alerts.push({
                level: 'warning',
                type: 'cpu',
                message: `CPU usage high: ${metrics.cpu}%`,
                value: metrics.cpu,
                threshold: this.thresholds.cpu.warning
            });
        }

        // Memory check
        if (metrics.memory.percentage >= this.thresholds.memory.critical) {
            alerts.push({
                level: 'critical',
                type: 'memory',
                message: `Memory usage critical: ${metrics.memory.percentage}%`,
                value: metrics.memory.percentage,
                threshold: this.thresholds.memory.critical
            });
        } else if (metrics.memory.percentage >= this.thresholds.memory.warning) {
            alerts.push({
                level: 'warning',
                type: 'memory',
                message: `Memory usage high: ${metrics.memory.percentage}%`,
                value: metrics.memory.percentage,
                threshold: this.thresholds.memory.warning
            });
        }

        // Disk check
        if (metrics.disk.percentage >= this.thresholds.disk.critical) {
            alerts.push({
                level: 'critical',
                type: 'disk',
                message: `Disk space critical: ${metrics.disk.percentage}%`,
                value: metrics.disk.percentage,
                threshold: this.thresholds.disk.critical
            });
        }

        // Temperature check
        if (metrics.temperature >= this.thresholds.temperature.critical) {
            alerts.push({
                level: 'critical',
                type: 'temperature',
                message: `Temperature critical: ${metrics.temperature}°C`,
                value: metrics.temperature,
                threshold: this.thresholds.temperature.critical
            });
        }

        // Process alerts
        alerts.forEach(alert => this.createAlert(alert));
    }

    createAlert(alert) {
        const alertObj = {
            id: Date.now() + Math.random(),
            ...alert,
            timestamp: new Date().toISOString(),
            status: 'active',
            acknowledged: false
        };

        this.alerts.push(alertObj);
        
        // Keep last 1000 alerts
        if (this.alerts.length > 1000) {
            this.alerts.shift();
        }

        console.log(`🚨 [${alert.level.toUpperCase()}] ${alert.message}`);

        // Send to alert channels
        this.sendAlert(alertObj);

        return alertObj;
    }

    async sendAlert(alert) {
        for (const channel of this.alertChannels) {
            try {
                switch (channel.type) {
                    case 'webhook':
                        await this.sendWebhook(channel.url, alert);
                        break;
                    case 'email':
                        await this.sendEmail(channel.config, alert);
                        break;
                    case 'slack':
                        await this.sendSlack(channel.webhook, alert);
                        break;
                    case 'discord':
                        await this.sendDiscord(channel.webhook, alert);
                        break;
                }
            } catch (error) {
                console.error(`Failed to send alert to ${channel.type}:`, error.message);
            }
        }
    }

    async sendWebhook(url, alert) {
        const https = require('https');
        const http = require('http');
        const client = url.startsWith('https') ? https : http;

        return new Promise((resolve, reject) => {
            const data = JSON.stringify(alert);
            const urlObj = new URL(url);
            
            const req = client.request({
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length
                }
            }, (res) => {
                resolve();
            });

            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }

    startAnomalyDetection() {
        if (!this.anomalyDetection) return;

        setInterval(() => {
            this.detectAnomalies();
        }, 30000); // Every 30 seconds
    }

    detectAnomalies() {
        if (!this.baselineMetrics || this.metrics.system.length < 100) return;

        const recent = this.metrics.system.slice(-20); // Last 20 samples
        const avgCPU = recent.reduce((sum, m) => sum + m.cpu, 0) / recent.length;
        const avgMemory = recent.reduce((sum, m) => sum + m.memory.percentage, 0) / recent.length;

        // Check for sudden spikes
        if (avgCPU > this.baselineMetrics.cpu * 2) {
            this.createAlert({
                level: 'warning',
                type: 'anomaly',
                message: `Anomaly detected: CPU usage spike (${avgCPU.toFixed(1)}% vs baseline ${this.baselineMetrics.cpu.toFixed(1)}%)`,
                value: avgCPU
            });
        }

        if (avgMemory > this.baselineMetrics.memory * 1.5) {
            this.createAlert({
                level: 'warning',
                type: 'anomaly',
                message: `Anomaly detected: Memory usage spike (${avgMemory.toFixed(1)}% vs baseline ${this.baselineMetrics.memory.toFixed(1)}%)`,
                value: avgMemory
            });
        }
    }

    calculateBaseline() {
        if (this.metrics.system.length < 100) return;

        const samples = this.metrics.system.slice(-360); // Last 30 minutes
        
        this.baselineMetrics = {
            cpu: samples.reduce((sum, m) => sum + m.cpu, 0) / samples.length,
            memory: samples.reduce((sum, m) => sum + m.memory.percentage, 0) / samples.length,
            disk: samples.reduce((sum, m) => sum + m.disk.percentage, 0) / samples.length,
            timestamp: Date.now()
        };

        console.log('📊 Baseline metrics calculated:', this.baselineMetrics);
    }

    startHealthChecks() {
        setInterval(async () => {
            await this.performHealthCheck();
        }, 60000); // Every minute
    }

    async performHealthCheck() {
        const checks = {
            timestamp: Date.now(),
            overall: 'healthy',
            checks: {}
        };

        // Check disk space
        const disk = await this.getDiskUsage();
        checks.checks.disk = {
            status: disk.percentage < 90 ? 'healthy' : 'unhealthy',
            value: disk.percentage
        };

        // Check memory
        const memory = this.getMemoryUsage();
        checks.checks.memory = {
            status: memory.percentage < 90 ? 'healthy' : 'unhealthy',
            value: memory.percentage
        };

        // Check processes
        const processes = await this.getProcessCount();
        checks.checks.processes = {
            status: processes < 300 ? 'healthy' : 'warning',
            value: processes
        };

        // Overall status
        const unhealthy = Object.values(checks.checks).filter(c => c.status === 'unhealthy');
        if (unhealthy.length > 0) {
            checks.overall = 'unhealthy';
        } else if (Object.values(checks.checks).some(c => c.status === 'warning')) {
            checks.overall = 'degraded';
        }

        return checks;
    }

    // Get current status
    getStatus() {
        const latest = this.metrics.system[this.metrics.system.length - 1] || {};
        const activeAlerts = this.alerts.filter(a => a.status === 'active');
        
        return {
            timestamp: Date.now(),
            healthy: activeAlerts.filter(a => a.level === 'critical').length === 0,
            metrics: latest,
            alerts: {
                total: this.alerts.length,
                active: activeAlerts.length,
                critical: activeAlerts.filter(a => a.level === 'critical').length,
                warning: activeAlerts.filter(a => a.level === 'warning').length
            },
            baseline: this.baselineMetrics,
            uptime: process.uptime()
        };
    }

    // Get metrics for time range
    getMetrics(from, to) {
        return this.metrics.system.filter(m => 
            m.timestamp >= from && m.timestamp <= to
        );
    }

    // Get alerts
    getAlerts(filter = {}) {
        let alerts = [...this.alerts];

        if (filter.level) {
            alerts = alerts.filter(a => a.level === filter.level);
        }

        if (filter.type) {
            alerts = alerts.filter(a => a.type === filter.type);
        }

        if (filter.status) {
            alerts = alerts.filter(a => a.status === filter.status);
        }

        return alerts.slice(-100); // Last 100
    }

    // Acknowledge alert
    acknowledgeAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
            alert.status = 'acknowledged';
            console.log(`✓ Alert ${alertId} acknowledged`);
        }
    }

    async createDefaultConfig() {
        const config = {
            thresholds: this.thresholds,
            alertChannels: [],
            anomalyDetection: true,
            predictiveAnalytics: true
        };

        const configPath = process.env.HOME + '/server/config/monitoring.json';
        await fs.mkdir(require('path').dirname(configPath), { recursive: true });
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    }
}

module.exports = MonitoringManager;
