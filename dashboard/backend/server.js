#!/usr/bin/env node
/**
 * NPS - Enterprise Server Management Platform
 * Production-grade server orchestration with military-level security
 */

const express = require('express');
const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const WebSocket = require('ws');

// Core Managers
const PerformanceManager = require('../../core/performance/manager');
const StateManager = require('../../core/state-manager');
const AuthManager = require('../../core/security/auth-manager');
const MonitoringManager = require('../../core/monitoring/monitoring-manager');
const BackupManager = require('../../core/backup-manager');
const ProcessManager = require('../../core/process-manager');
const ResourceAllocator = require('../../core/resource-allocator');
const ThermalManager = require('../../core/thermal-manager');
const NetworkManager = require('../../core/network-manager');
const HealthCheckSystem = require('../../core/health-check-system');
const AutoRecoverySystem = require('../../core/auto-recovery-system');
const ServiceDiscovery = require('../../core/service-discovery');
const CleanupSystem = require('../../core/cleanup-system');
const AutoServerOptimizer = require('../../core/auto-server-optimizer');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting to prevent API overload
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute

const rateLimiter = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    // Clean up old entries
    for (const [key, data] of requestCounts.entries()) {
        if (now - data.windowStart > RATE_LIMIT_WINDOW) {
            requestCounts.delete(key);
        }
    }
    
    // Check rate limit
    let userData = requestCounts.get(ip);
    if (!userData) {
        userData = { count: 0, windowStart: now };
        requestCounts.set(ip, userData);
    }
    
    if (now - userData.windowStart > RATE_LIMIT_WINDOW) {
        userData.count = 0;
        userData.windowStart = now;
    }
    
    userData.count++;
    
    if (userData.count > RATE_LIMIT_MAX_REQUESTS) {
        return res.status(429).json({ 
            error: 'Too many requests',
            message: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per minute.`,
            retryAfter: Math.ceil((RATE_LIMIT_WINDOW - (now - userData.windowStart)) / 1000)
        });
    }
    
    next();
};

// Detect environment and set defaults
const isTermux = process.env.TERMUX_VERSION || process.env.PREFIX?.includes('com.termux');
const ANDROID_HOST = process.env.ANDROID_HOST || (isTermux ? 'localhost' : '192.168.1.100');
const ANDROID_PORT = process.env.ANDROID_PORT || '8022';
const ANDROID_USER = process.env.ANDROID_USER || (isTermux ? process.env.USER : 'u0_a');

// Log connection info
console.log('╔══════════════════════════════════════════════════╗');
console.log('║  NPS - Enterprise Server Management Platform    ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log('');
console.log('🔧 Environment Configuration:');
if (isTermux) {
    console.log('   ✓ Running in Termux (Local Mode)');
    console.log('   ✓ Direct process execution (no SSH)');
} else {
    console.log('   ✓ Running on PC (Remote Mode)');
    console.log(`   ✓ SSH Target: ${ANDROID_USER}@${ANDROID_HOST}:${ANDROID_PORT}`);
    if (!process.env.ANDROID_HOST) {
        console.log(`   ⚠️  Using default IP: ${ANDROID_HOST}`);
        console.log(`      Set ANDROID_HOST in .env to your phone's IP`);
    }
}
console.log('');

// Initialize Enterprise Managers
console.log('🚀 Initializing Enterprise Systems...');
const stateManager = new StateManager();
const perfManager = new PerformanceManager();
const processManager = new ProcessManager();
const resourceAllocator = new ResourceAllocator();
const thermalManager = new ThermalManager();
const networkManager = new NetworkManager();
const healthCheckSystem = new HealthCheckSystem();
const serviceDiscovery = new ServiceDiscovery();
const cleanupSystem = new CleanupSystem();
let authManager, monitoringManager, backupManager, autoRecoverySystem, autoServerOptimizer;
let serverManager; // Will be created after ServerManager class is defined below

// Try to initialize enterprise features (optional)
try {
    authManager = new AuthManager();
    monitoringManager = new MonitoringManager();
    backupManager = new BackupManager();
} catch (error) {
    console.log('⚠️  Enterprise features disabled (modules not found)');
    console.log('   Basic functionality will work');
}

// Initialize core managers

Promise.all([
    stateManager.initialize().catch(err => console.error('State Manager failed:', err.message)),
    perfManager.initialize().catch(err => console.error('Performance Manager failed:', err.message)),
    processManager.initialize().catch(err => console.error('Process Manager failed:', err.message)),
    resourceAllocator.initialize().catch(err => console.error('Resource Allocator failed:', err.message)),
    thermalManager.initialize().catch(err => console.error('Thermal Manager failed:', err.message)),
    networkManager.initialize().catch(err => console.error('Network Manager failed:', err.message)),
    healthCheckSystem.initialize().catch(err => console.error('Health Check System failed:', err.message)),
    serviceDiscovery.initialize().catch(err => console.error('Service Discovery failed:', err.message)),
    cleanupSystem.initialize().catch(err => console.error('Cleanup System failed:', err.message))
]).then(() => {
    console.log('✅ Core managers initialized');
    
    // Now that core managers are ready, initialize auto-recovery and optimizer
    return Promise.resolve().then(() => {
        // Initialize auto-recovery after health check system is ready
        autoRecoverySystem = new AutoRecoverySystem(healthCheckSystem, serverManager);
        return autoRecoverySystem.initialize();
    }).then(() => {
        console.log('✅ Auto-recovery system initialized');
        
        // Initialize auto server optimizer after perfManager and resourceAllocator are ready
        autoServerOptimizer = new AutoServerOptimizer(serverManager, perfManager, resourceAllocator);
        return autoServerOptimizer.initialize();
    }).then(() => {
        console.log('✅ Auto server optimizer initialized');
    });
}).catch(error => {
    console.error('❌ Core initialization failed:', error);
});

// Initialize enterprise managers (if available)
if (authManager && monitoringManager && backupManager) {
    Promise.all([
        authManager.initialize().catch(err => console.log('Auth disabled:', err.message)),
        monitoringManager.initialize().catch(err => console.log('Monitoring disabled:', err.message)),
        backupManager.initialize().catch(err => console.log('Backup disabled:', err.message))
    ]).then(() => {
        console.log('✅ Enterprise managers initialized');
    }).catch(error => {
        console.log('⚠️  Some enterprise features unavailable');
    });
}

// Middleware
app.use(express.json());
app.use(rateLimiter); // Apply rate limiting to all routes
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Express error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message,
        path: req.path
    });
});

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ noServer: true });

