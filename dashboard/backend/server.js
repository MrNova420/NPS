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
const ANDROID_HOST = process.env.ANDROID_HOST || 'localhost';
const ANDROID_PORT = process.env.ANDROID_PORT || '8022';
const ANDROID_USER = process.env.ANDROID_USER || 'u0_a';

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
        const template = require(`../server-templates/${server.type}.js`);
        
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

        const template = require(`../server-templates/${server.type}.js`);
        await template.stop(server, this.sshExec.bind(this));

        server.status = 'stopped';
        await this.saveServers();
        this.broadcast({ type: 'server_update', server });
    }

    async startServer(serverId) {
        const server = this.servers.get(serverId);
        if (!server) throw new Error('Server not found');

        const template = require(`../server-templates/${server.type}.js`);
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

        const template = require(`../server-templates/${server.type}.js`);
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
            const sshCmd = `ssh -p ${ANDROID_PORT} ${ANDROID_USER}@${ANDROID_HOST} "${command}"`;
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
        const templatesDir = path.join(__dirname, '../server-templates');
        const files = await fs.readdir(templatesDir);
        const templates = files
            .filter(f => f.endsWith('.js'))
            .map(f => f.replace('.js', ''));
        
        const details = await Promise.all(
            templates.map(async (name) => {
                const template = require(`../server-templates/${name}.js`);
                return {
                    id: name,
                    name: template.name,
                    description: template.description,
                    category: template.category,
                    icon: template.icon,
                    defaultPort: template.defaultPort,
                    requirements: template.requirements,
                    configOptions: template.configOptions || []
                };
            })
        );
        
        res.json(details);
    } catch (error) {
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
        const { stdout } = await serverManager.sshExec(`
            echo "CPU: $(top -bn1 | grep 'CPU:' | head -1)" && \
            echo "MEM: $(free -m | grep Mem)" && \
            echo "DISK: $(df -h $HOME | tail -1)"
        `);
        
        res.json({ stats: stdout });
    } catch (error) {
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
        await serverManager.sshExec('bash ~/server/core/performance/optimize.sh');
        res.json({ success: true, message: 'System optimization initiated' });
    } catch (error) {
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
const server = app.listen(PORT, () => {
    console.log(`🚀 Server Management Dashboard running on http://localhost:${PORT}`);
    console.log(`📱 Connected to Android: ${ANDROID_USER}@${ANDROID_HOST}:${ANDROID_PORT}`);
});

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

wss.on('connection', (ws) => {
    console.log('Client connected via WebSocket');
    ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected' }));
});

// Update stats every 5 seconds
setInterval(() => {
    serverManager.updateServerStats();
}, 5000);

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await serverManager.saveServers();
    process.exit(0);
});
