/**
 * NPS Health Check System - Server Health Monitoring
 * Monitors individual server health and provides auto-recovery
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const http = require('http');
const https = require('https');
const EventEmitter = require('events');

class HealthCheckSystem extends EventEmitter {
    constructor() {
        super();
        this.checks = new Map();
        this.checkInterval = 30000; // 30 seconds
        this.timeoutMs = 5000; // 5 second timeout per check
        this.unhealthyThreshold = 3; // Mark unhealthy after 3 consecutive failures
        this.checkTimer = null;
    }

    async initialize() {
        console.log('🏥 Health Check System initializing...');
        this.startChecking();
        console.log('🏥 Health Check System active');
    }

    /**
     * Register a server for health checking
     */
    register(server) {
        const check = {
            serverId: server.id,
            serverName: server.name,
            type: server.type,
            port: server.port,
            status: 'unknown',
            consecutiveFailures: 0,
            lastCheck: null,
            lastSuccess: null,
            lastFailure: null,
            totalChecks: 0,
            successCount: 0,
            failureCount: 0,
            avgResponseTime: 0,
            history: []
        };

        this.checks.set(server.id, check);
        console.log(`Registered health check for ${server.name}`);
    }

    /**
     * Unregister a server from health checking
     */
    unregister(serverId) {
        this.checks.delete(serverId);
        console.log(`Unregistered health check for server ${serverId}`);
    }

    /**
     * Start periodic health checking
     */
    startChecking() {
        this.checkTimer = setInterval(async () => {
            await this.performHealthChecks();
        }, this.checkInterval);
    }

    /**
     * Stop health checking
     */
    stopChecking() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }
    }

    /**
     * Perform health checks on all registered servers
     */
    async performHealthChecks() {
        const promises = Array.from(this.checks.keys()).map(serverId => 
            this.checkServer(serverId).catch(err => 
                console.error(`Health check failed for ${serverId}:`, err.message)
            )
        );

        await Promise.all(promises);
    }

    /**
     * Check health of a single server
     */
    async checkServer(serverId) {
        const check = this.checks.get(serverId);
        if (!check) return;

        const startTime = Date.now();
        let healthy = false;
        let error = null;

        try {
            // Determine check method based on server type
            switch (check.type) {
                case 'nodejs-api':
                case 'flask-app':
                case 'web-static':
                    healthy = await this.checkHTTP(check.port);
                    break;
                
                case 'postgresql':
                    healthy = await this.checkPostgreSQL(check.port);
                    break;
                
                case 'redis-cache':
                    healthy = await this.checkRedis(check.port);
                    break;
                
                case 'minecraft':
                    healthy = await this.checkMinecraft(check.port);
                    break;
                
                default:
                    // Generic port check
                    healthy = await this.checkPort(check.port);
            }
        } catch (err) {
            error = err.message;
            healthy = false;
        }

        const responseTime = Date.now() - startTime;

        // Update check statistics
        check.totalChecks++;
        check.lastCheck = Date.now();
        
        if (healthy) {
            check.consecutiveFailures = 0;
            check.successCount++;
            check.lastSuccess = Date.now();
            check.status = 'healthy';
        } else {
            check.consecutiveFailures++;
            check.failureCount++;
            check.lastFailure = Date.now();
            check.lastError = error;
            
            if (check.consecutiveFailures >= this.unhealthyThreshold) {
                check.status = 'unhealthy';
                this.emit('server:unhealthy', { 
                    serverId, 
                    name: check.serverName,
                    failures: check.consecutiveFailures,
                    error
                });
            } else {
                check.status = 'degraded';
            }
        }

        // Update average response time
        check.avgResponseTime = Math.round(
            (check.avgResponseTime * (check.totalChecks - 1) + responseTime) / check.totalChecks
        );

        // Add to history
        check.history.push({
            timestamp: Date.now(),
            healthy,
            responseTime,
            error
        });

        // Trim history (keep last 100 checks)
        if (check.history.length > 100) {
            check.history.shift();
        }

        return check;
    }

    /**
     * Check HTTP/HTTPS endpoint
     */
    async checkHTTP(port, path = '/health') {
        return new Promise((resolve) => {
            const options = {
                host: 'localhost',
                port: port,
                path: path,
                method: 'GET',
                timeout: this.timeoutMs
            };

            const req = http.request(options, (res) => {
                resolve(res.statusCode >= 200 && res.statusCode < 500);
            });

            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });

            req.end();
        });
    }

    /**
     * Check PostgreSQL database
     */
    async checkPostgreSQL(port) {
        try {
            const { stdout } = await execAsync(`psql -h localhost -p ${port} -U postgres -c "SELECT 1;" 2>&1`);
            return stdout.includes('1 row');
        } catch {
            return false;
        }
    }

    /**
     * Check Redis cache
     */
    async checkRedis(port) {
        try {
            const { stdout } = await execAsync(`redis-cli -p ${port} ping 2>&1`);
            return stdout.trim() === 'PONG';
        } catch {
            return false;
        }
    }

    /**
     * Check Minecraft server
     */
    async checkMinecraft(port) {
        // Minecraft uses a different protocol, just check if port is listening
        return await this.checkPort(port);
    }

    /**
     * Generic port check
     */
    async checkPort(port) {
        try {
            const { stdout } = await execAsync(`netstat -an | grep :${port} | grep LISTEN`);
            return stdout.trim().length > 0;
        } catch {
            return false;
        }
    }

    /**
     * Get health status for a server
     */
    getStatus(serverId) {
        return this.checks.get(serverId) || null;
    }

    /**
     * Get health status for all servers
     */
    getAllStatus() {
        const statuses = Array.from(this.checks.values()).map(check => ({
            serverId: check.serverId,
            serverName: check.serverName,
            type: check.type,
            status: check.status,
            uptime: check.lastSuccess ? Math.floor((Date.now() - check.lastSuccess) / 1000) : 0,
            consecutiveFailures: check.consecutiveFailures,
            successRate: check.totalChecks > 0 
                ? Math.round((check.successCount / check.totalChecks) * 100) 
                : 0,
            avgResponseTime: check.avgResponseTime,
            lastCheck: check.lastCheck
        }));

        return {
            total: statuses.length,
            healthy: statuses.filter(s => s.status === 'healthy').length,
            degraded: statuses.filter(s => s.status === 'degraded').length,
            unhealthy: statuses.filter(s => s.status === 'unhealthy').length,
            servers: statuses
        };
    }

    /**
     * Get health report for a server
     */
    getReport(serverId) {
        const check = this.checks.get(serverId);
        if (!check) return null;

        const recentHistory = check.history.slice(-20);
        const recentSuccessRate = recentHistory.length > 0
            ? Math.round((recentHistory.filter(h => h.healthy).length / recentHistory.length) * 100)
            : 0;

        return {
            server: {
                id: check.serverId,
                name: check.serverName,
                type: check.type,
                port: check.port
            },
            status: {
                current: check.status,
                consecutiveFailures: check.consecutiveFailures,
                lastError: check.lastError
            },
            statistics: {
                totalChecks: check.totalChecks,
                successCount: check.successCount,
                failureCount: check.failureCount,
                successRate: check.totalChecks > 0 
                    ? Math.round((check.successCount / check.totalChecks) * 100) 
                    : 0,
                recentSuccessRate,
                avgResponseTime: check.avgResponseTime
            },
            timestamps: {
                lastCheck: check.lastCheck,
                lastSuccess: check.lastSuccess,
                lastFailure: check.lastFailure
            },
            history: check.history.slice(-20) // Last 20 checks
        };
    }

    /**
     * Force an immediate health check
     */
    async forceCheck(serverId) {
        return await this.checkServer(serverId);
    }

    /**
     * Update check interval
     */
    setCheckInterval(intervalMs) {
        this.checkInterval = intervalMs;
        this.stopChecking();
        this.startChecking();
        console.log(`Health check interval updated to ${intervalMs}ms`);
    }

    /**
     * Get unhealthy servers
     */
    getUnhealthyServers() {
        return Array.from(this.checks.values())
            .filter(check => check.status === 'unhealthy')
            .map(check => ({
                serverId: check.serverId,
                serverName: check.serverName,
                consecutiveFailures: check.consecutiveFailures,
                lastError: check.lastError,
                lastCheck: check.lastCheck
            }));
    }
}

module.exports = HealthCheckSystem;
