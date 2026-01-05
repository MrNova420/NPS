/**
 * Load Balancer & Reverse Proxy Template - Advanced Production Grade
 * Enterprise load balancing with health checks, SSL, caching, rate limiting
 */

module.exports = {
    name: 'Load Balancer / Reverse Proxy',
    description: 'Production-grade enterprise load balancer - Traffic distribution, SSL termination, caching, failover, rate limiting',
    category: 'Advanced',
    icon: '⚖️',
    defaultPort: 80,
    requirements: ['nginx', 'openssl'],
    
    // Resource requirements
    resources: {
        cpu: 15,
        memory: 256,
        priority: 'high',
        bandwidth: { download: 40, upload: 40 }
    },
    
    configOptions: [
        {
            name: 'balancingMethod',
            label: 'Load Balancing Method',
            type: 'select',
            options: ['round_robin', 'least_conn', 'ip_hash', 'weighted'],
            default: 'least_conn',
            help: 'Algorithm for distributing requests'
        },
        {
            name: 'backends',
            label: 'Backend Servers',
            type: 'textarea',
            required: true,
            placeholder: 'server1.local:3000\nserver2.local:3000\nserver3.local:3000',
            help: 'One server per line (host:port)'
        },
        {
            name: 'healthCheckPath',
            label: 'Health Check Path',
            type: 'text',
            default: '/health',
            help: 'Path to check backend health'
        },
        {
            name: 'healthCheckInterval',
            label: 'Health Check Interval (seconds)',
            type: 'number',
            default: 10
        },
        {
            name: 'maxFails',
            label: 'Max Failures',
            type: 'number',
            default: 3,
            help: 'Failures before marking backend as down'
        },
        {
            name: 'failTimeout',
            label: 'Fail Timeout (seconds)',
            type: 'number',
            default: 30
        },
        {
            name: 'enableSSL',
            label: 'Enable SSL/HTTPS',
            type: 'checkbox',
            default: true
        },
        {
            name: 'sslPort',
            label: 'SSL Port',
            type: 'number',
            default: 443
        },
        {
            name: 'domains',
            label: 'Domain Names',
            type: 'textarea',
            placeholder: 'example.com\nwww.example.com',
            help: 'One domain per line'
        },
        {
            name: 'enableCaching',
            label: 'Enable Response Caching',
            type: 'checkbox',
            default: true
        },
        {
            name: 'cacheSize',
            label: 'Cache Size (MB)',
            type: 'number',
            default: 100
        },
        {
            name: 'cacheTime',
            label: 'Cache Time (minutes)',
            type: 'number',
            default: 60
        },
        {
            name: 'enableGzip',
            label: 'Enable Gzip Compression',
            type: 'checkbox',
            default: true
        },
        {
            name: 'rateLimitRps',
            label: 'Rate Limit (req/sec per IP)',
            type: 'number',
            default: 10
        },
        {
            name: 'maxConnections',
            label: 'Max Connections',
            type: 'number',
            default: 1024
        },
        {
            name: 'keepaliveTimeout',
            label: 'Keepalive Timeout (seconds)',
            type: 'number',
            default: 65
        },
        {
            name: 'enableLogging',
            label: 'Enable Detailed Logging',
            type: 'checkbox',
            default: true
        },
        {
            name: 'enableStickySessions',
            label: 'Enable Sticky Sessions',
            type: 'checkbox',
            default: false
        }
    ],

    async deploy(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        const config = server.config;
        
        await sshExec(`mkdir -p ${instancePath}/{logs,cache,ssl,conf.d}`);
        
        // Parse backends
        const backends = config.backends.split('\n').filter(b => b.trim());
        const backendServers = backends.map((backend, i) => {
            const [host, port] = backend.trim().split(':');
            return { host, port: port || '80', name: `backend${i+1}` };
        });
        
        // Generate SSL certificates if enabled
        if (config.enableSSL) {
            const domains = config.domains ? config.domains.split('\n').map(d => d.trim()).filter(d => d) : ['localhost'];
            await sshExec(`openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\
                -keyout ${instancePath}/ssl/privkey.pem \\
                -out ${instancePath}/ssl/fullchain.pem \\
                -subj "/C=US/ST=State/L=City/O=Organization/CN=${domains[0]}"`);
        }
        
        // Create upstream configuration
        const upstreamConfig = `
upstream ${server.name.replace(/[^a-z0-9]/gi, '_')}_backend {
    ${config.balancingMethod === 'least_conn' ? 'least_conn;' : ''}
    ${config.balancingMethod === 'ip_hash' ? 'ip_hash;' : ''}
    ${config.enableStickySessions ? 'sticky cookie srv_id expires=1h domain=.example.com path=/;' : ''}
    
    ${backendServers.map(b => `
    server ${b.host}:${b.port} 
        max_fails=${config.maxFails} 
        fail_timeout=${config.failTimeout}s
        ${config.balancingMethod === 'weighted' ? 'weight=1' : ''};`).join('\n    ')}
    
    keepalive 32;
}`;

        // Create main nginx configuration
        await sshExec(`cat > ${instancePath}/nginx.conf << 'EOF'
user nobody;
worker_processes auto;
worker_rlimit_nofile 65535;
pid ${instancePath}/logs/nginx.pid;
error_log ${instancePath}/logs/error.log warn;

events {
    worker_connections ${config.maxConnections};
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # Logging
    log_format main '\\$remote_addr - \\$remote_user [\\$time_local] "\\$request" '
                    '\\$status \\$body_bytes_sent "\\$http_referer" '
                    '"\\$http_user_agent" "\\$http_x_forwarded_for" '
                    'rt=\\$request_time uct="\\$upstream_connect_time" '
                    'uht="\\$upstream_header_time" urt="\\$upstream_response_time"';
    
    access_log ${config.enableLogging ? `${instancePath}/logs/access.log main` : 'off'};
    
    # Performance tuning
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout ${config.keepaliveTimeout};
    keepalive_requests 100;
    reset_timedout_connection on;
    client_body_timeout 10;
    send_timeout 10;
    client_max_body_size 100m;
    
    # Gzip
    ${config.enableGzip ? `
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss 
               application/rss+xml font/truetype font/opentype 
               application/vnd.ms-fontobject image/svg+xml;
    gzip_disable "msie6";
    ` : ''}
    
    # Caching
    ${config.enableCaching ? `
    proxy_cache_path ${instancePath}/cache levels=1:2 keys_zone=my_cache:${config.cacheSize}m 
                     max_size=${config.cacheSize * 10}m inactive=${config.cacheTime}m use_temp_path=off;
    proxy_cache_key "\\$scheme\\$request_method\\$host\\$request_uri";
    proxy_cache_valid 200 ${config.cacheTime}m;
    proxy_cache_valid 404 1m;
    ` : ''}
    
    # Rate limiting
    limit_req_zone \\$binary_remote_addr zone=limit_per_ip:10m rate=${config.rateLimitRps}r/s;
    limit_req_status 429;
    limit_conn_zone \\$binary_remote_addr zone=addr:10m;
    
    # Upstream
    ${upstreamConfig}
    
    # Health check (requires nginx plus or custom module)
    # For open source nginx, use external health checker
    
    # HTTP Server
    server {
        listen ${server.port};
        server_name ${config.domains ? config.domains.split('\n').join(' ') : '_'};
        
        ${config.enableSSL ? `
        # Redirect to HTTPS
        return 301 https://\\$server_name\\$request_uri;
    }
    
    # HTTPS Server
    server {
        listen ${config.sslPort} ssl http2;
        server_name ${config.domains ? config.domains.split('\n').join(' ') : '_'};
        
        # SSL Configuration
        ssl_certificate ${instancePath}/ssl/fullchain.pem;
        ssl_certificate_key ${instancePath}/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;
        
        # Security headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        ` : ''}
        
        # Rate limiting
        limit_req zone=limit_per_ip burst=20 nodelay;
        limit_conn addr 10;
        
        # Health check endpoint
        location = ${config.healthCheckPath} {
            access_log off;
            return 200 "healthy\\n";
            add_header Content-Type text/plain;
        }
        
        # Status page
        location = /nginx-status {
            stub_status on;
            access_log off;
            allow 127.0.0.1;
            deny all;
        }
        
        # Proxy to backends
        location / {
            proxy_pass http://${server.name.replace(/[^a-z0-9]/gi, '_')}_backend;
            proxy_http_version 1.1;
            
            # Headers
            proxy_set_header Host \\$host;
            proxy_set_header X-Real-IP \\$remote_addr;
            proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \\$scheme;
            proxy_set_header X-Forwarded-Host \\$host;
            proxy_set_header X-Forwarded-Port \\$server_port;
            
            # WebSocket support
            proxy_set_header Upgrade \\$http_upgrade;
            proxy_set_header Connection "upgrade";
            
            # Timeouts
            proxy_connect_timeout 5s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
            
            # Buffering
            proxy_buffering on;
            proxy_buffer_size 4k;
            proxy_buffers 8 4k;
            proxy_busy_buffers_size 8k;
            
            ${config.enableCaching ? `
            # Caching
            proxy_cache my_cache;
            proxy_cache_bypass \\$http_cache_control;
            add_header X-Cache-Status \\$upstream_cache_status;
            ` : ''}
            
            # Error handling
            proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
            proxy_next_upstream_tries 3;
        }
    }
}
EOF`);

        // Create health check script
        await sshExec(`cat > ${instancePath}/health-checker.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash

BACKENDS="${backendServers.map(b => `${b.host}:${b.port}`).join(' ')}"
CHECK_PATH="${config.healthCheckPath}"
INTERVAL=${config.healthCheckInterval}
LOG_FILE="${instancePath}/logs/health-check.log"

while true; do
    for backend in \\$BACKENDS; do
        if curl -sf http://\\$backend\\$CHECK_PATH > /dev/null 2>&1; then
            echo "[$(date)] \\$backend - UP" >> \\$LOG_FILE
        else
            echo "[$(date)] \\$backend - DOWN" >> \\$LOG_FILE
        fi
    done
    sleep \\$INTERVAL
done
EOF`);

        await sshExec(`chmod +x ${instancePath}/health-checker.sh`);
        
        // Create stats collector
        await sshExec(`cat > ${instancePath}/stats-collector.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash

while true; do
    curl -s http://localhost/nginx-status >> ${instancePath}/logs/stats.log
    echo "---" >> ${instancePath}/logs/stats.log
    sleep 60
done
EOF`);

        await sshExec(`chmod +x ${instancePath}/stats-collector.sh`);
        
        // Start nginx
        await sshExec(`nginx -c ${instancePath}/nginx.conf -p ${instancePath}`);
        
        // Start health checker
        await sshExec(`nohup ${instancePath}/health-checker.sh > /dev/null 2>&1 & echo $! > ${instancePath}/logs/health-checker.pid`);
        
        // Start stats collector
        await sshExec(`nohup ${instancePath}/stats-collector.sh > /dev/null 2>&1 & echo $! > ${instancePath}/logs/stats-collector.pid`);
        
        return {
            instancePath,
            port: server.port,
            sslPort: config.enableSSL ? config.sslPort : null,
            backends: backendServers,
            balancingMethod: config.balancingMethod,
            sslEnabled: config.enableSSL,
            cachingEnabled: config.enableCaching
        };
    },

    async start(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`nginx -c ${instancePath}/nginx.conf -p ${instancePath}`);
        await sshExec(`nohup ${instancePath}/health-checker.sh > /dev/null 2>&1 & echo $! > ${instancePath}/logs/health-checker.pid`);
        await sshExec(`nohup ${instancePath}/stats-collector.sh > /dev/null 2>&1 & echo $! > ${instancePath}/logs/stats-collector.pid`);
    },

    async stop(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`kill $(cat ${instancePath}/logs/nginx.pid) 2>/dev/null || true`);
        await sshExec(`kill $(cat ${instancePath}/logs/health-checker.pid) 2>/dev/null || true`);
        await sshExec(`kill $(cat ${instancePath}/logs/stats-collector.pid) 2>/dev/null || true`);
    },

    async delete(server, sshExec) {
        await this.stop(server, sshExec);
        await sshExec(`rm -rf ~/server/instances/${server.id}`);
    }
};