// Server state management - Define class first
class ServerManager {
    constructor() {
        this.servers = new Map();
        this.loadServers();
    }

    // Helper to load template from either basic or advanced directory
    loadTemplate(type) {
        try {
            return require(path.join(__dirname, '../../server-templates', `${type}.js`));
        } catch (e) {
            return require(path.join(__dirname, '../../server-templates/advanced', `${type}.js`));
        }
    }

    async loadServers() {
        try {
            const servers = stateManager.getServers();
            servers.forEach(s => this.servers.set(s.id, s));
            console.log(`Loaded ${servers.length} servers from state`);
        } catch (error) {
            console.log('No existing servers found');
        }
    }

    async saveServers() {
        const data = Array.from(this.servers.values());
        stateManager.updateServers(data);
    }

    async createServer(config) {
        const template = this.loadTemplate(config.type);
        
        // Check thermal safety
        const thermalCheck = thermalManager.isSafeToStart(template.resources?.priority || 'medium');
        if (!thermalCheck.safe) {
            throw new Error(`Cannot start server: ${thermalCheck.reason} - ${thermalCheck.recommendation}`);
        }

        // Check resource availability
        const resources = template.resources || { cpu: 10, memory: 256, priority: 'medium' };
        
        // Check if we can allocate resources
        if (!resourceAllocator.canAllocate(config.type, resources)) {
            const util = resourceAllocator.getUtilization();
            throw new Error(`Insufficient resources. CPU: ${util.cpu.available}% available, Memory: ${util.memory.available}MB available`);
        }

        // Check network availability if needed
        if (resources.bandwidth) {
            const netCheck = networkManager.canAllocate(resources.bandwidth);
            if (!netCheck.canAllocate) {
                throw new Error(`Insufficient bandwidth. Upload: ${netCheck.available.uploadMbps}Mbps available`);
            }
        }

        const server = {
            id: Date.now().toString(),
            name: config.name,
            type: config.type,
            status: 'creating',
            port: config.port || this.findAvailablePort(),
            created: new Date().toISOString(),
            config: config,
            resources: resources,
            stats: {
                requests: 0,
                uptime: 0,
                memory: 0,
                cpu: 0
            }
        };

        this.servers.set(server.id, server);
        await this.saveServers();

        // Deploy server based on template
        await this.deployServer(server);
        
        // Start monitoring if first server
        if (typeof checkMonitoring === 'function') {
            checkMonitoring();
        }

        return server;
    }

