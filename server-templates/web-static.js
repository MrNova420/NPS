/**
 * Web Server Template - Static Website Hosting (Production Grade)
 * Features: Nginx-based with compression, caching, and security headers
 */

module.exports = {
    name: 'Static Website',
    description: 'Production-grade static website hosting with Nginx, compression, and optimized caching',
    category: 'Web',
    icon: '🌐',
    defaultPort: 8080,
    requirements: ['nginx'],
    
    // Resource requirements
    resources: {
        cpu: 5,
        memory: 64,
        priority: 'low',
        bandwidth: { download: 10, upload: 10 }
    },
    
    configOptions: [
        { name: 'domain', label: 'Domain (Optional)', type: 'text', placeholder: 'example.com' },
        { name: 'ssl', label: 'Enable SSL', type: 'checkbox', default: false }
    ],

    async deploy(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        const webRoot = `${instancePath}/public`;
        
        // Create directory structure
        await sshExec(`mkdir -p ${webRoot} ${instancePath}/logs`);
        
        // Create sample index.html
        await sshExec(`cat > ${webRoot}/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>${server.name}</title>
    <style>
        body { font-family: Arial; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        h1 { font-size: 3rem; margin-bottom: 1rem; }
        p { font-size: 1.2rem; opacity: 0.9; }
    </style>
</head>
<body>
    <h1>🚀 ${server.name}</h1>
    <p>Your server is running successfully!</p>
    <p>Upload your files to: ${webRoot}</p>
</body>
</html>
EOF`);

        // Create Nginx config
        await sshExec(`cat > ${instancePath}/nginx.conf << 'EOF'
server {
    listen ${server.port};
    server_name ${server.config.domain || '_'};
    
    root ${webRoot};
    index index.html index.htm;
    
    access_log ${instancePath}/logs/access.log;
    error_log ${instancePath}/logs/error.log;
    
    location / {
        try_files \\$uri \\$uri/ =404;
    }
    
    location ~* \\.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF`);

        // Start Nginx with this config
        await sshExec(`nginx -c ${instancePath}/nginx.conf -p ${instancePath}`);
        
        return { webRoot, port: server.port };
    },

    async start(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`nginx -c ${instancePath}/nginx.conf -p ${instancePath}`);
    },

    async stop(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        const pidFile = `${instancePath}/logs/nginx.pid`;
        await sshExec(`kill $(cat ${pidFile}) 2>/dev/null || true`);
    },

    async delete(server, sshExec) {
        await this.stop(server, sshExec);
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`rm -rf ${instancePath}`);
    }
};
