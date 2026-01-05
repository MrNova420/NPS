/**
 * Full-Stack Web Application Template - Advanced Production Grade
 * Complete MERN/PERN/MEAN stack with auto-configuration, PM2, Nginx
 */

module.exports = {
    name: 'Full-Stack Web App',
    description: 'Production-grade full-stack application - Frontend, Backend, Database, Nginx reverse proxy, PM2 process management',
    category: 'Advanced',
    icon: '🌟',
    defaultPort: 80,
    requirements: ['nodejs', 'npm', 'nginx', 'postgresql'],
    
    // Resource requirements
    resources: {
        cpu: 25,
        memory: 768,
        priority: 'high',
        bandwidth: { download: 15, upload: 15 }
    },
    
    configOptions: [
        {
            name: 'stackType',
            label: 'Stack Type',
            type: 'select',
            options: ['MERN', 'PERN', 'MEAN', 'MEVN', 'Custom'],
            default: 'MERN',
            help: 'MongoDB/Express/React/Node or PostgreSQL variants'
        },
        {
            name: 'appName',
            label: 'Application Name',
            type: 'text',
            required: true,
            placeholder: 'my-awesome-app'
        },
        {
            name: 'frontendPort',
            label: 'Frontend Port',
            type: 'number',
            default: 3000
        },
        {
            name: 'backendPort',
            label: 'Backend API Port',
            type: 'number',
            default: 5000
        },
        {
            name: 'dbPort',
            label: 'Database Port',
            type: 'number',
            default: 5432
        },
        {
            name: 'enableSSL',
            label: 'Enable SSL/HTTPS',
            type: 'checkbox',
            default: false
        },
        {
            name: 'domain',
            label: 'Domain Name',
            type: 'text',
            placeholder: 'example.com'
        },
        {
            name: 'enableAuth',
            label: 'Enable Authentication',
            type: 'checkbox',
            default: true
        },
        {
            name: 'jwtSecret',
            label: 'JWT Secret',
            type: 'password',
            default: () => require('crypto').randomBytes(32).toString('hex')
        },
        {
            name: 'dbName',
            label: 'Database Name',
            type: 'text',
            default: 'appdb'
        },
        {
            name: 'dbUser',
            label: 'Database User',
            type: 'text',
            default: 'appuser'
        },
        {
            name: 'dbPassword',
            label: 'Database Password',
            type: 'password',
            required: true
        },
        {
            name: 'enableCaching',
            label: 'Enable Redis Caching',
            type: 'checkbox',
            default: true
        },
        {
            name: 'enableWebSocket',
            label: 'Enable WebSocket',
            type: 'checkbox',
            default: false
        },
        {
            name: 'maxUploadSize',
            label: 'Max Upload Size (MB)',
            type: 'number',
            default: 10
        },
        {
            name: 'rateLimitRpm',
            label: 'Rate Limit (requests/min)',
            type: 'number',
            default: 100
        }
    ],

    async deploy(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        const config = server.config;
        
        // Create directory structure
        await sshExec(`mkdir -p ${instancePath}/{backend,frontend,database,nginx,logs,uploads}`);
        
        // 1. Setup Database
        const dbPath = `${instancePath}/database`;
        await sshExec(`initdb -D ${dbPath}/data`);
        await sshExec(`pg_ctl -D ${dbPath}/data -l ${dbPath}/logs/postgres.log start`);
        await sshExec(`sleep 2`);
        await sshExec(`createdb -p ${config.dbPort} ${config.dbName}`);
        await sshExec(`psql -p ${config.dbPort} postgres -c "CREATE USER ${config.dbUser} WITH PASSWORD '${config.dbPassword}';"`);
        await sshExec(`psql -p ${config.dbPort} postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${config.dbName} TO ${config.dbUser};"`);
        
        // 2. Setup Backend API
        await sshExec(`cat > ${instancePath}/backend/package.json << 'EOF'
{
  "name": "${config.appName}-backend",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "dotenv": "^16.3.1",
    ${config.stackType.includes('P') ? '"pg": "^8.11.3",' : '"mongoose": "^8.0.3",'}
    ${config.enableAuth ? '"jsonwebtoken": "^9.0.2",\n    "bcrypt": "^5.1.1",\n    "express-validator": "^7.0.1",' : ''}
    ${config.enableCaching ? '"redis": "^4.6.11",' : ''}
    ${config.enableWebSocket ? '"socket.io": "^4.6.0",' : ''}
    "multer": "^1.4.5-lts.1",
    "compression": "^1.7.4",
    "morgan": "^1.10.0"
  }
}
EOF`);

        // Create comprehensive backend server
        await sshExec(`cat > ${instancePath}/backend/server.js << 'EOF'
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
${config.enableWebSocket ? "const { createServer } = require('http');\nconst { Server } = require('socket.io');" : ''}
${config.stackType.includes('P') ? "const { Pool } = require('pg');" : "const mongoose = require('mongoose');"}
${config.enableAuth ? "const jwt = require('jsonwebtoken');\nconst bcrypt = require('bcrypt');" : ''}
${config.enableCaching ? "const redis = require('redis');\nconst redisClient = redis.createClient({ url: 'redis://localhost:6379' });\nredisClient.connect();" : ''}

const app = express();
${config.enableWebSocket ? 'const httpServer = createServer(app);\nconst io = new Server(httpServer, { cors: { origin: "*" } });' : ''}

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '${config.maxUploadSize}mb' }));
app.use(express.urlencoded({ extended: true, limit: '${config.maxUploadSize}mb' }));
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: ${config.rateLimitRpm}
});
app.use('/api/', limiter);

// Database connection
${config.stackType.includes('P') ? `
const pool = new Pool({
    host: 'localhost',
    port: ${config.dbPort},
    database: '${config.dbName}',
    user: '${config.dbUser}',
    password: '${config.dbPassword}',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Create tables
pool.query(\`
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
\`);
` : `
mongoose.connect('mongodb://localhost:27017/${config.dbName}', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
`}

${config.enableAuth ? `
// Auth middleware
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied' });
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Auth routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        ${config.stackType.includes('P') ? `
        const result = await pool.query(
            'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id',
            [username, email, hashedPassword]
        );
        ` : `
        const user = new User({ username, email, password: hashedPassword });
        await user.save();
        `}
        
        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        ${config.stackType.includes('P') ? `
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        ` : `
        const user = await User.findOne({ username });
        `}
        
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
        
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({ token, user: { id: user.id, username: user.username } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
` : ''}

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

app.get('/api', (req, res) => {
    res.json({ 
        app: '${config.appName}',
        version: '1.0.0',
        endpoints: ['/api/health', '/api/items']
    });
});

// CRUD endpoints
app.get('/api/items', ${config.enableAuth ? 'authenticateToken,' : ''} async (req, res) => {
    try {
        ${config.stackType.includes('P') ? `
        const result = await pool.query('SELECT * FROM items ORDER BY created_at DESC LIMIT 100');
        res.json(result.rows);
        ` : `
        const items = await Item.find().limit(100);
        res.json(items);
        `}
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/items', ${config.enableAuth ? 'authenticateToken,' : ''} async (req, res) => {
    try {
        const { title, content } = req.body;
        ${config.stackType.includes('P') ? `
        const result = await pool.query(
            'INSERT INTO items (title, content, user_id) VALUES ($1, $2, $3) RETURNING *',
            [title, content, req.user?.id]
        );
        res.status(201).json(result.rows[0]);
        ` : `
        const item = new Item({ title, content, userId: req.user?.id });
        await item.save();
        res.status(201).json(item);
        `}
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

${config.enableWebSocket ? `
// WebSocket
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('message', (data) => {
        io.emit('message', data);
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});
` : ''}

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || ${config.backendPort};
${config.enableWebSocket ? 'httpServer' : 'app'}.listen(PORT, '0.0.0.0', () => {
    console.log(\`Backend running on port \${PORT}\`);
});
EOF`);

        // Create .env file
        await sshExec(`cat > ${instancePath}/backend/.env << 'EOF'
NODE_ENV=production
PORT=${config.backendPort}
DATABASE_URL=postgresql://${config.dbUser}:${config.dbPassword}@localhost:${config.dbPort}/${config.dbName}
JWT_SECRET=${config.jwtSecret}
${config.enableCaching ? 'REDIS_URL=redis://localhost:6379' : ''}
EOF`);

        // 3. Setup Frontend
        await sshExec(`cat > ${instancePath}/frontend/package.json << 'EOF'
{
  "name": "${config.appName}-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "axios": "^1.6.2",
    ${config.enableWebSocket ? '"socket.io-client": "^4.6.0",' : ''}
    "react-router-dom": "^6.20.1"
  }
}
EOF`);

        // Create React app with full features
        await sshExec(`cat > ${instancePath}/frontend/src/App.js << 'EOF'
import React, { useState, useEffect } from 'react';
import axios from 'axios';
${config.enableWebSocket ? "import io from 'socket.io-client';" : ''}

const API_URL = 'http://localhost:${config.backendPort}/api';

function App() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    ${config.enableAuth ? 'const [token, setToken] = useState(localStorage.getItem("token"));' : ''}

    useEffect(() => {
        fetchItems();
        ${config.enableWebSocket ? `
        const socket = io('http://localhost:${config.backendPort}');
        socket.on('message', (data) => {
            console.log('WebSocket message:', data);
        });
        return () => socket.disconnect();
        ` : ''}
    }, []);

    const fetchItems = async () => {
        try {
            const response = await axios.get(\`\${API_URL}/items\`${config.enableAuth ? `, {
                headers: { Authorization: \`Bearer \${token}\` }
            }` : ''});
            setItems(response.data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching items:', error);
            setLoading(false);
        }
    };

    ${config.enableAuth ? `
    const handleLogin = async (username, password) => {
        try {
            const response = await axios.post(\`\${API_URL}/auth/login\`, {
                username,
                password
            });
            setToken(response.data.token);
            localStorage.setItem('token', response.data.token);
            fetchItems();
        } catch (error) {
            console.error('Login error:', error);
        }
    };
    ` : ''}

    return (
        <div style={{
            fontFamily: 'Arial, sans-serif',
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '20px'
        }}>
            <h1>${config.appName}</h1>
            <p>Full-stack application powered by NPS</p>
            
            {loading ? (
                <p>Loading...</p>
            ) : (
                <div>
                    <h2>Items ({items.length})</h2>
                    <ul>
                        {items.map(item => (
                            <li key={item.id}>{item.title}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default App;
EOF`);

        // 4. Setup Nginx reverse proxy
        await sshExec(`cat > ${instancePath}/nginx/nginx.conf << 'EOF'
upstream backend {
    server localhost:${config.backendPort};
}

upstream frontend {
    server localhost:${config.frontendPort};
}

server {
    listen ${server.port};
    server_name ${config.domain || '_'};
    
    client_max_body_size ${config.maxUploadSize}M;
    
    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\$host;
        proxy_cache_bypass \\$http_upgrade;
    }
    
    # Backend API
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_cache_bypass \\$http_upgrade;
    }
    
    # Static files
    location /uploads {
        alias ${instancePath}/uploads;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF`);

        // Install dependencies and start services
        await sshExec(`cd ${instancePath}/backend && npm install --production`);
        await sshExec(`cd ${instancePath}/frontend && npm install`);
        
        // Start backend
        await sshExec(`cd ${instancePath}/backend && nohup node server.js > ../logs/backend.log 2>&1 & echo $! > ../logs/backend.pid`);
        
        // Build and start frontend
        await sshExec(`cd ${instancePath}/frontend && npm run build`);
        await sshExec(`cd ${instancePath}/frontend && nohup npx serve -s build -l ${config.frontendPort} > ../logs/frontend.log 2>&1 & echo $! > ../logs/frontend.pid`);
        
        // Start nginx
        await sshExec(`nginx -c ${instancePath}/nginx/nginx.conf -p ${instancePath}/nginx`);
        
        return {
            instancePath,
            frontendPort: config.frontendPort,
            backendPort: config.backendPort,
            proxyPort: server.port,
            databaseUrl: `postgresql://${config.dbUser}:${config.dbPassword}@localhost:${config.dbPort}/${config.dbName}`
        };
    },

    async start(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        
        // Start database
        await sshExec(`pg_ctl -D ${instancePath}/database/data start`);
        
        // Start backend
        await sshExec(`cd ${instancePath}/backend && nohup node server.js > ../logs/backend.log 2>&1 & echo $! > ../logs/backend.pid`);
        
        // Start frontend
        await sshExec(`cd ${instancePath}/frontend && nohup npx serve -s build -l ${server.config.frontendPort} > ../logs/frontend.log 2>&1 & echo $! > ../logs/frontend.pid`);
        
        // Start nginx
        await sshExec(`nginx -c ${instancePath}/nginx/nginx.conf -p ${instancePath}/nginx`);
    },

    async stop(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        
        // Stop nginx
        await sshExec(`kill $(cat ${instancePath}/logs/nginx.pid) 2>/dev/null || true`);
        
        // Stop frontend
        await sshExec(`kill $(cat ${instancePath}/logs/frontend.pid) 2>/dev/null || true`);
        
        // Stop backend
        await sshExec(`kill $(cat ${instancePath}/logs/backend.pid) 2>/dev/null || true`);
        
        // Stop database
        await sshExec(`pg_ctl -D ${instancePath}/database/data stop`);
    },

    async delete(server, sshExec) {
        await this.stop(server, sshExec);
        await sshExec(`rm -rf ~/server/instances/${server.id}`);
    }
};
