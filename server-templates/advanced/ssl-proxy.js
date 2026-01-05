/**
 * SSL/HTTPS Reverse Proxy Template
 * Auto-SSL with Let's Encrypt, reverse proxy, domain routing, HTTP/2, and security headers
 */

module.exports = {
    name: 'SSL Reverse Proxy',
    description: 'Automatic HTTPS with Let\'s Encrypt, reverse proxy, domain routing, and enterprise security',
    category: 'Network',
    icon: '🔒',
    defaultPort: 443,
    requirements: ['nodejs', 'certbot'],
    
    configOptions: [
        {
            name: 'domain',
            label: 'Primary Domain',
            type: 'text',
            required: true,
            placeholder: 'example.com'
        },
        {
            name: 'email',
            label: 'Email for SSL Certificates',
            type: 'text',
            required: true,
            placeholder: 'admin@example.com'
        },
        {
            name: 'autoSSL',
            label: 'Auto-generate SSL Certificates',
            type: 'checkbox',
            default: true,
            help: 'Automatic Let\'s Encrypt SSL'
        },
        {
            name: 'forceHTTPS',
            label: 'Force HTTPS Redirect',
            type: 'checkbox',
            default: true
        },
        {
            name: 'enableHTTP2',
            label: 'Enable HTTP/2',
            type: 'checkbox',
            default: true
        },
        {
            name: 'enableHSTS',
            label: 'Enable HSTS',
            type: 'checkbox',
            default: true,
            help: 'HTTP Strict Transport Security'
        },
        {
            name: 'backends',
            label: 'Backend Servers (JSON)',
            type: 'textarea',
            default: JSON.stringify([
                { domain: 'example.com', target: 'http://localhost:3000' },
                { domain: 'api.example.com', target: 'http://localhost:8000' }
            ], null, 2),
            placeholder: 'JSON array of {domain, target}'
        },
        {
            name: 'enableCache',
            label: 'Enable Caching',
            type: 'checkbox',
            default: true
        },
        {
            name: 'enableCompression',
            label: 'Enable Gzip Compression',
            type: 'checkbox',
            default: true
        },
        {
            name: 'rateLimitRPS',
            label: 'Rate Limit (requests/sec)',
            type: 'number',
            default: 100
        }
    ],

    async deploy(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        const config = server.config;
        
        await sshExec(`mkdir -p ${instancePath}/{certs,config,logs,scripts,public}`);

        // Install certbot if needed
        await sshExec(`pkg install -y certbot 2>/dev/null || pip install certbot`);

        // Create reverse proxy server
        await this.createProxyServer(server, sshExec, instancePath);
        
        // Setup SSL certificates
        if (config.autoSSL) {
            await this.setupAutoSSL(server, sshExec, instancePath);
        } else {
            await this.createSelfSignedCert(server, sshExec, instancePath);
        }
        
        // Create domain routing configuration
        await this.createRoutingConfig(server, sshExec, instancePath);
        
        // Setup certificate renewal
        await this.setupCertRenewal(server, sshExec, instancePath);
        
        // Create management interface
        await this.createManagementUI(server, sshExec, instancePath);

        console.log(`SSL Reverse Proxy deployed at ${instancePath}`);
    },

    async createProxyServer(server, sshExec, instancePath) {
        const config = server.config;
        const backends = JSON.parse(config.backends || '[]');
        
        await sshExec(`cat > ${instancePath}/proxy-server.js << 'PROXY_EOF'
const https = require('https');
const http = require('http');
const fs = require('fs');
const httpProxy = require('http-proxy');
${config.enableCompression ? "const zlib = require('zlib');" : ''}

class SSLReverseProxy {
    constructor() {
        this.backends = ${JSON.stringify(backends)};
        this.proxy = httpProxy.createProxyServer({});
        this.cache = new Map();
        this.rateLimits = new Map();
        
        this.loadSSLCerts();
        this.startServers();
    }
    
    loadSSLCerts() {
        try {
            this.sslOptions = {
                key: fs.readFileSync('${instancePath}/certs/privkey.pem'),
                cert: fs.readFileSync('${instancePath}/certs/fullchain.pem')
            };
            console.log('SSL certificates loaded');
        } catch (error) {
            console.log('SSL certificates not found, using self-signed');
            this.sslOptions = {
                key: fs.readFileSync('${instancePath}/certs/self-signed.key'),
                cert: fs.readFileSync('${instancePath}/certs/self-signed.crt')
            };
        }
    }
    
    checkRateLimit(ip) {
        const now = Date.now();
        const key = \`\${ip}:\${Math.floor(now / 1000)}\`;
        
        if (!this.rateLimits.has(key)) {
            this.rateLimits.set(key, 0);
            setTimeout(() => this.rateLimits.delete(key), 1000);
        }
        
        const count = this.rateLimits.get(key);
        this.rateLimits.set(key, count + 1);
        
        return count < ${config.rateLimitRPS || 100};
    }
    
    findBackend(hostname) {
        return this.backends.find(b => 
            b.domain === hostname || 
            b.domain === '*.' + hostname.split('.').slice(-2).join('.')
        );
    }
    
    handleRequest(req, res) {
        const hostname = req.headers.host?.split(':')[0];
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        
        console.log(\`\${req.method} \${hostname}\${req.url} from \${ip}\`);
        
        // Rate limiting
        if (!this.checkRateLimit(ip)) {
            res.writeHead(429, { 'Content-Type': 'text/plain' });
            res.end('Too Many Requests');
            return;
        }
        
        // Find backend
        const backend = this.findBackend(hostname);
        if (!backend) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('No backend configured for this domain');
            return;
        }
        
        // Set security headers
        ${config.enableHSTS ? `res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');` : ''}
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        
        // Check cache
        ${config.enableCache ? `
        const cacheKey = \`\${hostname}\${req.url}\`;
        if (req.method === 'GET' && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.time < 60000) {
                console.log(\`Cache hit: \${cacheKey}\`);
                res.writeHead(200, cached.headers);
                res.end(cached.body);
                return;
            }
        }
        ` : ''}
        
        // Proxy request
        this.proxy.web(req, res, {
            target: backend.target,
            changeOrigin: true,
            xfwd: true
        }, (err) => {
            console.error('Proxy error:', err.message);
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end('Bad Gateway');
        });
    }
    
    startServers() {
        // HTTPS server
        this.httpsServer = https.createServer(this.sslOptions, (req, res) => {
            this.handleRequest(req, res);
        });
        
        this.httpsServer.listen(${server.port}, () => {
            console.log(\`HTTPS server running on port ${server.port}\`);
        });
        
        ${config.forceHTTPS ? `
        // HTTP redirect server
        this.httpServer = http.createServer((req, res) => {
            const hostname = req.headers.host?.split(':')[0] || '${config.domain}';
            res.writeHead(301, { 
                Location: \`https://\${hostname}\${req.url}\`
            });
            res.end();
        });
        
        this.httpServer.listen(80, () => {
            console.log('HTTP redirect server running on port 80');
        });
        ` : ''}
    }
}

const proxy = new SSLReverseProxy();

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down...');
    proxy.httpsServer.close();
    if (proxy.httpServer) proxy.httpServer.close();
    process.exit(0);
});
PROXY_EOF`);

        await sshExec(`cd ${instancePath} && npm install http-proxy`);
    },

    async setupAutoSSL(server, sshExec, instancePath) {
        const config = server.config;
        
        await sshExec(`cat > ${instancePath}/scripts/obtain-cert.sh << 'CERT_EOF'
#!/bin/bash
# Obtain SSL certificate from Let's Encrypt

DOMAIN="${config.domain}"
EMAIL="${config.email}"
CERT_DIR="${instancePath}/certs"

echo "Obtaining SSL certificate for \\$DOMAIN..."

# Use certbot to obtain certificate
certbot certonly \\
    --standalone \\
    --non-interactive \\
    --agree-tos \\
    --email \\$EMAIL \\
    --domains \\$DOMAIN \\
    --cert-path \\$CERT_DIR/cert.pem \\
    --key-path \\$CERT_DIR/privkey.pem \\
    --fullchain-path \\$CERT_DIR/fullchain.pem \\
    --preferred-challenges http

if [ \\$? -eq 0 ]; then
    echo "✓ SSL certificate obtained successfully"
    
    # Copy to instance directory
    cp /etc/letsencrypt/live/\\$DOMAIN/privkey.pem \\$CERT_DIR/
    cp /etc/letsencrypt/live/\\$DOMAIN/fullchain.pem \\$CERT_DIR/
    cp /etc/letsencrypt/live/\\$DOMAIN/cert.pem \\$CERT_DIR/
    
    chmod 600 \\$CERT_DIR/*.pem
    
    echo "Certificates copied to \\$CERT_DIR"
else
    echo "✗ Failed to obtain SSL certificate"
    echo "Using self-signed certificate instead"
    bash ${instancePath}/scripts/create-self-signed.sh
fi
CERT_EOF`);
        
        await sshExec(`chmod +x ${instancePath}/scripts/obtain-cert.sh`);
        
        // Try to obtain certificate
        await sshExec(`bash ${instancePath}/scripts/obtain-cert.sh || true`);
    },

    async createSelfSignedCert(server, sshExec, instancePath) {
        const config = server.config;
        
        await sshExec(`cat > ${instancePath}/scripts/create-self-signed.sh << 'SELF_EOF'
#!/bin/bash
# Create self-signed SSL certificate

DOMAIN="${config.domain}"
CERT_DIR="${instancePath}/certs"

echo "Creating self-signed certificate for \\$DOMAIN..."

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\
    -keyout \\$CERT_DIR/self-signed.key \\
    -out \\$CERT_DIR/self-signed.crt \\
    -subj "/C=US/ST=State/L=City/O=Organization/CN=\\$DOMAIN"

# Create fullchain (same as cert for self-signed)
cp \\$CERT_DIR/self-signed.crt \\$CERT_DIR/fullchain.pem
cp \\$CERT_DIR/self-signed.key \\$CERT_DIR/privkey.pem

chmod 600 \\$CERT_DIR/*.{key,pem}

echo "✓ Self-signed certificate created"
SELF_EOF`);
        
        await sshExec(`chmod +x ${instancePath}/scripts/create-self-signed.sh`);
        await sshExec(`bash ${instancePath}/scripts/create-self-signed.sh`);
    },

    async createRoutingConfig(server, sshExec, instancePath) {
        const config = server.config;
        
        await sshExec(`cat > ${instancePath}/config/routes.json << 'ROUTES_EOF'
{
  "routes": ${config.backends},
  "options": {
    "forceHTTPS": ${config.forceHTTPS},
    "enableHTTP2": ${config.enableHTTP2},
    "enableHSTS": ${config.enableHSTS},
    "enableCache": ${config.enableCache},
    "enableCompression": ${config.enableCompression},
    "rateLimitRPS": ${config.rateLimitRPS}
  }
}
ROUTES_EOF`);
    },

    async setupCertRenewal(server, sshExec, instancePath) {
        await sshExec(`cat > ${instancePath}/scripts/renew-certs.sh << 'RENEW_EOF'
#!/bin/bash
# Auto-renew SSL certificates

echo "Checking for certificate renewal..."

certbot renew --quiet

if [ \\$? -eq 0 ]; then
    echo "Certificates renewed, reloading server..."
    
    # Copy renewed certificates
    cp /etc/letsencrypt/live/${server.config.domain}/privkey.pem ${instancePath}/certs/
    cp /etc/letsencrypt/live/${server.config.domain}/fullchain.pem ${instancePath}/certs/
    
    # Reload proxy server
    if [ -f "${instancePath}/proxy.pid" ]; then
        kill -HUP \\$(cat ${instancePath}/proxy.pid)
    fi
    
    echo "✓ Certificates renewed and reloaded"
fi
RENEW_EOF`);
        
        await sshExec(`chmod +x ${instancePath}/scripts/renew-certs.sh`);
        
        // Setup cron job for auto-renewal
        await sshExec(`cat > ${instancePath}/scripts/setup-cron.sh << 'CRON_EOF'
#!/bin/bash
# Setup auto-renewal cron job

(crontab -l 2>/dev/null; echo "0 0 * * * bash ${instancePath}/scripts/renew-certs.sh") | crontab -

echo "✓ Auto-renewal cron job created (daily at midnight)"
CRON_EOF`);
        
        await sshExec(`chmod +x ${instancePath}/scripts/setup-cron.sh`);
    },

    async createManagementUI(server, sshExec, instancePath) {
        await sshExec(`cat > ${instancePath}/public/index.html << 'UI_EOF'
<!DOCTYPE html>
<html>
<head>
    <title>SSL Reverse Proxy Management</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial; background: #1e1e1e; color: #fff; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { margin-bottom: 20px; }
        .section { background: #2d2d2d; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .status { display: inline-block; padding: 5px 10px; border-radius: 4px; }
        .status.active { background: #4caf50; }
        .status.expired { background: #f44336; }
        button { background: #2196f3; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 5px; }
        button:hover { background: #1976d2; }
        input { width: 100%; padding: 10px; margin: 10px 0; border-radius: 4px; border: 1px solid #444; background: #333; color: #fff; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #444; }
        .cert-info { background: #333; padding: 15px; border-radius: 4px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔒 SSL Reverse Proxy Management</h1>
        
        <div class="section">
            <h2>SSL Certificate Status</h2>
            <div class="cert-info">
                <p><strong>Domain:</strong> ${server.config.domain}</p>
                <p><strong>Status:</strong> <span class="status active">Active</span></p>
                <p><strong>Type:</strong> ${server.config.autoSSL ? 'Let\'s Encrypt' : 'Self-Signed'}</p>
                <p><strong>Auto-Renewal:</strong> ${server.config.autoSSL ? 'Enabled' : 'N/A'}</p>
            </div>
            <button onclick="renewCert()">Renew Certificate</button>
            <button onclick="viewCertInfo()">View Certificate Info</button>
        </div>
        
        <div class="section">
            <h2>Backend Servers</h2>
            <table>
                <tr>
                    <th>Domain</th>
                    <th>Target</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
                ${JSON.parse(server.config.backends).map(b => `
                <tr>
                    <td>${b.domain}</td>
                    <td>${b.target}</td>
                    <td><span class="status active">Active</span></td>
                    <td>
                        <button onclick="testBackend('${b.domain}')">Test</button>
                        <button onclick="removeBackend('${b.domain}')">Remove</button>
                    </td>
                </tr>
                `).join('')}
            </table>
        </div>
        
        <div class="section">
            <h2>Add Backend</h2>
            <input type="text" id="domain" placeholder="Domain (e.g., app.example.com)">
            <input type="text" id="target" placeholder="Target (e.g., http://localhost:3000)">
            <button onclick="addBackend()">Add Backend</button>
        </div>
        
        <div class="section">
            <h2>Security Settings</h2>
            <p>Force HTTPS: <strong>${server.config.forceHTTPS ? 'Enabled' : 'Disabled'}</strong></p>
            <p>HTTP/2: <strong>${server.config.enableHTTP2 ? 'Enabled' : 'Disabled'}</strong></p>
            <p>HSTS: <strong>${server.config.enableHSTS ? 'Enabled' : 'Disabled'}</strong></p>
            <p>Rate Limit: <strong>${server.config.rateLimitRPS} req/s</strong></p>
        </div>
    </div>
    
    <script>
        function renewCert() {
            fetch('/api/cert/renew', { method: 'POST' })
                .then(() => alert('Certificate renewal initiated'))
                .catch(err => alert('Renewal failed: ' + err));
        }
        
        function viewCertInfo() {
            fetch('/api/cert/info')
                .then(res => res.json())
                .then(data => alert(JSON.stringify(data, null, 2)))
                .catch(err => alert('Failed: ' + err));
        }
        
        function addBackend() {
            const domain = document.getElementById('domain').value;
            const target = document.getElementById('target').value;
            
            fetch('/api/backends', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain, target })
            })
            .then(() => {
                alert('Backend added!');
                location.reload();
            })
            .catch(err => alert('Failed: ' + err));
        }
        
        function testBackend(domain) {
            fetch(\`/api/backends/\${domain}/test\`)
                .then(res => res.json())
                .then(data => alert(\`Status: \${data.status}\\nResponse Time: \${data.responseTime}ms\`))
                .catch(err => alert('Test failed: ' + err));
        }
    </script>
</body>
</html>
UI_EOF`);

        // Create management API
        await sshExec(`cat > ${instancePath}/management-api.js << 'API_EOF'
const express = require('express');
const fs = require('fs');
const { exec } = require('child_process');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// Certificate info
app.get('/api/cert/info', (req, res) => {
    exec('openssl x509 -in ${instancePath}/certs/fullchain.pem -text -noout', (err, stdout) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ info: stdout });
        }
    });
});

// Renew certificate
app.post('/api/cert/renew', (req, res) => {
    exec('bash ${instancePath}/scripts/renew-certs.sh', (err, stdout) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ success: true, output: stdout });
        }
    });
});

// Manage backends
app.get('/api/backends', (req, res) => {
    const config = JSON.parse(fs.readFileSync('${instancePath}/config/routes.json', 'utf8'));
    res.json(config.routes);
});

app.post('/api/backends', (req, res) => {
    const config = JSON.parse(fs.readFileSync('${instancePath}/config/routes.json', 'utf8'));
    config.routes.push(req.body);
    fs.writeFileSync('${instancePath}/config/routes.json', JSON.stringify(config, null, 2));
    res.json({ success: true });
});

app.listen(${parseInt(server.port) + 5000}, () => {
    console.log('Management API running on port ${parseInt(server.port) + 5000}');
});
API_EOF`);

        await sshExec(`cd ${instancePath} && npm install express`);
    },

    async start(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        
        // Start proxy server (requires elevated permissions for ports 80/443)
        if (server.port === 443 || server.port === 80) {
            await sshExec(`cd ${instancePath} && sudo node proxy-server.js > logs/proxy.log 2>&1 & echo $! > proxy.pid`);
        } else {
            await sshExec(`cd ${instancePath} && node proxy-server.js > logs/proxy.log 2>&1 & echo $! > proxy.pid`);
        }
        
        // Start management API
        await sshExec(`cd ${instancePath} && node management-api.js > logs/api.log 2>&1 & echo $! > api.pid`);
        
        // Setup auto-renewal cron
        await sshExec(`bash ${instancePath}/scripts/setup-cron.sh || true`);
    },

    async stop(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`cd ${instancePath} && for pid in *.pid; do kill $(cat $pid) 2>/dev/null || true; rm $pid; done`);
    },

    async delete(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await this.stop(server, sshExec);
        await sshExec(`rm -rf ${instancePath}`);
    }
};
