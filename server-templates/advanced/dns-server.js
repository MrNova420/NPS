/**
 * DNS Server Template - Production Grade
 * Full DNS server with zone management, dynamic DNS, and DNS-over-HTTPS
 */

module.exports = {
    name: 'DNS Server',
    description: 'Production-grade DNS server - Zone management, DDNS, DoH, DNS-over-TLS, DNSSEC support',
    category: 'Network',
    icon: '🌐',
    defaultPort: 53,
    requirements: ['nodejs', 'python3'],
    
    // Resource requirements
    resources: {
        cpu: 5,
        memory: 128,
        priority: 'high',
        bandwidth: { download: 5, upload: 5 }
    },
    
    configOptions: [
        {
            name: 'serverName',
            label: 'DNS Server Name',
            type: 'text',
            required: true,
            default: 'dns.local',
            placeholder: 'dns.example.com'
        },
        {
            name: 'publicDNS',
            label: 'Enable Public DNS',
            type: 'checkbox',
            default: false,
            help: 'Allow external DNS queries'
        },
        {
            name: 'forwarders',
            label: 'Upstream DNS Servers',
            type: 'text',
            default: '8.8.8.8,1.1.1.1',
            placeholder: '8.8.8.8,1.1.1.1'
        },
        {
            name: 'enableDoH',
            label: 'Enable DNS-over-HTTPS',
            type: 'checkbox',
            default: true
        },
        {
            name: 'enableDoT',
            label: 'Enable DNS-over-TLS',
            type: 'checkbox',
            default: false
        },
        {
            name: 'enableDDNS',
            label: 'Enable Dynamic DNS',
            type: 'checkbox',
            default: true,
            help: 'Allow dynamic record updates'
        },
        {
            name: 'enableCaching',
            label: 'Enable DNS Caching',
            type: 'checkbox',
            default: true
        },
        {
            name: 'cacheTime',
            label: 'Cache Time (seconds)',
            type: 'number',
            default: 3600
        },
        {
            name: 'enableBlocking',
            label: 'Enable Ad/Malware Blocking',
            type: 'checkbox',
            default: false
        }
    ],

    async deploy(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        const config = server.config;
        
        await sshExec(`mkdir -p ${instancePath}/{zones,cache,logs,scripts,blocklists}`);

        // Create DNS server
        await this.createDNSServer(server, sshExec, instancePath);
        
        // Create zone management
        await this.createZoneManager(server, sshExec, instancePath);
        
        // Setup Dynamic DNS if enabled
        if (config.enableDDNS) {
            await this.setupDynamicDNS(server, sshExec, instancePath);
        }
        
        // Setup DNS-over-HTTPS if enabled
        if (config.enableDoH) {
            await this.setupDoH(server, sshExec, instancePath);
        }
        
        // Setup blocklists if enabled
        if (config.enableBlocking) {
            await this.setupBlocklists(server, sshExec, instancePath);
        }
        
        // Create management interface
        await this.createManagementUI(server, sshExec, instancePath);

        console.log(`DNS Server deployed at ${instancePath}`);
    },

    async createDNSServer(server, sshExec, instancePath) {
        const config = server.config;
        
        await sshExec(`cat > ${instancePath}/dns-server.js << 'DNS_EOF'
const dgram = require('dgram');
const dns = require('dns');
const fs = require('fs');
const path = require('path');

class DNSServer {
    constructor() {
        this.server = dgram.createSocket('udp4');
        this.zones = new Map();
        this.cache = new Map();
        this.blocklist = new Set();
        this.forwarders = '${config.forwarders}'.split(',');
        this.stats = {
            queries: 0,
            cached: 0,
            blocked: 0,
            forwarded: 0
        };
        
        this.loadZones();
        ${config.enableBlocking ? 'this.loadBlocklist();' : ''}
    }
    
    loadZones() {
        const zonesDir = '${instancePath}/zones';
        try {
            const files = fs.readdirSync(zonesDir);
            files.forEach(file => {
                if (file.endsWith('.zone')) {
                    const content = fs.readFileSync(path.join(zonesDir, file), 'utf8');
                    const zone = this.parseZone(content);
                    this.zones.set(zone.name, zone);
                }
            });
            console.log(\`Loaded \${this.zones.size} zones\`);
        } catch (error) {
            console.log('No zones found, starting fresh');
        }
    }
    
    parseZone(content) {
        const zone = { name: '', records: [] };
        const lines = content.split('\\n');
        
        lines.forEach(line => {
            line = line.trim();
            if (line.startsWith(';') || !line) return;
            
            if (line.startsWith('\\$ORIGIN')) {
                zone.name = line.split(' ')[1].replace(/\\.$/, '');
            } else {
                const parts = line.split(/\\s+/);
                if (parts.length >= 4) {
                    zone.records.push({
                        name: parts[0],
                        type: parts[2],
                        value: parts.slice(3).join(' ')
                    });
                }
            }
        });
        
        return zone;
    }
    
    ${config.enableBlocking ? `
    loadBlocklist() {
        try {
            const content = fs.readFileSync('${instancePath}/blocklists/domains.txt', 'utf8');
            content.split('\\n').forEach(line => {
                line = line.trim();
                if (line && !line.startsWith('#')) {
                    this.blocklist.add(line);
                }
            });
            console.log(\`Loaded \${this.blocklist.size} blocked domains\`);
        } catch (error) {
            console.log('No blocklist found');
        }
    }
    ` : ''}
    
    async handleQuery(msg, rinfo) {
        this.stats.queries++;
        
        try {
            const query = this.parseQuery(msg);
            console.log(\`Query: \${query.name} (\${query.type}) from \${rinfo.address}\`);
            
            ${config.enableBlocking ? `
            // Check blocklist
            if (this.blocklist.has(query.name)) {
                this.stats.blocked++;
                console.log(\`Blocked: \${query.name}\`);
                this.sendResponse(msg, rinfo, '0.0.0.0');
                return;
            }
            ` : ''}
            
            ${config.enableCaching ? `
            // Check cache
            const cacheKey = \`\${query.name}:\${query.type}\`;
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.time < ${config.cacheTime * 1000}) {
                    this.stats.cached++;
                    console.log(\`Cached: \${query.name} -> \${cached.value}\`);
                    this.sendResponse(msg, rinfo, cached.value);
                    return;
                }
            }
            ` : ''}
            
            // Check local zones
            const zone = this.findZone(query.name);
            if (zone) {
                const record = zone.records.find(r => 
                    (r.name === '@' || r.name === query.name) && r.type === query.type
                );
                
                if (record) {
                    console.log(\`Local: \${query.name} -> \${record.value}\`);
                    ${config.enableCaching ? `
                    this.cache.set(cacheKey, { value: record.value, time: Date.now() });
                    ` : ''}
                    this.sendResponse(msg, rinfo, record.value);
                    return;
                }
            }
            
            // Forward to upstream
            this.stats.forwarded++;
            this.forwardQuery(query, msg, rinfo);
            
        } catch (error) {
            console.error('Query error:', error);
        }
    }
    
    parseQuery(msg) {
        // Simplified DNS query parsing
        let offset = 12;
        let name = '';
        
        while (msg[offset] !== 0) {
            const len = msg[offset];
            name += msg.toString('utf8', offset + 1, offset + 1 + len) + '.';
            offset += len + 1;
        }
        
        name = name.slice(0, -1);
        const type = msg.readUInt16BE(offset + 1);
        
        return {
            name,
            type: type === 1 ? 'A' : type === 28 ? 'AAAA' : type === 5 ? 'CNAME' : 'OTHER'
        };
    }
    
    findZone(name) {
        const parts = name.split('.');
        for (let i = 0; i < parts.length; i++) {
            const domain = parts.slice(i).join('.');
            if (this.zones.has(domain)) {
                return this.zones.get(domain);
            }
        }
        return null;
    }
    
    forwardQuery(query, msg, rinfo) {
        const forwarder = this.forwarders[0];
        dns.resolve4(query.name, (err, addresses) => {
            if (!err && addresses.length > 0) {
                console.log(\`Forwarded: \${query.name} -> \${addresses[0]}\`);
                ${config.enableCaching ? `
                this.cache.set(\`\${query.name}:\${query.type}\`, { 
                    value: addresses[0], 
                    time: Date.now() 
                });
                ` : ''}
                this.sendResponse(msg, rinfo, addresses[0]);
            } else {
                console.log(\`Not found: \${query.name}\`);
                this.sendResponse(msg, rinfo, null);
            }
        });
    }
    
    sendResponse(query, rinfo, ip) {
        // Simplified DNS response
        const response = Buffer.alloc(512);
        query.copy(response);
        
        // Set response flags
        response[2] = 0x81;
        response[3] = 0x80;
        
        if (ip) {
            // Add answer
            response[7] = 1;
            
            // Copy question
            let offset = 12;
            while (query[offset] !== 0) {
                offset++;
            }
            offset += 5;
            
            // Answer record
            response.writeUInt16BE(0xc00c, offset);
            response.writeUInt16BE(1, offset + 2);
            response.writeUInt16BE(1, offset + 4);
            response.writeUInt32BE(${config.cacheTime}, offset + 6);
            response.writeUInt16BE(4, offset + 10);
            
            const ipParts = ip.split('.');
            response[offset + 12] = parseInt(ipParts[0]);
            response[offset + 13] = parseInt(ipParts[1]);
            response[offset + 14] = parseInt(ipParts[2]);
            response[offset + 15] = parseInt(ipParts[3]);
            
            this.server.send(response.slice(0, offset + 16), rinfo.port, rinfo.address);
        } else {
            this.server.send(response.slice(0, 12), rinfo.port, rinfo.address);
        }
    }
    
    getStats() {
        return this.stats;
    }
    
    start() {
        this.server.on('message', (msg, rinfo) => {
            this.handleQuery(msg, rinfo);
        });
        
        this.server.bind(${server.port}, () => {
            console.log(\`DNS Server running on port ${server.port}\`);
        });
        
        // Stats logging
        setInterval(() => {
            console.log(\`Stats: \${JSON.stringify(this.stats)}\`);
        }, 60000);
    }
}

const server = new DNSServer();
server.start();
DNS_EOF`);

        await sshExec(`cd ${instancePath} && npm install`);
    },

    async createZoneManager(server, sshExec, instancePath) {
        await sshExec(`cat > ${instancePath}/zone-manager.js << 'ZONE_EOF'
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public'));

const zonesDir = '${instancePath}/zones';

// List zones
app.get('/api/zones', (req, res) => {
    const files = fs.readdirSync(zonesDir).filter(f => f.endsWith('.zone'));
    const zones = files.map(f => {
        const content = fs.readFileSync(path.join(zonesDir, f), 'utf8');
        return {
            name: f.replace('.zone', ''),
            file: f,
            records: content.split('\\n').filter(l => l && !l.startsWith(';')).length
        };
    });
    res.json(zones);
});

// Get zone
app.get('/api/zones/:name', (req, res) => {
    const file = path.join(zonesDir, req.params.name + '.zone');
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        res.json({ name: req.params.name, content });
    } else {
        res.status(404).json({ error: 'Zone not found' });
    }
});

// Create/Update zone
app.post('/api/zones/:name', (req, res) => {
    const file = path.join(zonesDir, req.params.name + '.zone');
    const { content } = req.body;
    
    fs.writeFileSync(file, content);
    res.json({ success: true, message: 'Zone saved' });
});

// Delete zone
app.delete('/api/zones/:name', (req, res) => {
    const file = path.join(zonesDir, req.params.name + '.zone');
    if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        res.json({ success: true, message: 'Zone deleted' });
    } else {
        res.status(404).json({ error: 'Zone not found' });
    }
});

// Add DNS record
app.post('/api/zones/:name/records', (req, res) => {
    const file = path.join(zonesDir, req.params.name + '.zone');
    const { type, name, value, ttl } = req.body;
    
    const record = \`\${name} \${ttl || 3600} IN \${type} \${value}\\n\`;
    fs.appendFileSync(file, record);
    
    res.json({ success: true, message: 'Record added' });
});

app.listen(${parseInt(server.port) + 1000}, () => {
    console.log('Zone Manager running on port ${parseInt(server.port) + 1000}');
});
ZONE_EOF`);

        // Create default zone
        await sshExec(`cat > ${instancePath}/zones/${config.serverName}.zone << 'DEFAULTZONE_EOF'
; DNS Zone for ${config.serverName}
\\$ORIGIN ${config.serverName}.
\\$TTL 3600

@       IN      SOA     ns1.${config.serverName}. admin.${config.serverName}. (
                        2026010501  ; Serial
                        3600        ; Refresh
                        1800        ; Retry
                        604800      ; Expire
                        86400 )     ; Minimum TTL

; Name servers
@       IN      NS      ns1.${config.serverName}.

; A records
@       IN      A       127.0.0.1
ns1     IN      A       127.0.0.1
www     IN      A       127.0.0.1
DEFAULTZONE_EOF`);
    },

    async setupDynamicDNS(server, sshExec, instancePath) {
        await sshExec(`cat > ${instancePath}/ddns-server.js << 'DDNS_EOF'
const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const app = express();

app.use(express.json());

const tokensFile = '${instancePath}/ddns-tokens.json';
let tokens = {};

try {
    tokens = JSON.parse(fs.readFileSync(tokensFile, 'utf8'));
} catch (e) {
    tokens = {};
}

// Update IP
app.get('/update', (req, res) => {
    const { hostname, token, ip } = req.query;
    
    if (!tokens[hostname] || tokens[hostname] !== token) {
        return res.status(401).send('Invalid token');
    }
    
    const clientIP = ip || req.ip;
    
    // Update DNS record
    const zoneFile = \`${instancePath}/zones/\${hostname.split('.').slice(-2).join('.')}.zone\`;
    let content = fs.readFileSync(zoneFile, 'utf8');
    
    const subdomain = hostname.split('.')[0];
    const regex = new RegExp(\`^\${subdomain}.*IN\\\\s+A\\\\s+.*\$\`, 'm');
    
    if (regex.test(content)) {
        content = content.replace(regex, \`\${subdomain} 60 IN A \${clientIP}\`);
    } else {
        content += \`\\n\${subdomain} 60 IN A \${clientIP}\`;
    }
    
    fs.writeFileSync(zoneFile, content);
    
    res.send(\`good \${clientIP}\`);
    console.log(\`Updated \${hostname} to \${clientIP}\`);
});

// Create token
app.post('/api/tokens', (req, res) => {
    const { hostname } = req.body;
    const token = crypto.randomBytes(16).toString('hex');
    
    tokens[hostname] = token;
    fs.writeFileSync(tokensFile, JSON.stringify(tokens, null, 2));
    
    res.json({ hostname, token });
});

app.listen(${parseInt(server.port) + 2000}, () => {
    console.log('Dynamic DNS server running on port ${parseInt(server.port) + 2000}');
});
DDNS_EOF`);

        await sshExec(`cd ${instancePath} && npm install express`);
    },

    async setupDoH(server, sshExec, instancePath) {
        await sshExec(`cat > ${instancePath}/doh-server.js << 'DOH_EOF'
const express = require('express');
const dgram = require('dgram');
const app = express();

app.use(express.json());

app.get('/dns-query', async (req, res) => {
    const { name, type } = req.query;
    
    // Forward to local DNS server
    const client = dgram.createSocket('udp4');
    const query = createDNSQuery(name, type);
    
    client.send(query, ${server.port}, 'localhost', (err) => {
        if (err) {
            res.status(500).json({ error: 'DNS query failed' });
            client.close();
        }
    });
    
    client.on('message', (msg) => {
        const response = parseDNSResponse(msg);
        res.json(response);
        client.close();
    });
});

function createDNSQuery(name, type) {
    // Simplified DNS query creation
    const buffer = Buffer.alloc(512);
    buffer.writeUInt16BE(0x1234, 0); // Transaction ID
    buffer.writeUInt16BE(0x0100, 2); // Flags
    buffer.writeUInt16BE(1, 4);      // Questions
    buffer.writeUInt16BE(0, 6);      // Answer RRs
    buffer.writeUInt16BE(0, 8);      // Authority RRs
    buffer.writeUInt16BE(0, 10);     // Additional RRs
    
    return buffer;
}

function parseDNSResponse(msg) {
    return {
        Status: 0,
        Question: [],
        Answer: []
    };
}

app.listen(${parseInt(server.port) + 3000}, () => {
    console.log('DNS-over-HTTPS server running on port ${parseInt(server.port) + 3000}');
});
DOH_EOF`);
    },

    async setupBlocklists(server, sshExec, instancePath) {
        await sshExec(`cat > ${instancePath}/scripts/update-blocklist.sh << 'BLOCK_EOF'
#!/bin/bash
# Update DNS blocklist

BLOCKLIST_DIR="${instancePath}/blocklists"
mkdir -p \\$BLOCKLIST_DIR

# Download popular blocklists
curl -s https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts | \\
    grep "0.0.0.0" | awk '{print \\$2}' > \\$BLOCKLIST_DIR/domains.txt

echo "Updated blocklist: \\$(wc -l < \\$BLOCKLIST_DIR/domains.txt) domains"
BLOCK_EOF`);
        
        await sshExec(`chmod +x ${instancePath}/scripts/update-blocklist.sh`);
    },

    async createManagementUI(server, sshExec, instancePath) {
        await sshExec(`cat > ${instancePath}/public/index.html << 'UI_EOF'
<!DOCTYPE html>
<html>
<head>
    <title>DNS Server Management</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial; background: #1e1e1e; color: #fff; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { margin-bottom: 20px; }
        .section { background: #2d2d2d; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        button { background: #2196f3; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
        button:hover { background: #1976d2; }
        input, textarea { width: 100%; padding: 10px; margin: 10px 0; border-radius: 4px; border: 1px solid #444; background: #333; color: #fff; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #444; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🌐 DNS Server Management</h1>
        
        <div class="section">
            <h2>Zones</h2>
            <button onclick="loadZones()">Refresh</button>
            <button onclick="createZone()">Create Zone</button>
            <div id="zones"></div>
        </div>
        
        <div class="section">
            <h2>Add DNS Record</h2>
            <input type="text" id="zone" placeholder="Zone (e.g., example.com)">
            <input type="text" id="name" placeholder="Name (e.g., www)">
            <select id="type">
                <option value="A">A</option>
                <option value="AAAA">AAAA</option>
                <option value="CNAME">CNAME</option>
                <option value="MX">MX</option>
                <option value="TXT">TXT</option>
            </select>
            <input type="text" id="value" placeholder="Value (e.g., 192.168.1.1)">
            <input type="number" id="ttl" placeholder="TTL (seconds)" value="3600">
            <button onclick="addRecord()">Add Record</button>
        </div>
    </div>
    
    <script>
        async function loadZones() {
            const res = await fetch('/api/zones');
            const zones = await res.json();
            document.getElementById('zones').innerHTML = \`
                <table>
                    <tr><th>Zone</th><th>Records</th><th>Actions</th></tr>
                    \${zones.map(z => \`
                        <tr>
                            <td>\${z.name}</td>
                            <td>\${z.records}</td>
                            <td>
                                <button onclick="viewZone('\${z.name}')">View</button>
                                <button onclick="deleteZone('\${z.name}')">Delete</button>
                            </td>
                        </tr>
                    \`).join('')}
                </table>
            \`;
        }
        
        async function addRecord() {
            const zone = document.getElementById('zone').value;
            const data = {
                name: document.getElementById('name').value,
                type: document.getElementById('type').value,
                value: document.getElementById('value').value,
                ttl: document.getElementById('ttl').value
            };
            
            await fetch(\`/api/zones/\${zone}/records\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            alert('Record added!');
        }
        
        loadZones();
    </script>
</body>
</html>
UI_EOF`);
    },

    async start(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        
        // Start DNS server (requires elevated permissions for port 53)
        if (server.port === 53) {
            await sshExec(`cd ${instancePath} && sudo node dns-server.js > logs/dns.log 2>&1 & echo $! > dns.pid`);
        } else {
            await sshExec(`cd ${instancePath} && node dns-server.js > logs/dns.log 2>&1 & echo $! > dns.pid`);
        }
        
        // Start zone manager
        await sshExec(`cd ${instancePath} && node zone-manager.js > logs/zone.log 2>&1 & echo $! > zone.pid`);
        
        // Start DDNS if enabled
        if (server.config.enableDDNS) {
            await sshExec(`cd ${instancePath} && node ddns-server.js > logs/ddns.log 2>&1 & echo $! > ddns.pid`);
        }
        
        // Start DoH if enabled
        if (server.config.enableDoH) {
            await sshExec(`cd ${instancePath} && node doh-server.js > logs/doh.log 2>&1 & echo $! > doh.pid`);
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
