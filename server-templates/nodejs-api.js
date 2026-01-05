/**
 * Node.js API Server Template
 */

module.exports = {
    name: 'Node.js API Server',
    description: 'Express.js REST API with automatic deployment',
    category: 'Backend',
    icon: '🟢',
    defaultPort: 3000,
    requirements: ['nodejs', 'npm'],
    
    configOptions: [
        { name: 'apiName', label: 'API Name', type: 'text', required: true, placeholder: 'my-api' },
        { name: 'enableCors', label: 'Enable CORS', type: 'checkbox', default: true },
        { name: 'rateLimit', label: 'Rate Limit (req/min)', type: 'number', default: 100 }
    ],

    async deploy(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        
        // Create directory
        await sshExec(`mkdir -p ${instancePath}/logs`);
        
        // Create package.json
        await sshExec(`cat > ${instancePath}/package.json << 'EOF'
{
  "name": "${server.config.apiName || server.name}",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "express-rate-limit": "^6.7.0"
  }
}
EOF`);

        // Create server.js
        await sshExec(`cat > ${instancePath}/server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = ${server.port};

// Middleware
app.use(express.json());
${server.config.enableCors ? 'app.use(cors());' : ''}

// Rate limiting
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: ${server.config.rateLimit || 100}
});
app.use(limiter);

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Example API endpoints
app.get('/api', (req, res) => {
    res.json({ 
        message: 'Welcome to ${server.name} API',
        version: '1.0.0',
        endpoints: ['/api', '/api/data', '/health']
    });
});

app.get('/api/data', (req, res) => {
    res.json({ 
        data: 'Sample data from your API',
        timestamp: new Date().toISOString()
    });
});

app.post('/api/data', (req, res) => {
    const data = req.body;
    res.json({ 
        message: 'Data received',
        received: data
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('Server running on port ' + PORT);
});
EOF`);

        // Install dependencies
        await sshExec(`cd ${instancePath} && npm install --production`);
        
        // Start server with PM2 or directly
        await sshExec(`cd ${instancePath} && nohup node server.js > logs/server.log 2>&1 & echo $! > logs/server.pid`);
        
        return { instancePath, port: server.port };
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
