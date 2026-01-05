/**
 * Node.js API Server Template - Production Grade
 * Features: Health checks, graceful shutdown, clustering, monitoring
 */

module.exports = {
    name: 'Node.js API Server',
    description: 'Production-grade Express.js REST API with clustering, monitoring, and auto-recovery',
    category: 'Backend',
    icon: '🟢',
    defaultPort: 3000,
    requirements: ['nodejs', 'npm'],
    
    // Resource requirements for allocation
    resources: {
        cpu: 10, // percentage
        memory: 256, // MB
        priority: 'medium',
        bandwidth: { download: 5, upload: 2 } // Mbps
    },
    
    configOptions: [
        { name: 'apiName', label: 'API Name', type: 'text', required: true, placeholder: 'my-api' },
        { name: 'enableCors', label: 'Enable CORS', type: 'checkbox', default: true },
        { name: 'rateLimit', label: 'Rate Limit (req/min)', type: 'number', default: 100 },
        { name: 'enableClustering', label: 'Enable Clustering', type: 'checkbox', default: true },
        { name: 'workers', label: 'Worker Processes', type: 'number', default: 2 },
        { name: 'enableMetrics', label: 'Enable Metrics', type: 'checkbox', default: true }
    ],

    async deploy(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        const workers = server.config.workers || 2;
        const enableClustering = server.config.enableClustering !== false;
        
        // Create directory structure
        await sshExec(`mkdir -p ${instancePath}/{logs,temp,public}`);
        
        // Create package.json with production dependencies
        await sshExec(`cat > ${instancePath}/package.json << 'EOF'
{
  "name": "${server.config.apiName || server.name}",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "express-rate-limit": "^6.7.0",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "morgan": "^1.10.0"
  },
  "engines": {
    "node": ">=14.0.0"
  }
}
EOF`);

        // Create production-grade server.js
        await sshExec(`cat > ${instancePath}/server.js << 'EOF'
const cluster = require('cluster');
const os = require('os');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

const PORT = ${server.port};
const WORKERS = ${workers};
const ENABLE_CLUSTERING = ${enableClustering};

// Master process
if (ENABLE_CLUSTERING && cluster.isMaster) {
    console.log(\`Master process \${process.pid} starting\`);
    console.log(\`Spawning \${WORKERS} workers\`);

    // Fork workers
    for (let i = 0; i < WORKERS; i++) {
        cluster.fork();
    }

    // Replace dead workers
    cluster.on('exit', (worker, code, signal) => {
        console.log(\`Worker \${worker.process.pid} died (code: \${code}, signal: \${signal})\`);
        console.log('Starting new worker');
        cluster.fork();
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('Master received SIGTERM, shutting down workers');
        for (const id in cluster.workers) {
            cluster.workers[id].kill('SIGTERM');
        }
        setTimeout(() => process.exit(0), 5000);
    });

} else {
    // Worker process
    const app = express();
    const workerId = ENABLE_CLUSTERING ? cluster.worker.id : 1;

    // Security middleware
    app.use(helmet());

    // Compression
    app.use(compression());

    // Logging
    const logStream = fs.createWriteStream(path.join(__dirname, 'logs/access.log'), { flags: 'a' });
    app.use(morgan('combined', { stream: logStream }));

    // Body parsing
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // CORS
    ${server.config.enableCors ? 'app.use(cors({ origin: true, credentials: true }));' : ''}

    // Rate limiting
    const limiter = rateLimit({
        windowMs: 60 * 1000,
        max: ${server.config.rateLimit || 100},
        message: 'Too many requests, please try again later',
        standardHeaders: true,
        legacyHeaders: false
    });
    app.use(limiter);

    // Request ID middleware
    app.use((req, res, next) => {
        req.id = Math.random().toString(36).substring(7);
        res.setHeader('X-Request-ID', req.id);
        next();
    });

    // Health check endpoint
    app.get('/health', (req, res) => {
        res.json({ 
            status: 'healthy',
            worker: workerId,
            pid: process.pid,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: new Date().toISOString()
        });
    });

    // Readiness check
    app.get('/ready', (req, res) => {
        res.json({ ready: true, worker: workerId });
    });

    // Metrics endpoint (if enabled)
    ${server.config.enableMetrics ? \`
    app.get('/metrics', (req, res) => {
        const mem = process.memoryUsage();
        res.json({
            worker: workerId,
            pid: process.pid,
            uptime: process.uptime(),
            memory: {
                rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
                heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',
                heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
                external: Math.round(mem.external / 1024 / 1024) + 'MB'
            },
            cpu: process.cpuUsage()
        });
    });
    \` : ''}

    // API Documentation endpoint
    app.get('/api', (req, res) => {
        res.json({ 
            name: '${server.config.apiName || server.name}',
            version: '1.0.0',
            endpoints: {
                'GET /health': 'Health check endpoint',
                'GET /ready': 'Readiness check',
                'GET /api': 'API documentation',
                'GET /api/data': 'Get sample data',
                'POST /api/data': 'Create data',
                'PUT /api/data/:id': 'Update data',
                'DELETE /api/data/:id': 'Delete data'
            },
            worker: workerId
        });
    });

    // Sample CRUD endpoints
    let dataStore = [];

    app.get('/api/data', (req, res) => {
        res.json({ 
            data: dataStore,
            count: dataStore.length,
            timestamp: new Date().toISOString()
        });
    });

    app.get('/api/data/:id', (req, res) => {
        const item = dataStore.find(d => d.id === req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Not found' });
        }
        res.json(item);
    });

    app.post('/api/data', (req, res) => {
        const data = {
            id: Math.random().toString(36).substring(7),
            ...req.body,
            createdAt: new Date().toISOString(),
            worker: workerId
        };
        dataStore.push(data);
        res.status(201).json(data);
    });

    app.put('/api/data/:id', (req, res) => {
        const index = dataStore.findIndex(d => d.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ error: 'Not found' });
        }
        dataStore[index] = { ...dataStore[index], ...req.body, updatedAt: new Date().toISOString() };
        res.json(dataStore[index]);
    });

    app.delete('/api/data/:id', (req, res) => {
        const index = dataStore.findIndex(d => d.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ error: 'Not found' });
        }
        const deleted = dataStore.splice(index, 1)[0];
        res.json({ deleted, message: 'Deleted successfully' });
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
        console.error(\`Error in request \${req.id}:\`, err);
        res.status(err.status || 500).json({
            error: {
                message: err.message || 'Internal server error',
                requestId: req.id
            }
        });
    });

    // 404 handler
    app.use((req, res) => {
        res.status(404).json({ error: 'Not found', path: req.path });
    });

    // Start server
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(\`Worker \${workerId} (PID \${process.pid}) listening on port \${PORT}\`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log(\`Worker \${workerId} received SIGTERM, shutting down gracefully\`);
        server.close(() => {
            console.log(\`Worker \${workerId} closed all connections\`);
            process.exit(0);
        });

        // Force shutdown after 10 seconds
        setTimeout(() => {
            console.error(\`Worker \${workerId} forcing shutdown\`);
            process.exit(1);
        }, 10000);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
        console.error('Uncaught exception:', err);
        process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled rejection at:', promise, 'reason:', reason);
        process.exit(1);
    });
}
EOF`);

        // Install dependencies
        console.log('Installing Node.js API dependencies...');
        await sshExec(`cd ${instancePath} && npm install --production --no-audit --no-fund`);
        
        // Start server
        await sshExec(`cd ${instancePath} && nohup node server.js > logs/server.log 2>&1 & echo $! > logs/server.pid`);
        
        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return { 
            instancePath, 
            port: server.port,
            workers: enableClustering ? workers : 1,
            endpoints: {
                health: \`http://localhost:\${server.port}/health\`,
                api: \`http://localhost:\${server.port}/api\`,
                metrics: server.config.enableMetrics ? \`http://localhost:\${server.port}/metrics\` : null
            }
        };
    },

    async start(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`cd ${instancePath} && nohup node server.js > logs/server.log 2>&1 & echo $! > logs/server.pid`);
    },

    async stop(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`kill $(cat ${instancePath}/logs/server.pid) 2>/dev/null || true`);
    },

    async delete(server, sshExec) {
        await this.stop(server, sshExec);
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`rm -rf ${instancePath}`);
    }
};