    async deployServer(server) {
        const template = this.loadTemplate(server.type);
        
        try {
            server.status = 'deploying';
            server.deploymentStage = 'initializing';
            this.broadcast({ type: 'server_update', server });

            // Allocate resources
            server.deploymentStage = 'allocating resources';
            this.broadcast({ type: 'server_update', server });
            
            const allocation = await resourceAllocator.allocate(
                server.id, 
                server.type, 
                server.resources
            );
            server.allocation = allocation;

            // Allocate bandwidth if needed
            if (server.resources.bandwidth) {
                const bandwidthAlloc = networkManager.allocateBandwidth(
                    server.id,
                    server.resources.bandwidth
                );
                server.bandwidthAllocation = bandwidthAlloc;
            }

            // Deploy using template
            server.deploymentStage = 'deploying template';
            this.broadcast({ type: 'server_update', server });
            console.log(`📦 Deploying ${server.name} (${server.type})...`);
            
            const deployResult = await template.deploy(server, this.sshExec.bind(this));
            server.deployResult = deployResult;

            // Verify deployment
            server.deploymentStage = 'verifying deployment';
            this.broadcast({ type: 'server_update', server });
            
            // Verify process is running if PID is available
            if (deployResult.pid) {
                const isRunning = await this.verifyProcessRunning(deployResult.pid);
                if (!isRunning) {
                    throw new Error(`Process (PID ${deployResult.pid}) is not running. Check logs at ${deployResult.instancePath}/logs/`);
                }
                
                server.pm = {
                    managed: true,
                    pid: deployResult.pid
                };
                console.log(`✓ Process verified (PID: ${deployResult.pid})`);
            }
            
            // Verify port is listening if port is specified
            if (server.port && server.port > 0) {
                const maxRetries = 10;
                let retries = 0;
                let portOpen = false;
                
                while (retries < maxRetries && !portOpen) {
                    portOpen = await this.isPortListening(server.port);
                    if (!portOpen) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        retries++;
                    }
                }
                
                if (!portOpen) {
                    console.warn(`⚠️  Port ${server.port} is not listening after ${maxRetries} seconds`);
                    // Don't fail deployment, but log warning
                } else {
                    console.log(`✓ Port ${server.port} is listening`);
                }
            }

            server.status = 'running';
            server.deploymentStage = 'completed';
            server.stats.startTime = Date.now();
            await this.saveServers();
            
            // Register with health check system
            healthCheckSystem.register(server);
            
            this.broadcast({ type: 'server_update', server });
            console.log(`✅ Server ${server.name} deployed successfully`);
        } catch (error) {
            server.status = 'failed';
            server.error = error.message;
            server.deploymentStage = 'failed';
            
            // Release allocated resources
            resourceAllocator.release(server.id);
            if (server.resources.bandwidth) {
                networkManager.releaseBandwidth(server.id);
            }
            
            await this.saveServers();
            this.broadcast({ type: 'server_error', server, error: error.message });
            console.error(`❌ Server ${server.name} deployment failed:`, error.message);
            
            // Provide helpful troubleshooting information
            if (error.message.includes('timeout') || error.message.includes('timed out')) {
                console.error('💡 Tip: Check that the target device has enough resources and network connectivity');
            } else if (error.message.includes('SSH')) {
                console.error('💡 Tip: Verify SSH is running and credentials are correct');
                console.error(`   Try: ssh -p ${ANDROID_PORT} ${ANDROID_USER}@${ANDROID_HOST}`);
            }
            
            throw error; // Re-throw to ensure caller knows deployment failed
        }
    }

    async stopServer(serverId) {
        const server = this.servers.get(serverId);
        if (!server) throw new Error('Server not found');

        const template = this.loadTemplate(server.type);
        await template.stop(server, this.sshExec.bind(this));

        server.status = 'stopped';
        await this.saveServers();
        this.broadcast({ type: 'server_update', server });
    }

    async startServer(serverId) {
        const server = this.servers.get(serverId);
        if (!server) throw new Error('Server not found');

        const template = this.loadTemplate(server.type);
        await template.start(server, this.sshExec.bind(this));

        server.status = 'running';
        server.stats.startTime = Date.now();
        await this.saveServers();
        this.broadcast({ type: 'server_update', server });
    }

    async deleteServer(serverId) {
        const server = this.servers.get(serverId);
        if (!server) throw new Error('Server not found');

        if (server.status === 'running') {
            await this.stopServer(serverId);
        }

        const template = this.loadTemplate(server.type);
        await template.delete(server, this.sshExec.bind(this));

        // Release resources
        resourceAllocator.release(serverId);
        if (server.resources?.bandwidth) {
            networkManager.releaseBandwidth(serverId);
        }

        // Unregister from health checks
        healthCheckSystem.unregister(serverId);

        this.servers.delete(serverId);
        await this.saveServers();
        this.broadcast({ type: 'server_deleted', serverId });
        
        // Stop monitoring if no servers left
        if (typeof checkMonitoring === 'function') {
            checkMonitoring();
        }
    }

    async updateServerStats() {
        for (const [id, server] of this.servers) {
            if (server.status === 'running') {
                try {
                    const stats = await this.getServerStats(server);
                    server.stats = { ...server.stats, ...stats };
                    this.broadcast({ type: 'stats_update', serverId: id, stats: server.stats });
                } catch (error) {
                    console.error(`Error updating stats for ${id}:`, error);
                }
            }
        }
    }

    async getServerStats(server) {
        const pidCmd = `lsof -ti:${server.port} | head -1`;
        const { stdout: pid } = await this.sshExec(pidCmd);
        
        if (!pid.trim()) {
            return { cpu: 0, memory: 0, uptime: 0 };
        }

        const statsCmd = `ps -p ${pid.trim()} -o %cpu,%mem,etime | tail -1`;
        const { stdout } = await this.sshExec(statsCmd);
        
        const [cpu, mem, uptime] = stdout.trim().split(/\s+/);
        
        return {
            cpu: parseFloat(cpu) || 0,
            memory: parseFloat(mem) || 0,
            uptime: uptime || '0',
            requests: server.stats.requests || 0
        };
    }

    findAvailablePort() {
        const usedPorts = new Set(Array.from(this.servers.values()).map(s => s.port));
        let port = 8000;
        while (usedPorts.has(port)) port++;
        return port;
    }

    sshExec(command, options = {}) {
        const timeout = options.timeout || 300000; // Default 5 minutes for long operations like npm install
        
        // If running locally in Termux, execute directly instead of SSH
        if (isTermux || ANDROID_HOST === 'localhost' || ANDROID_HOST === '127.0.0.1') {
            return new Promise((resolve, reject) => {
                const child = exec(command, {
                    timeout,
                    maxBuffer: 10 * 1024 * 1024, // 10MB buffer
                    shell: '/bin/bash'
                }, (error, stdout, stderr) => {
                    if (error) {
                        if (error.killed) {
                            reject(new Error(`Command timed out after ${timeout}ms: ${command.substring(0, 100)}`));
                        } else {
                            reject(new Error(`Command failed (exit ${error.code}): ${stderr || error.message}`));
                        }
                    } else {
                        resolve({ stdout, stderr });
                    }
                });
                
                // Log long-running commands
                if (!options.silent && timeout > 30000) {
                    console.log(`⏳ Running local command (timeout: ${timeout}ms): ${command.substring(0, 80)}...`);
                }
            });
        }
        
        // Remote execution via SSH
        return new Promise((resolve, reject) => {
            const sshCmd = `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -o ServerAliveInterval=30 -p ${ANDROID_PORT} ${ANDROID_USER}@${ANDROID_HOST} "${command.replace(/"/g, '\\"')}"`;
            
            const child = exec(sshCmd, { 
                timeout,
                maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large outputs
            }, (error, stdout, stderr) => {
                if (error) {
                    // Provide more helpful error messages
                    if (error.killed) {
                        reject(new Error(`Command timed out after ${timeout}ms: ${command.substring(0, 100)}`));
                    } else if (error.code === 'ECONNREFUSED') {
                        reject(new Error(`SSH connection refused. Check that SSH server is running on ${ANDROID_HOST}:${ANDROID_PORT}`));
                    } else if (error.code === 255) {
                        reject(new Error(`SSH connection failed. Check credentials and network connection to ${ANDROID_HOST}`));
                    } else {
                        reject(new Error(`Command failed (exit ${error.code}): ${stderr || error.message}`));
                    }
                } else {
                    resolve({ stdout, stderr });
                }
            });
            
            // Log long-running commands
            if (!options.silent && timeout > 30000) {
                console.log(`⏳ Running SSH command (timeout: ${timeout}ms): ${command.substring(0, 80)}...`);
            }
        });
    }

    broadcast(data) {
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    }

    /**
     * Verify that a process is running
     * @param {number} pid - Process ID to check
     * @returns {Promise<boolean>} True if process is running
     */
    async verifyProcessRunning(pid) {
        if (!pid) return false;
        try {
            const { stdout } = await this.sshExec(`ps -p ${pid} -o pid=`, { timeout: 5000, silent: true });
            return stdout.trim() !== '';
        } catch (error) {
            return false;
        }
    }

    /**
     * Wait for a process to start by checking its PID file
     * @param {string} pidFile - Path to PID file
     * @param {number} maxWaitMs - Maximum time to wait in milliseconds
     * @returns {Promise<number>} The PID if found
     */
    async waitForProcess(pidFile, maxWaitMs = 30000) {
        const startTime = Date.now();
        const checkInterval = 1000; // Check every second
        
        while (Date.now() - startTime < maxWaitMs) {
            try {
                const { stdout } = await this.sshExec(`cat ${pidFile} 2>/dev/null || echo ""`, { timeout: 5000, silent: true });
                const pid = parseInt(stdout.trim());
                
                if (pid && await this.verifyProcessRunning(pid)) {
                    return pid;
                }
            } catch (error) {
                // Continue waiting
            }
            
            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
        
        throw new Error(`Process did not start within ${maxWaitMs}ms. Check logs for details.`);
    }

    /**
     * Check if a port is listening
     * @param {number} port - Port number to check
     * @returns {Promise<boolean>} True if port is listening
     */
    async isPortListening(port) {
        try {
            const { stdout } = await this.sshExec(`lsof -ti:${port} 2>/dev/null || netstat -tuln 2>/dev/null | grep ":${port} " || echo ""`, { timeout: 5000, silent: true });
            return stdout.trim() !== '';
        } catch (error) {
            return false;
        }
    }

    /**
     * Get all servers
     * @returns {Array} List of all servers
     */
    getServers() {
        return Array.from(this.servers.values());
    }

    /**
     * Get server by ID
     * @param {string} serverId - Server ID
     * @returns {Object|null} Server object or null
     */
    getServerById(serverId) {
        return this.servers.get(serverId) || null;
    }
}

