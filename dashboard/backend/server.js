#!/usr/bin/env node
/**
 * Advanced Server Management Platform - Main Dashboard Backend
 * Handles server creation, management, monitoring, and orchestration
 */

const express = require('express');
const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const WebSocket = require('ws');
const PerformanceManager = require('../../core/performance/manager');
const StateManager = require('../../core/state-manager');

const app = express();
const PORT = process.env.PORT || 3000;

// Detect environment and set defaults
const isTermux = process.env.TERMUX_VERSION || process.env.PREFIX?.includes('com.termux');
const ANDROID_HOST = process.env.ANDROID_HOST || (isTermux ? 'localhost' : '192.168.1.100');
const ANDROID_PORT = process.env.ANDROID_PORT || '8022';
const ANDROID_USER = process.env.ANDROID_USER || (isTermux ? process.env.USER : 'u0_a');

// Log connection info
console.log(`📱 Android Connection: ${ANDROID_USER}@${ANDROID_HOST}:${ANDROID_PORT}`);
if (!process.env.ANDROID_HOST && !isTermux) {
    console.log(`⚠️  Using default IP: ${ANDROID_HOST}`);
    console.log(`   Set ANDROID_HOST in .env to your phone's IP`);
    console.log(`   Example: ANDROID_HOST=192.168.1.50`);
}

// Initialize State Manager
const stateManager = new StateManager();
stateManager.initialize().catch(console.error);

// Initialize Performance Manager
const perfManager = new PerformanceManager();
perfManager.initialize().catch(console.error);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ noServer: true });

// Server state management
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
        const server = {
            id: Date.now().toString(),
            name: config.name,
            type: config.type,
            status: 'creating',
            port: config.port || this.findAvailablePort(),
            created: new Date().toISOString(),
            config: config,
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

        return server;
    }

    async deployServer(server) {
        const template = this.loadTemplate(server.type);
        
        try {
            server.status = 'deploying';
            this.broadcast({ type: 'server_update', server });

            await template.deploy(server, this.sshExec.bind(this));

            server.status = 'running';
            server.stats.startTime = Date.now();
            await this.saveServers();
            
            this.broadcast({ type: 'server_update', server });
        } catch (error) {
            server.status = 'failed';
            server.error = error.message;
            await this.saveServers();
            this.broadcast({ type: 'server_error', server, error: error.message });
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

        this.servers.delete(serverId);
        await this.saveServers();
        this.broadcast({ type: 'server_deleted', serverId });
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

    sshExec(command) {
        return new Promise((resolve, reject) => {
            const sshCmd = `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -p ${ANDROID_PORT} ${ANDROID_USER}@${ANDROID_HOST} "${command}"`;
            exec(sshCmd, (error, stdout, stderr) => {
                if (error) reject(error);
                else resolve({ stdout, stderr });
            });
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

const serverManager = new ServerManager();

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

// WebSocket connection
const server = app.listen(PORT, async () => {
    console.log(`🚀 Server Management Dashboard running on http://localhost:${PORT}`);
    
    // Test SSH connection
    try {
        const result = await serverManager.sshExec('echo "SSH OK"');
        if (result.stdout.includes('SSH OK')) {
            console.log(`✅ SSH connection to ${ANDROID_USER}@${ANDROID_HOST}:${ANDROID_PORT} - Working`);
        }
    } catch (error) {
        console.error(`❌ SSH connection failed: ${error.message}`);
        console.log(`   Make sure:`);
        console.log(`   1. SSH server running on Android: sshd`);
        console.log(`   2. Correct IP in .env: ANDROID_HOST=${ANDROID_HOST}`);
        console.log(`   3. SSH key added or password auth enabled`);
        console.log(`   4. Test manually: ssh -p ${ANDROID_PORT} ${ANDROID_USER}@${ANDROID_HOST}`);
    }
});

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

wss.on('connection', (ws) => {
    console.log('Client connected via WebSocket');
    ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected' }));
    
    // Send initial system stats
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
});

// Broadcast system stats to all clients every 5 seconds
setInterval(async () => {
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

// Update server stats every 5 seconds
setInterval(() => {
    serverManager.updateServerStats();
}, 5000);

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await serverManager.saveServers();
    process.exit(0);
});
