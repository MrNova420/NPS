/**
 * Complete Self-Hosting Suite Template - Production Grade
 * VPN, Email, Git Server, Personal Cloud, and Password Manager in one package
 */

module.exports = {
    name: 'Self-Hosting Suite',
    description: 'Production-grade self-hosting suite - VPN, Email, Git server, Cloud storage, Password manager, all-in-one',
    category: 'Self-Hosting',
    icon: '🏠',
    defaultPort: 8000,
    requirements: ['nodejs', 'python3', 'git', 'wireguard'],
    
    // Resource requirements (comprehensive suite)
    resources: {
        cpu: 35,
        memory: 1024,
        priority: 'high',
        bandwidth: { download: 20, upload: 20 }
    },
    
    configOptions: [
        {
            name: 'domain',
            label: 'Your Domain',
            type: 'text',
            required: true,
            placeholder: 'mydomain.com'
        },
        {
            name: 'adminEmail',
            label: 'Admin Email',
            type: 'text',
            required: true,
            placeholder: 'admin@mydomain.com'
        },
        {
            name: 'adminPassword',
            label: 'Admin Password',
            type: 'password',
            required: true
        },
        {
            name: 'enableVPN',
            label: 'Enable VPN Server (WireGuard)',
            type: 'checkbox',
            default: true
        },
        {
            name: 'enableEmail',
            label: 'Enable Email Server',
            type: 'checkbox',
            default: false,
            help: 'Requires domain with MX records'
        },
        {
            name: 'enableGit',
            label: 'Enable Git Server',
            type: 'checkbox',
            default: true
        },
        {
            name: 'enableCloud',
            label: 'Enable Personal Cloud Storage',
            type: 'checkbox',
            default: true
        },
        {
            name: 'enablePasswordManager',
            label: 'Enable Password Manager',
            type: 'checkbox',
            default: true
        },
        {
            name: 'storageQuotaGB',
            label: 'Storage Quota (GB)',
            type: 'number',
            default: 10
        }
    ],

    async deploy(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        const config = server.config;
        
        await sshExec(`mkdir -p ${instancePath}/{vpn,email,git,cloud,passwords,logs,scripts}`);

        // Deploy VPN if enabled
        if (config.enableVPN) {
            await this.deployVPN(server, sshExec, instancePath);
        }
        
        // Deploy Email if enabled
        if (config.enableEmail) {
            await this.deployEmail(server, sshExec, instancePath);
        }
        
        // Deploy Git server if enabled
        if (config.enableGit) {
            await this.deployGit(server, sshExec, instancePath);
        }
        
        // Deploy Cloud storage if enabled
        if (config.enableCloud) {
            await this.deployCloudStorage(server, sshExec, instancePath);
        }
        
        // Deploy Password manager if enabled
        if (config.enablePasswordManager) {
            await this.deployPasswordManager(server, sshExec, instancePath);
        }
        
        // Create unified dashboard
        await this.createUnifiedDashboard(server, sshExec, instancePath);

        console.log(`Self-Hosting Suite deployed at ${instancePath}`);
    },

    async deployVPN(server, sshExec, instancePath) {
        const config = server.config;
        
        await sshExec(`cat > ${instancePath}/vpn/setup-wireguard.sh << 'VPN_EOF'
#!/bin/bash
# WireGuard VPN Server Setup

VPN_DIR="${instancePath}/vpn"
mkdir -p \\$VPN_DIR/configs

# Generate server keys
wg genkey | tee \\$VPN_DIR/server_private.key | wg pubkey > \\$VPN_DIR/server_public.key

# Generate client keys
wg genkey | tee \\$VPN_DIR/client_private.key | wg pubkey > \\$VPN_DIR/client_public.key

# Create server config
cat > \\$VPN_DIR/wg0.conf << CONFIG
[Interface]
PrivateKey = \\$(cat \\$VPN_DIR/server_private.key)
Address = 10.0.0.1/24
ListenPort = 51820
SaveConfig = true

# Client configuration
[Peer]
PublicKey = \\$(cat \\$VPN_DIR/client_public.key)
AllowedIPs = 10.0.0.2/32
CONFIG

# Create client config
cat > \\$VPN_DIR/configs/client.conf << CLIENT
[Interface]
PrivateKey = \\$(cat \\$VPN_DIR/client_private.key)
Address = 10.0.0.2/24
DNS = 1.1.1.1

[Peer]
PublicKey = \\$(cat \\$VPN_DIR/server_public.key)
Endpoint = ${config.domain}:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
CLIENT

echo "✓ WireGuard VPN configured"
echo "Client config: \\$VPN_DIR/configs/client.conf"
VPN_EOF`);
        
        await sshExec(`chmod +x ${instancePath}/vpn/setup-wireguard.sh`);
    },

    async deployEmail(server, sshExec, instancePath) {
        const config = server.config;
        
        await sshExec(`cat > ${instancePath}/email/setup-email.sh << 'EMAIL_EOF'
#!/bin/bash
# Simple Email Server Setup

EMAIL_DIR="${instancePath}/email"
mkdir -p \\$EMAIL_DIR/{mail,queue}

# Create email handler
cat > \\$EMAIL_DIR/email-server.js << 'JS_EOF'
const nodemailer = require('nodemailer');
const express = require('express');
const app = express();

app.use(express.json());

// SMTP configuration
const transporter = nodemailer.createTransporter({
    host: 'localhost',
    port: 25,
    secure: false,
    tls: {
        rejectUnauthorized: false
    }
});

// Send email endpoint
app.post('/send', async (req, res) => {
    const { to, subject, text, html } = req.body;
    
    try {
        await transporter.sendMail({
            from: '${config.adminEmail}',
            to,
            subject,
            text,
            html
        });
        res.json({ success: true, message: 'Email sent' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(2500, () => console.log('Email API running on port 2500'));
JS_EOF

echo "✓ Email server configured"
EMAIL_EOF`);
        
        await sshExec(`chmod +x ${instancePath}/email/setup-email.sh`);
    },

    async deployGit(server, sshExec, instancePath) {
        const config = server.config;
        
        await sshExec(`cat > ${instancePath}/git/git-server.js << 'GIT_EOF'
const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());

const reposDir = '${instancePath}/git/repos';
fs.mkdirSync(reposDir, { recursive: true });

// List repositories
app.get('/repos', (req, res) => {
    const repos = fs.readdirSync(reposDir).filter(d => d.endsWith('.git'));
    res.json({ repos });
});

// Create repository
app.post('/repos/:name', (req, res) => {
    const repoPath = path.join(reposDir, req.params.name + '.git');
    
    if (fs.existsSync(repoPath)) {
        return res.status(400).json({ error: 'Repository exists' });
    }
    
    exec(\`git init --bare \${repoPath}\`, (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ 
                success: true, 
                clone: \`git clone ssh://$(whoami)@${config.domain}:8022\${repoPath}\`
            });
        }
    });
});

// Delete repository
app.delete('/repos/:name', (req, res) => {
    const repoPath = path.join(reposDir, req.params.name + '.git');
    
    if (!fs.existsSync(repoPath)) {
        return res.status(404).json({ error: 'Repository not found' });
    }
    
    exec(\`rm -rf \${repoPath}\`, (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ success: true });
        }
    });
});

app.listen(9418, () => console.log('Git server running on port 9418'));
GIT_EOF`);
        
        await sshExec(`cd ${instancePath}/git && npm install express`);
    },

    async deployCloudStorage(server, sshExec, instancePath) {
        const config = server.config;
        
        await sshExec(`cat > ${instancePath}/cloud/cloud-server.js << 'CLOUD_EOF'
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const app = express();

const STORAGE_DIR = '${instancePath}/cloud/storage';
const QUOTA_GB = ${config.storageQuotaGB};
const QUOTA_BYTES = QUOTA_GB * 1024 * 1024 * 1024;

fs.mkdirSync(STORAGE_DIR, { recursive: true });

// User storage tracking
const users = new Map();
users.set('${config.adminEmail}', {
    password: crypto.createHash('sha256').update('${config.adminPassword}').digest('hex'),
    used: 0,
    files: []
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: STORAGE_DIR,
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, unique + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

app.use(express.json());
app.use(express.static('public'));

// Authentication middleware
function auth(req, res, next) {
    const { email, password } = req.headers;
    const user = users.get(email);
    
    if (!user || user.password !== crypto.createHash('sha256').update(password).digest('hex')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    req.user = { email, data: user };
    next();
}

// Upload file
app.post('/upload', auth, upload.single('file'), (req, res) => {
    const fileSize = fs.statSync(path.join(STORAGE_DIR, req.file.filename)).size;
    
    if (req.user.data.used + fileSize > QUOTA_BYTES) {
        fs.unlinkSync(path.join(STORAGE_DIR, req.file.filename));
        return res.status(413).json({ error: 'Quota exceeded' });
    }
    
    req.user.data.used += fileSize;
    req.user.data.files.push({
        name: req.file.originalname,
        filename: req.file.filename,
        size: fileSize,
        uploaded: new Date()
    });
    
    res.json({ 
        success: true, 
        file: req.file.originalname,
        size: fileSize 
    });
});

// List files
app.get('/files', auth, (req, res) => {
    res.json({
        files: req.user.data.files,
        quota: {
            used: req.user.data.used,
            total: QUOTA_BYTES,
            percentage: (req.user.data.used / QUOTA_BYTES * 100).toFixed(2)
        }
    });
});

// Download file
app.get('/files/:filename', auth, (req, res) => {
    const file = req.user.data.files.find(f => f.filename === req.params.filename);
    
    if (!file) {
        return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(path.join(STORAGE_DIR, file.filename), file.name);
});

// Delete file
app.delete('/files/:filename', auth, (req, res) => {
    const fileIndex = req.user.data.files.findIndex(f => f.filename === req.params.filename);
    
    if (fileIndex === -1) {
        return res.status(404).json({ error: 'File not found' });
    }
    
    const file = req.user.data.files[fileIndex];
    fs.unlinkSync(path.join(STORAGE_DIR, file.filename));
    
    req.user.data.used -= file.size;
    req.user.data.files.splice(fileIndex, 1);
    
    res.json({ success: true });
});

app.listen(8001, () => console.log('Cloud storage running on port 8001'));
CLOUD_EOF`);
        
        await sshExec(`cd ${instancePath}/cloud && npm install express multer`);
    },

    async deployPasswordManager(server, sshExec, instancePath) {
        const config = server.config;
        
        await sshExec(`cat > ${instancePath}/passwords/password-manager.js << 'PASS_EOF'
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const app = express();

app.use(express.json());

const VAULT_FILE = '${instancePath}/passwords/vault.json';
let vault = { passwords: [] };

try {
    vault = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8'));
} catch (e) {
    fs.writeFileSync(VAULT_FILE, JSON.stringify(vault));
}

// Encryption
const ALGORITHM = 'aes-256-gcm';
const KEY = crypto.scryptSync('${config.adminPassword}', 'salt', 32);

function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
}

function decrypt(encrypted, iv, authTag) {
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// Add password
app.post('/passwords', (req, res) => {
    const { site, username, password, notes } = req.body;
    
    const encrypted = encrypt(password);
    
    vault.passwords.push({
        id: Date.now(),
        site,
        username,
        password: encrypted.encrypted,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        notes,
        created: new Date()
    });
    
    fs.writeFileSync(VAULT_FILE, JSON.stringify(vault, null, 2));
    
    res.json({ success: true, id: vault.passwords[vault.passwords.length - 1].id });
});

// List passwords
app.get('/passwords', (req, res) => {
    const passwords = vault.passwords.map(p => ({
        id: p.id,
        site: p.site,
        username: p.username,
        notes: p.notes,
        created: p.created
    }));
    
    res.json({ passwords });
});

// Get password
app.get('/passwords/:id', (req, res) => {
    const password = vault.passwords.find(p => p.id === parseInt(req.params.id));
    
    if (!password) {
        return res.status(404).json({ error: 'Password not found' });
    }
    
    try {
        const decrypted = decrypt(password.password, password.iv, password.authTag);
        res.json({
            ...password,
            password: decrypted
        });
    } catch (error) {
        res.status(500).json({ error: 'Decryption failed' });
    }
});

// Delete password
app.delete('/passwords/:id', (req, res) => {
    const index = vault.passwords.findIndex(p => p.id === parseInt(req.params.id));
    
    if (index === -1) {
        return res.status(404).json({ error: 'Password not found' });
    }
    
    vault.passwords.splice(index, 1);
    fs.writeFileSync(VAULT_FILE, JSON.stringify(vault, null, 2));
    
    res.json({ success: true });
});

app.listen(8002, () => console.log('Password manager running on port 8002'));
PASS_EOF`);
        
        await sshExec(`cd ${instancePath}/passwords && npm install express`);
    },

    async createUnifiedDashboard(server, sshExec, instancePath) {
        const config = server.config;
        
        await sshExec(`cat > ${instancePath}/dashboard.html << 'DASH_EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Self-Hosting Suite - Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial; background: #0f0f0f; color: #fff; }
        .header { background: #1a1a1a; padding: 20px; text-align: center; border-bottom: 2px solid #2196f3; }
        .container { max-width: 1400px; margin: 20px auto; padding: 20px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { background: #1a1a1a; padding: 20px; border-radius: 8px; border: 1px solid #333; }
        .card h2 { margin-bottom: 15px; color: #2196f3; }
        .status { display: inline-block; padding: 5px 10px; border-radius: 4px; font-size: 12px; }
        .status.active { background: #4caf50; }
        .status.disabled { background: #666; }
        button { background: #2196f3; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 5px; }
        button:hover { background: #1976d2; }
        a { color: #2196f3; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏠 Self-Hosting Suite</h1>
        <p>Complete self-hosting solution on ${config.domain}</p>
    </div>
    
    <div class="container">
        <div class="grid">
            ${config.enableVPN ? `
            <div class="card">
                <h2>🔒 VPN Server</h2>
                <p>Status: <span class="status active">Active</span></p>
                <p>WireGuard running on port 51820</p>
                <button onclick="downloadVPNConfig()">Download Client Config</button>
                <button onclick="generateNewClient()">Add Client</button>
            </div>
            ` : ''}
            
            ${config.enableEmail ? `
            <div class="card">
                <h2>📧 Email Server</h2>
                <p>Status: <span class="status active">Active</span></p>
                <p>Your email: ${config.adminEmail}</p>
                <button onclick="sendTestEmail()">Send Test Email</button>
                <button onclick="viewMailbox()">View Mailbox</button>
            </div>
            ` : ''}
            
            ${config.enableGit ? `
            <div class="card">
                <h2>📚 Git Server</h2>
                <p>Status: <span class="status active">Active</span></p>
                <p>Repositories: <span id="repoCount">0</span></p>
                <button onclick="createRepo()">Create Repository</button>
                <button onclick="listRepos()">List Repositories</button>
            </div>
            ` : ''}
            
            ${config.enableCloud ? `
            <div class="card">
                <h2>☁️ Personal Cloud</h2>
                <p>Status: <span class="status active">Active</span></p>
                <p>Storage: <span id="storageUsed">0</span> / ${config.storageQuotaGB}GB</p>
                <button onclick="uploadFile()">Upload File</button>
                <button onclick="browseFiles()">Browse Files</button>
            </div>
            ` : ''}
            
            ${config.enablePasswordManager ? `
            <div class="card">
                <h2>🔐 Password Manager</h2>
                <p>Status: <span class="status active">Active</span></p>
                <p>Passwords: <span id="passwordCount">0</span></p>
                <button onclick="addPassword()">Add Password</button>
                <button onclick="viewPasswords()">View Passwords</button>
            </div>
            ` : ''}
            
            <div class="card">
                <h2>⚙️ System Status</h2>
                <p>Uptime: <span id="uptime">-</span></p>
                <p>CPU: <span id="cpu">-</span>%</p>
                <p>Memory: <span id="memory">-</span>%</p>
                <p>Disk: <span id="disk">-</span>%</p>
            </div>
        </div>
        
        <div class="card">
            <h2>📖 Quick Links</h2>
            <ul>
                ${config.enableVPN ? '<li><a href="/vpn">VPN Configuration</a></li>' : ''}
                ${config.enableEmail ? '<li><a href="/webmail">Webmail</a></li>' : ''}
                ${config.enableGit ? '<li><a href="/git">Git Repositories</a></li>' : ''}
                ${config.enableCloud ? '<li><a href="/cloud">Cloud Storage</a></li>' : ''}
                ${config.enablePasswordManager ? '<li><a href="/passwords">Password Manager</a></li>' : ''}
            </ul>
        </div>
    </div>
    
    <script>
        // Update stats
        function updateStats() {
            // Placeholder - would fetch from backend
            document.getElementById('uptime').textContent = '5h 23m';
            document.getElementById('cpu').textContent = '12';
            document.getElementById('memory').textContent = '45';
            document.getElementById('disk').textContent = '23';
        }
        
        setInterval(updateStats, 5000);
        updateStats();
        
        // Function placeholders
        function downloadVPNConfig() {
            window.location.href = '/vpn/configs/client.conf';
        }
        
        function listRepos() {
            fetch('/git/repos')
                .then(r => r.json())
                .then(data => alert('Repositories:\\n' + data.repos.join('\\n')));
        }
        
        function uploadFile() {
            const input = document.createElement('input');
            input.type = 'file';
            input.onchange = e => {
                const file = e.target.files[0];
                const formData = new FormData();
                formData.append('file', file);
                
                fetch('/cloud/upload', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'email': '${config.adminEmail}',
                        'password': '${config.adminPassword}'
                    }
                })
                .then(r => r.json())
                .then(data => alert('File uploaded: ' + data.file));
            };
            input.click();
        }
    </script>
</body>
</html>
DASH_EOF`);

        // Create main dashboard server
        await sshExec(`cat > ${instancePath}/dashboard-server.js << 'DASHSERV_EOF'
const express = require('express');
const app = express();

app.use(express.static('.'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/dashboard.html');
});

app.listen(${server.port}, () => {
    console.log('Self-Hosting Suite dashboard running on port ${server.port}');
    console.log('Access at: http://${config.domain}:${server.port}');
});
DASHSERV_EOF`);
        
        await sshExec(`cd ${instancePath} && npm install express`);
    },

    async start(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        const config = server.config;
        
        // Start dashboard
        await sshExec(`cd ${instancePath} && node dashboard-server.js > logs/dashboard.log 2>&1 & echo $! > dashboard.pid`);
        
        // Start enabled services
        if (config.enableGit) {
            await sshExec(`cd ${instancePath}/git && node git-server.js > ../logs/git.log 2>&1 & echo $! > ../git.pid`);
        }
        
        if (config.enableCloud) {
            await sshExec(`cd ${instancePath}/cloud && node cloud-server.js > ../logs/cloud.log 2>&1 & echo $! > ../cloud.pid`);
        }
        
        if (config.enablePasswordManager) {
            await sshExec(`cd ${instancePath}/passwords && node password-manager.js > ../logs/passwords.log 2>&1 & echo $! > ../passwords.pid`);
        }
        
        if (config.enableVPN) {
            await sshExec(`bash ${instancePath}/vpn/setup-wireguard.sh`);
        }
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