// Create ServerManager instance now that class is defined
serverManager = new ServerManager();

// API Routes

// Get all servers
app.get('/api/servers', (req, res) => {
    res.json(Array.from(serverManager.servers.values()));
});

// Get server templates
app.get('/api/templates', async (req, res) => {
    try {
        const templatesDir = path.join(__dirname, '../../server-templates');
        const advancedDir = path.join(templatesDir, 'advanced');
        
        // Load basic templates
        const basicFiles = await fs.readdir(templatesDir);
        const basicTemplates = basicFiles
            .filter(f => f.endsWith('.js'))
            .map(f => ({ name: f.replace('.js', ''), path: templatesDir }));
        
        // Load advanced templates
        let advancedTemplates = [];
        try {
            const advancedFiles = await fs.readdir(advancedDir);
            advancedTemplates = advancedFiles
                .filter(f => f.endsWith('.js'))
                .map(f => ({ name: f.replace('.js', ''), path: advancedDir }));
        } catch (e) {
            console.log('No advanced templates directory found');
        }
        
        // Combine all templates
        const allTemplates = [...basicTemplates, ...advancedTemplates];
        
        const details = await Promise.all(
            allTemplates.map(async ({ name, path: templatePath }) => {
                try {
                    const template = require(path.join(templatePath, `${name}.js`));
                    return {
                        id: name,
                        name: template.name || name,
                        description: template.description || 'No description',
                        category: template.category || 'basic',
                        icon: template.icon || '📦',
                        defaultPort: template.defaultPort || 8000,
                        requirements: template.requirements || [],
                        configOptions: template.configOptions || []
                    };
                } catch (err) {
                    console.error(`Failed to load template ${name}:`, err.message);
                    return null;
                }
            })
        );
        
        res.json(details.filter(d => d !== null));
    } catch (error) {
        console.error('Template loading error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create new server
app.post('/api/servers', async (req, res) => {
    try {
        const server = await serverManager.createServer(req.body);
        res.json(server);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Control server
app.post('/api/servers/:id/:action', async (req, res) => {
    const { id, action } = req.params;
    
    try {
        switch (action) {
            case 'start':
                await serverManager.startServer(id);
                break;
            case 'stop':
                await serverManager.stopServer(id);
                break;
            case 'restart':
                await serverManager.stopServer(id);
                await new Promise(resolve => setTimeout(resolve, 2000));
                await serverManager.startServer(id);
                break;
            case 'delete':
                await serverManager.deleteServer(id);
                break;
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update server config
app.patch('/api/servers/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    try {
        const server = serverManager.servers.get(id);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }
        
        // Update server properties
        if (updates.name) server.name = updates.name;
        if (updates.port) server.port = updates.port;
        if (updates.memory_limit) server.config.memory_limit = updates.memory_limit;
        if (updates.cpu_limit) server.config.cpu_limit = updates.cpu_limit;
        
        await serverManager.saveServers();
        serverManager.broadcast({ type: 'server_update', server });
        
        res.json({ success: true, server });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get server logs
app.get('/api/servers/:id/logs', async (req, res) => {
    const { id } = req.params;
    const server = serverManager.servers.get(id);
    
    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }

    try {
        const logPath = `~/server/instances/${server.id}/logs/server.log`;
        const { stdout } = await serverManager.sshExec(`tail -n 100 ${logPath} 2>/dev/null || echo "No logs yet"`);
        res.json({ logs: stdout });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// System stats
app.get('/api/system/stats', async (req, res) => {
    try {
        // Use PerformanceManager metrics instead of SSH (avoids blocking)
        const metrics = await perfManager.getMetrics();
        res.json({ 
            stats: {
                cpu: metrics.cpu,
                memory: metrics.memory,
                disk: metrics.disk,
                temperature: metrics.temperature,
                timestamp: metrics.timestamp
            }
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Performance report
app.get('/api/system/performance', (req, res) => {
    try {
        const report = perfManager.getPerformanceReport();
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Optimization endpoint
app.post('/api/system/optimize', async (req, res) => {
    try {
        // Trigger manual optimization via PerformanceManager
        if (perfManager.autoOptimize) {
            await perfManager.autoOptimize();
            res.json({ success: true, message: 'System optimization completed' });
        } else {
            res.json({ success: false, message: 'Optimization not available' });
        }
    } catch (error) {
        console.error('Optimization error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Execute command on Android
app.post('/api/system/execute', async (req, res) => {
    const { command } = req.body;
    
    if (!command) {
        return res.status(400).json({ error: 'Command required' });
    }

    try {
        const { stdout, stderr } = await serverManager.sshExec(command);
        res.json({ stdout, stderr });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ENTERPRISE API ENDPOINTS
// ============================================

// Resource utilization
app.get('/api/system/resources', (req, res) => {
    try {
        const utilization = resourceAllocator.getUtilization();
        const recommendations = resourceAllocator.getCapacityRecommendations();
        res.json({ utilization, recommendations });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Thermal status
app.get('/api/system/thermal', (req, res) => {
    try {
        const report = thermalManager.getReport();
        const cooling = thermalManager.getCoolingRecommendations();
        res.json({ ...report, cooling });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Network status
app.get('/api/system/network', async (req, res) => {
    try {
        const metrics = networkManager.getMetrics();
        const health = await networkManager.getHealthStatus();
        const recommendations = networkManager.getBandwidthRecommendations();
        res.json({ metrics, health, recommendations });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Process list
app.get('/api/system/processes', (req, res) => {
    try {
        const processes = processManager.list();
        res.json({ processes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// System health check
app.get('/api/system/health', async (req, res) => {
    try {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            managers: {
                state: stateManager ? 'active' : 'inactive',
                performance: perfManager ? 'active' : 'inactive',
                process: processManager ? 'active' : 'inactive',
                resource: resourceAllocator ? 'active' : 'inactive',
                thermal: thermalManager ? 'active' : 'inactive',
                network: networkManager ? 'active' : 'inactive',
                healthCheck: healthCheckSystem ? 'active' : 'inactive',
                autoRecovery: autoRecoverySystem ? 'active' : 'inactive',
                discovery: serviceDiscovery ? 'active' : 'inactive',
                cleanup: cleanupSystem ? 'active' : 'inactive'
            },
            thermal: thermalManager.getState(),
            resources: resourceAllocator.getUtilization(),
            network: networkManager.getMetrics()
        };
        
        // Check if any critical issues
        if (health.thermal.status === 'critical' || health.thermal.status === 'emergency') {
            health.status = 'critical';
        } else if (health.resources.cpu.percentage > 90 || health.resources.memory.percentage > 90) {
            health.status = 'degraded';
        }
        
        res.json(health);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Service Discovery - Scan system
app.get('/api/discovery/scan', async (req, res) => {
    try {
        const services = await serviceDiscovery.scanSystem();
        const summary = await serviceDiscovery.getSystemSummary();
        res.json({ services, summary });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Service Discovery - Check port
app.get('/api/discovery/port/:port', async (req, res) => {
    try {
        const port = parseInt(req.params.port);
        const info = await serviceDiscovery.getPortInfo(port);
        res.json(info);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Service Discovery - Find available port
app.get('/api/discovery/port/available/:start?/:end?', async (req, res) => {
    try {
        const start = parseInt(req.params.start) || 8000;
        const end = parseInt(req.params.end) || 9000;
        const port = await serviceDiscovery.findAvailablePort(start, end);
        res.json({ port, available: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Service Discovery - Get process details
app.get('/api/discovery/process/:pid', async (req, res) => {
    try {
        const pid = parseInt(req.params.pid);
        const details = await serviceDiscovery.getProcessDetails(pid);
        res.json(details || { error: 'Process not found' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Service Discovery - Import service
app.post('/api/discovery/import', async (req, res) => {
    try {
        const serviceInfo = req.body;
        const server = await serviceDiscovery.importService(serviceInfo);
        
        // Add to server manager
        serverManager.servers.set(server.id, server);
        await serverManager.saveServers();
        
        // Register for health checks
        healthCheckSystem.register(server);
        
        res.json({ success: true, server });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cleanup - Get report
app.get('/api/cleanup/report', async (req, res) => {
    try {
        const report = await cleanupSystem.getCleanupReport();
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cleanup - Run routine cleanup
app.post('/api/cleanup/routine', async (req, res) => {
    try {
        const results = await cleanupSystem.performRoutineCleanup();
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cleanup - Analyze disk
app.get('/api/cleanup/disk', async (req, res) => {
    try {
        const analysis = await cleanupSystem.analyzeDiskUsage();
        res.json(analysis);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cleanup - Find large files
app.get('/api/cleanup/large-files/:minSize?', async (req, res) => {
    try {
        const minSize = parseInt(req.params.minSize) || 100;
        const files = await cleanupSystem.findLargeFiles(minSize);
        res.json({ files, minSizeMB: minSize });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cleanup - Clean server instance
app.post('/api/cleanup/server/:id', async (req, res) => {
    try {
        const result = await cleanupSystem.cleanServerInstance(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cleanup - Compress logs
app.post('/api/cleanup/compress-logs/:id?', async (req, res) => {
    try {
        const serverId = req.params.id || null;
        const result = await cleanupSystem.compressLogs(serverId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health Check - Get all status
app.get('/api/health/all', (req, res) => {
    try {
        const status = healthCheckSystem.getAllStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health Check - Get server status
app.get('/api/health/server/:id', (req, res) => {
    try {
        const status = healthCheckSystem.getStatus(req.params.id);
        const report = healthCheckSystem.getReport(req.params.id);
        res.json({ status, report });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health Check - Force check
app.post('/api/health/check/:id', async (req, res) => {
    try {
        const result = await healthCheckSystem.forceCheck(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Auto-Recovery - Get statistics
app.get('/api/recovery/stats', (req, res) => {
    try {
        const stats = autoRecoverySystem.getStatistics();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Auto-Recovery - Get server state
app.get('/api/recovery/server/:id', (req, res) => {
    try {
        const report = autoRecoverySystem.getReport(req.params.id);
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Auto-Recovery - Manual recovery
app.post('/api/recovery/trigger/:id', async (req, res) => {
    try {
        const success = await autoRecoverySystem.triggerRecovery(req.params.id);
        res.json({ success, serverId: req.params.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Auto-Recovery - Enable/disable
app.post('/api/recovery/enable', (req, res) => {
    try {
        const { enabled } = req.body;
        autoRecoverySystem.setEnabled(enabled);
        res.json({ success: true, enabled });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Authentication
app.post('/api/auth/login', async (req, res) => {
    if (!authManager) return res.status(503).json({ error: 'Authentication not available' });
    try {
        const { username, password, mfaCode } = req.body;
        const session = await authManager.login(username, password, mfaCode);
        res.json(session);
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

app.post('/api/auth/logout', async (req, res) => {
    if (!authManager) return res.status(503).json({ error: 'Authentication not available' });
    try {
        const { sessionId } = req.body;
        await authManager.logout(sessionId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/change-password', async (req, res) => {
    if (!authManager) return res.status(503).json({ error: 'Authentication not available' });
    try {
        const { username, oldPassword, newPassword } = req.body;
        await authManager.changePassword(username, oldPassword, newPassword);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/auth/status', (req, res) => {
    if (!authManager) return res.json({ enabled: false });
    res.json({ enabled: true, ...authManager.getSecurityStatus() });
});

app.get('/api/auth/audit', async (req, res) => {
    if (!authManager) return res.status(503).json({ error: 'Authentication not available' });
    try {
        const logs = await authManager.getAuditLog(req.query);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Monitoring & Alerts
app.get('/api/monitoring/status', (req, res) => {
    if (!monitoringManager) return res.json({ enabled: false });
    res.json(monitoringManager.getStatus());
});

app.get('/api/monitoring/metrics', (req, res) => {
    if (!monitoringManager) return res.status(503).json({ error: 'Monitoring not available' });
    const { from, to } = req.query;
    const metrics = monitoringManager.getMetrics(
        from ? parseInt(from) : Date.now() - 3600000,
        to ? parseInt(to) : Date.now()
    );
    res.json(metrics);
});

app.get('/api/monitoring/alerts', (req, res) => {
    if (!monitoringManager) return res.json([]);
    const alerts = monitoringManager.getAlerts(req.query);
    res.json(alerts);
});

app.post('/api/monitoring/alerts/:id/acknowledge', (req, res) => {
    if (!monitoringManager) return res.status(503).json({ error: 'Monitoring not available' });
    const { id } = req.params;
    monitoringManager.acknowledgeAlert(parseFloat(id));
    res.json({ success: true });
});

// Backup & Recovery
app.post('/api/backup/create', async (req, res) => {
    if (!backupManager) return res.status(503).json({ error: 'Backup not available' });
    try {
        const { type, targets } = req.body;
        const backup = await backupManager.createBackup(type, targets);
        res.json(backup);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/backup/list', (req, res) => {
    if (!backupManager) return res.json([]);
    const backups = backupManager.getBackups(req.query);
    res.json(backups);
});

app.post('/api/backup/restore/:id', async (req, res) => {
    if (!backupManager) return res.status(503).json({ error: 'Backup not available' });
    try {
        const { id } = req.params;
        const result = await backupManager.restoreBackup(id, req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/backup/status', (req, res) => {
    if (!backupManager) return res.json({ enabled: false });
    res.json(backupManager.getStatus());
});

// Enterprise Dashboard Stats
app.get('/api/enterprise/dashboard', async (req, res) => {
    try {
        const dashboard = {
            timestamp: Date.now(),
            uptime: process.uptime(),
            system: monitoringManager ? monitoringManager.getStatus() : { enabled: false },
            security: authManager ? authManager.getSecurityStatus() : { enabled: false },
            backup: backupManager ? backupManager.getStatus() : { enabled: false },
            servers: {
                total: serverManager.servers.size,
                running: Array.from(serverManager.servers.values()).filter(s => s.status === 'running').length,
                stopped: Array.from(serverManager.servers.values()).filter(s => s.status === 'stopped').length
            },
            performance: perfManager.getPerformanceReport ? await perfManager.getPerformanceReport() : {},
            optimization: autoServerOptimizer ? autoServerOptimizer.getReport() : { enabled: false },
            features: {
                auth: !!authManager,
                monitoring: !!monitoringManager,
                backup: !!backupManager,
                autoOptimization: !!autoServerOptimizer
            }
        };
        res.json(dashboard);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Auto optimization report
app.get('/api/optimization/report', (req, res) => {
    if (!autoServerOptimizer) {
        return res.json({ enabled: false, message: 'Auto optimization not available' });
    }
    
    try {
        const report = autoServerOptimizer.getReport();
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: Date.now(),
        uptime: process.uptime(),
        version: '2.0.0-enterprise'
    });
});


// WebSocket connection
const server = app.listen(PORT, async () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║           Dashboard Started Successfully!        ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
    console.log(`🌐 Dashboard URL: http://localhost:${PORT}`);
    console.log(`📊 WebSocket: ws://localhost:${PORT}`);
    console.log('');
    
    // Test connection
    console.log('🔍 Testing connection...');
    try {
        const result = await serverManager.sshExec('echo "Connection OK"', { timeout: 10000, silent: true });
        if (result.stdout.includes('Connection OK')) {
            if (isTermux) {
                console.log(`✅ Local execution - Working`);
            } else {
                console.log(`✅ SSH connection to ${ANDROID_USER}@${ANDROID_HOST}:${ANDROID_PORT} - Working`);
            }
            console.log('');
            console.log(`✅ System is ready! Open http://localhost:${PORT} in your browser`);
            console.log('');
        }
    } catch (error) {
        console.error(`❌ Connection test failed: ${error.message}`);
        console.log('');
        console.log(`   Troubleshooting steps:`);
        if (isTermux) {
            console.log(`   1. Verify you're in Termux and environment is configured`);
        } else {
            console.log(`   1. SSH server running on Android: sshd`);
            console.log(`   2. Correct IP in .env: ANDROID_HOST=${ANDROID_HOST}`);
            console.log(`   3. SSH keys configured: bash setup-ssh-keys.sh`);
            console.log(`   4. Test manually: ssh -p ${ANDROID_PORT} ${ANDROID_USER}@${ANDROID_HOST}`);
        }
        console.log('');
    }
});

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

wss.on('connection', (ws) => {
    activeClients++;
    console.log(`📱 Client connected via WebSocket (${activeClients} active)`);
    checkMonitoring(); // Start monitoring if needed
    
    ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected' }));
    
    // Send initial system stats
    if (perfManager && perfManager.getMetrics) {
        perfManager.getMetrics().then(metrics => {
            ws.send(JSON.stringify({ 
                type: 'system_stats', 
                stats: {
                    cpu: metrics.cpu,
                    memory: metrics.memory,
                    disk: metrics.disk,
                    temperature: metrics.temperature,
                    timestamp: metrics.timestamp
                }
            }));
        }).catch(console.error);
    }
    
    // Handle client disconnect
    ws.on('close', () => {
        activeClients--;
        console.log(`📱 Client disconnected (${activeClients} active)`);
        checkMonitoring(); // Stop monitoring if not needed
    });
});

// Smart monitoring system - only active when needed
let statsInterval = null;
let serverStatsInterval = null;
let activeClients = 0;

const startMonitoring = () => {
    if (statsInterval) return; // Already running
    
    console.log('🔍 Starting monitoring (clients connected or servers running)');
    
    // Enable performance manager monitoring
    if (perfManager && perfManager.enableMonitoring) {
        perfManager.enableMonitoring();
    }
    
    // Broadcast system stats to all clients every 5 seconds (only when clients connected)
    statsInterval = setInterval(async () => {
        if (!perfManager || !perfManager.getMetrics) return;
        if (wss.clients.size === 0) return; // Skip if no clients
        
        try {
            const metrics = await perfManager.getMetrics();
            const statsUpdate = {
                type: 'system_stats',
                stats: {
                    cpu: metrics.cpu,
                    memory: metrics.memory,
                    disk: metrics.disk,
                    temperature: metrics.temperature,
                    timestamp: metrics.timestamp
                }
            };
            
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(statsUpdate));
                }
            });
        } catch (error) {
            console.error('Failed to broadcast system stats:', error);
        }
    }, 5000);

    // Update server stats every 5 seconds (only when servers exist)
    serverStatsInterval = setInterval(() => {
        if (serverManager.servers.size > 0) {
            serverManager.updateServerStats();
        }
    }, 5000);
};

const stopMonitoring = () => {
    if (activeClients === 0 && serverManager.servers.size === 0) {
        console.log('💤 Stopping monitoring (no clients or servers - saving CPU)');
        
        if (statsInterval) {
            clearInterval(statsInterval);
            statsInterval = null;
        }
        
        if (serverStatsInterval) {
            clearInterval(serverStatsInterval);
            serverStatsInterval = null;
        }
        
        // Disable performance manager monitoring
        if (perfManager && perfManager.disableMonitoring) {
            perfManager.disableMonitoring();
        }
    }
};

// Check if monitoring should run
const checkMonitoring = () => {
    const shouldMonitor = activeClients > 0 || serverManager.servers.size > 0;
    
    if (shouldMonitor && !statsInterval) {
        startMonitoring();
    } else if (!shouldMonitor && statsInterval) {
        stopMonitoring();
    }
};

// Graceful shutdown
const shutdown = async (signal) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    
    try {
        // Stop accepting new connections
        server.close(() => {
            console.log('HTTP server closed');
        });
        
        // Close WebSocket connections
        wss.clients.forEach(client => {
            client.close(1000, 'Server shutting down');
        });
        
        // Save server state
        await serverManager.saveServers();
        console.log('✓ Server state saved');
        
        // Give processes time to finish
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('✅ Shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Don't exit immediately, try to handle gracefully
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit immediately, try to handle gracefully
});
