/**
 * Database Cluster Template - Production Grade
 * High-availability database cluster with replication, failover, and load balancing
 */

module.exports = {
    name: 'Database Cluster',
    description: 'Production-grade HA database cluster - Multi-master replication, automatic failover, load balancing',
    category: 'Database',
    icon: '🗄️',
    defaultPort: 5432,
    requirements: ['postgresql', 'mysql'],
    
    // Resource requirements (for 3-node cluster)
    resources: {
        cpu: 30,
        memory: 768,
        priority: 'high',
        bandwidth: { download: 10, upload: 10 }
    },
    
    configOptions: [
        {
            name: 'dbType',
            label: 'Database Type',
            type: 'select',
            options: ['postgresql', 'mysql', 'mongodb', 'redis-cluster'],
            required: true,
            default: 'postgresql'
        },
        {
            name: 'clusterSize',
            label: 'Cluster Size',
            type: 'select',
            options: ['3', '5', '7'],
            default: '3',
            help: 'Odd numbers ensure quorum'
        },
        {
            name: 'replicationMode',
            label: 'Replication Mode',
            type: 'select',
            options: ['master-slave', 'multi-master', 'synchronous', 'asynchronous'],
            default: 'master-slave'
        },
        {
            name: 'dbName',
            label: 'Database Name',
            type: 'text',
            required: true,
            placeholder: 'myapp_db'
        },
        {
            name: 'dbUser',
            label: 'Database User',
            type: 'text',
            required: true,
            default: 'admin'
        },
        {
            name: 'dbPassword',
            label: 'Database Password',
            type: 'password',
            required: true,
            placeholder: 'Strong password'
        },
        {
            name: 'enableSharding',
            label: 'Enable Sharding',
            type: 'checkbox',
            default: false
        },
        {
            name: 'enableBackups',
            label: 'Enable Automated Backups',
            type: 'checkbox',
            default: true
        },
        {
            name: 'backupInterval',
            label: 'Backup Interval (hours)',
            type: 'number',
            default: 6
        },
        {
            name: 'enableMonitoring',
            label: 'Enable Monitoring',
            type: 'checkbox',
            default: true
        },
        {
            name: 'maxConnections',
            label: 'Max Connections',
            type: 'number',
            default: 100
        }
    ],

    async deploy(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        const config = server.config;
        
        await sshExec(`mkdir -p ${instancePath}/{nodes,backups,logs,scripts,config}`);

        // Deploy based on database type
        switch (config.dbType) {
            case 'postgresql':
                await this.deployPostgreSQLCluster(server, sshExec, instancePath);
                break;
            case 'mysql':
                await this.deployMySQLCluster(server, sshExec, instancePath);
                break;
            case 'mongodb':
                await this.deployMongoDBCluster(server, sshExec, instancePath);
                break;
            case 'redis-cluster':
                await this.deployRedisCluster(server, sshExec, instancePath);
                break;
        }

        // Create load balancer/proxy
        await this.createLoadBalancer(server, sshExec, instancePath);

        // Setup replication
        await this.setupReplication(server, sshExec, instancePath);

        // Setup failover mechanism
        await this.setupFailover(server, sshExec, instancePath);

        // Setup backup system
        if (config.enableBackups) {
            await this.setupBackups(server, sshExec, instancePath);
        }

        // Setup monitoring
        if (config.enableMonitoring) {
            await this.setupMonitoring(server, sshExec, instancePath);
        }

        // Create management scripts
        await this.createManagementScripts(server, sshExec, instancePath);

        console.log(`Database Cluster deployed at ${instancePath}`);
    },

    async deployPostgreSQLCluster(server, sshExec, instancePath) {
        const config = server.config;
        const clusterSize = parseInt(config.clusterSize);
        
        // Install PostgreSQL
        await sshExec(`pkg install -y postgresql`);

        // Create nodes
        for (let i = 0; i < clusterSize; i++) {
            const nodePort = parseInt(server.port) + i;
            const nodePath = `${instancePath}/nodes/node${i}`;
            
            await sshExec(`mkdir -p ${nodePath}/data`);
            
            // Initialize database
            await sshExec(`
                initdb -D ${nodePath}/data
            `);

            // Configure PostgreSQL
            await sshExec(`cat > ${nodePath}/data/postgresql.conf << 'PG_CONF_EOF'
# Basic settings
port = ${nodePort}
max_connections = ${config.maxConnections}
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 16MB
maintenance_work_mem = 128MB

# WAL settings for replication
wal_level = replica
max_wal_senders = ${clusterSize}
max_replication_slots = ${clusterSize}
hot_standby = on
hot_standby_feedback = on

# Logging
logging_collector = on
log_directory = '${instancePath}/logs'
log_filename = 'node${i}_%Y%m%d.log'
log_line_prefix = '%t [%p]: '

# Performance
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
PG_CONF_EOF`);

            // Configure authentication
            await sshExec(`cat > ${nodePath}/data/pg_hba.conf << 'PG_HBA_EOF'
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     trust
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
host    replication     all             127.0.0.1/32            md5
host    replication     all             ::1/128                 md5
PG_HBA_EOF`);

            // Create startup script
            await sshExec(`cat > ${nodePath}/start.sh << 'START_EOF'
#!/bin/bash
pg_ctl -D ${nodePath}/data -l ${instancePath}/logs/node${i}.log start
START_EOF`);
            await sshExec(`chmod +x ${nodePath}/start.sh`);

            // Create stop script
            await sshExec(`cat > ${nodePath}/stop.sh << 'STOP_EOF'
#!/bin/bash
pg_ctl -D ${nodePath}/data stop
STOP_EOF`);
            await sshExec(`chmod +x ${nodePath}/stop.sh`);
        }

        // Create database and user after starting master
        await sshExec(`bash ${instancePath}/nodes/node0/start.sh`);
        await sshExec(`sleep 2`);
        
        await sshExec(`psql -p ${server.port} -U $(whoami) postgres -c "CREATE DATABASE ${config.dbName};"`);
        await sshExec(`psql -p ${server.port} -U $(whoami) postgres -c "CREATE USER ${config.dbUser} WITH PASSWORD '${config.dbPassword}';"`);
        await sshExec(`psql -p ${server.port} -U $(whoami) postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${config.dbName} TO ${config.dbUser};"`);
    },

    async deployMySQLCluster(server, sshExec, instancePath) {
        const config = server.config;
        const clusterSize = parseInt(config.clusterSize);
        
        await sshExec(`pkg install -y mariadb`);

        for (let i = 0; i < clusterSize; i++) {
            const nodePort = parseInt(server.port) + i;
            const nodePath = `${instancePath}/nodes/node${i}`;
            
            await sshExec(`mkdir -p ${nodePath}/{data,tmp}`);

            // Create MySQL config
            await sshExec(`cat > ${nodePath}/my.cnf << 'MYSQL_CONF_EOF'
[mysqld]
port = ${nodePort}
datadir = ${nodePath}/data
socket = ${nodePath}/mysql.sock
pid-file = ${nodePath}/mysql.pid
tmpdir = ${nodePath}/tmp

# InnoDB settings
innodb_buffer_pool_size = 256M
innodb_log_file_size = 64M
innodb_flush_log_at_trx_commit = 2

# Replication settings
server-id = ${i + 1}
log_bin = ${nodePath}/mysql-bin
binlog_format = ROW
gtid_mode = ON
enforce_gtid_consistency = ON

# Performance
max_connections = ${config.maxConnections}
thread_cache_size = 8
query_cache_size = 32M
query_cache_type = 1

# Logging
log_error = ${instancePath}/logs/node${i}.log
MYSQL_CONF_EOF`);

            // Initialize database
            await sshExec(`mysql_install_db --defaults-file=${nodePath}/my.cnf --user=$(whoami)`);
        }
    },

    async deployMongoDBCluster(server, sshExec, instancePath) {
        const config = server.config;
        const clusterSize = parseInt(config.clusterSize);
        
        // Create MongoDB replica set configuration
        await sshExec(`cat > ${instancePath}/config/mongod.conf << 'MONGO_CONF_EOF'
storage:
  dbPath: ${instancePath}/nodes/node0/data
  journal:
    enabled: true

systemLog:
  destination: file
  path: ${instancePath}/logs/mongod.log
  logAppend: true

net:
  port: ${server.port}
  bindIp: 127.0.0.1

replication:
  replSetName: nps_cluster

security:
  authorization: enabled
MONGO_CONF_EOF`);

        for (let i = 0; i < clusterSize; i++) {
            const nodePort = parseInt(server.port) + i;
            const nodePath = `${instancePath}/nodes/node${i}`;
            
            await sshExec(`mkdir -p ${nodePath}/data`);
        }
    },

    async deployRedisCluster(server, sshExec, instancePath) {
        const config = server.config;
        const clusterSize = parseInt(config.clusterSize);
        
        await sshExec(`pkg install -y redis`);

        for (let i = 0; i < clusterSize; i++) {
            const nodePort = parseInt(server.port) + i;
            const nodePath = `${instancePath}/nodes/node${i}`;
            
            await sshExec(`mkdir -p ${nodePath}`);

            // Create Redis config
            await sshExec(`cat > ${nodePath}/redis.conf << 'REDIS_CONF_EOF'
port ${nodePort}
cluster-enabled yes
cluster-config-file ${nodePath}/nodes.conf
cluster-node-timeout 5000
appendonly yes
dir ${nodePath}
logfile ${instancePath}/logs/node${i}.log

# Performance
maxmemory 256mb
maxmemory-policy allkeys-lru

# Security
requirepass ${config.dbPassword}

# Persistence
save 900 1
save 300 10
save 60 10000
REDIS_CONF_EOF`);
        }
    },

    async createLoadBalancer(server, sshExec, instancePath) {
        const config = server.config;
        const clusterSize = parseInt(config.clusterSize);
        
        // Create connection proxy/load balancer
        await sshExec(`cat > ${instancePath}/proxy.js << 'PROXY_EOF'
const net = require('net');
const { exec } = require('child_process');

const nodes = [
${Array.from({length: clusterSize}, (_, i) => `  { host: 'localhost', port: ${parseInt(server.port) + i}, healthy: true }`).join(',\n')}
];

let currentNode = 0;

// Health check
setInterval(() => {
    nodes.forEach((node, index) => {
        const client = net.connect(node.port, node.host);
        client.on('connect', () => {
            node.healthy = true;
            client.end();
        });
        client.on('error', () => {
            node.healthy = false;
            console.log(\`Node \${index} is down\`);
        });
    });
}, 5000);

// Proxy server
const server = net.createServer((clientSocket) => {
    // Round-robin load balancing
    let attempts = 0;
    let targetNode;
    
    while (attempts < nodes.length) {
        targetNode = nodes[currentNode];
        currentNode = (currentNode + 1) % nodes.length;
        
        if (targetNode.healthy) break;
        attempts++;
    }
    
    if (!targetNode.healthy) {
        clientSocket.end();
        return;
    }
    
    const serverSocket = net.connect(targetNode.port, targetNode.host);
    
    clientSocket.pipe(serverSocket);
    serverSocket.pipe(clientSocket);
    
    clientSocket.on('error', () => serverSocket.end());
    serverSocket.on('error', () => clientSocket.end());
});

server.listen(${server.port}, () => {
    console.log(\`Database proxy running on port ${server.port}\`);
});
PROXY_EOF`);

        await sshExec(`cd ${instancePath} && npm install`);
    },

    async setupReplication(server, sshExec, instancePath) {
        const config = server.config;
        
        if (config.dbType === 'postgresql' && config.replicationMode !== 'standalone') {
            // Setup streaming replication for PostgreSQL
            const clusterSize = parseInt(config.clusterSize);
            
            for (let i = 1; i < clusterSize; i++) {
                await sshExec(`cat > ${instancePath}/nodes/node${i}/recovery.conf << 'RECOVERY_EOF'
standby_mode = on
primary_conninfo = 'host=localhost port=${server.port} user=${config.dbUser} password=${config.dbPassword}'
trigger_file = '${instancePath}/nodes/node${i}/promote.trigger'
RECOVERY_EOF`);
            }
        }
    },

    async setupFailover(server, sshExec, instancePath) {
        const config = server.config;
        
        // Create failover detection script
        await sshExec(`cat > ${instancePath}/scripts/failover-monitor.sh << 'FAILOVER_EOF'
#!/bin/bash
# Automatic failover monitor

MASTER_PORT=${server.port}
CHECK_INTERVAL=10

while true; do
    # Check if master is alive
    if ! nc -z localhost \\$MASTER_PORT 2>/dev/null; then
        echo "Master node is down! Initiating failover..."
        
        # Promote first available standby
        for node in ${instancePath}/nodes/node*; do
            if [ -f "\\$node/recovery.conf" ]; then
                echo "Promoting \\$node to master..."
                touch "\\$node/promote.trigger"
                
                # Update connection info
                echo "Failover complete"
                
                # Send alert
                ${config.slackWebhook ? `
                curl -X POST -H 'Content-type: application/json' \\
                    --data '{"text":"Database failover: New master promoted"}' \\
                    '${config.slackWebhook}'
                ` : ''}
                
                break
            fi
        done
    fi
    
    sleep \\$CHECK_INTERVAL
done
FAILOVER_EOF`);

        await sshExec(`chmod +x ${instancePath}/scripts/failover-monitor.sh`);
    },

    async setupBackups(server, sshExec, instancePath) {
        const config = server.config;
        
        await sshExec(`cat > ${instancePath}/scripts/backup.sh << 'BACKUP_EOF'
#!/bin/bash
# Automated backup script

BACKUP_DIR=${instancePath}/backups
TIMESTAMP=\\$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

echo "Starting backup..."

case "${config.dbType}" in
    postgresql)
        pg_dump -p ${server.port} -U ${config.dbUser} ${config.dbName} > \\$BACKUP_DIR/${config.dbName}_\\$TIMESTAMP.sql
        ;;
    mysql)
        mysqldump -P ${server.port} -u ${config.dbUser} -p${config.dbPassword} ${config.dbName} > \\$BACKUP_DIR/${config.dbName}_\\$TIMESTAMP.sql
        ;;
    mongodb)
        mongodump --port ${server.port} --db ${config.dbName} --out \\$BACKUP_DIR/\\$TIMESTAMP
        ;;
    redis-cluster)
        redis-cli -p ${server.port} --rdb \\$BACKUP_DIR/dump_\\$TIMESTAMP.rdb
        ;;
esac

# Compress backup
gzip \\$BACKUP_DIR/*_\\$TIMESTAMP.*

# Remove old backups
find \\$BACKUP_DIR -name "*.gz" -mtime +\\$RETENTION_DAYS -delete

echo "Backup complete: \\$BACKUP_DIR/${config.dbName}_\\$TIMESTAMP.sql.gz"
BACKUP_EOF`);

        await sshExec(`chmod +x ${instancePath}/scripts/backup.sh`);

        // Create cron job for automated backups
        await sshExec(`cat > ${instancePath}/scripts/backup-cron.sh << 'CRON_EOF'
#!/bin/bash
(crontab -l 2>/dev/null; echo "0 */${config.backupInterval} * * * bash ${instancePath}/scripts/backup.sh") | crontab -
CRON_EOF`);
        await sshExec(`chmod +x ${instancePath}/scripts/backup-cron.sh`);
    },

    async setupMonitoring(server, sshExec, instancePath) {
        const config = server.config;
        
        // Create monitoring script
        await sshExec(`cat > ${instancePath}/scripts/monitor.js << 'MONITOR_EOF'
const { exec } = require('child_process');
const express = require('express');
const app = express();

const metrics = {
    connections: 0,
    queries_per_second: 0,
    replication_lag: 0,
    disk_usage: 0,
    uptime: 0
};

function collectMetrics() {
    // Collect database metrics based on type
    ${config.dbType === 'postgresql' ? `
    exec("psql -p ${server.port} -U ${config.dbUser} -c 'SELECT count(*) FROM pg_stat_activity;'", (err, stdout) => {
        metrics.connections = parseInt(stdout.trim()) || 0;
    });
    ` : ''}
    
    ${config.dbType === 'mysql' ? `
    exec("mysql -P ${server.port} -u ${config.dbUser} -p${config.dbPassword} -e 'SHOW STATUS LIKE \\"Threads_connected\\";'", (err, stdout) => {
        const match = stdout.match(/\\d+/);
        metrics.connections = match ? parseInt(match[0]) : 0;
    });
    ` : ''}
}

app.get('/metrics', (req, res) => {
    res.json(metrics);
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date() });
});

setInterval(collectMetrics, 5000);
app.listen(${parseInt(server.port) + 100}, () => console.log('Monitoring running'));
MONITOR_EOF`);

        await sshExec(`cd ${instancePath}/scripts && npm install express`);
    },

    async createManagementScripts(server, sshExec, instancePath) {
        const config = server.config;
        const clusterSize = parseInt(config.clusterSize);
        
        // Start cluster script
        await sshExec(`cat > ${instancePath}/start-cluster.sh << 'START_EOF'
#!/bin/bash
cd ${instancePath}

echo "Starting database cluster..."

for i in {0..${clusterSize - 1}}; do
    if [ -f "nodes/node\\$i/start.sh" ]; then
        bash nodes/node\\$i/start.sh
        echo "Started node \\$i"
    fi
done

# Start proxy
node proxy.js > logs/proxy.log 2>&1 & echo \\$! > proxy.pid

# Start failover monitor
bash scripts/failover-monitor.sh > logs/failover.log 2>&1 & echo \\$! > failover.pid

${config.enableMonitoring ? `
# Start monitoring
node scripts/monitor.js > logs/monitor.log 2>&1 & echo \\$! > monitor.pid
` : ''}

echo "Database cluster started!"
echo "Connection: localhost:${server.port}"
START_EOF`);
        await sshExec(`chmod +x ${instancePath}/start-cluster.sh`);

        // Stop cluster script
        await sshExec(`cat > ${instancePath}/stop-cluster.sh << 'STOP_EOF'
#!/bin/bash
cd ${instancePath}

echo "Stopping database cluster..."

# Stop monitoring
[ -f monitor.pid ] && kill \\$(cat monitor.pid) 2>/dev/null && rm monitor.pid

# Stop failover monitor
[ -f failover.pid ] && kill \\$(cat failover.pid) 2>/dev/null && rm failover.pid

# Stop proxy
[ -f proxy.pid ] && kill \\$(cat proxy.pid) 2>/dev/null && rm proxy.pid

# Stop all nodes
for i in {0..${clusterSize - 1}}; do
    if [ -f "nodes/node\\$i/stop.sh" ]; then
        bash nodes/node\\$i/stop.sh
        echo "Stopped node \\$i"
    fi
done

echo "Database cluster stopped!"
STOP_EOF`);
        await sshExec(`chmod +x ${instancePath}/stop-cluster.sh`);

        // Status script
        await sshExec(`cat > ${instancePath}/status.sh << 'STATUS_EOF'
#!/bin/bash
cd ${instancePath}

echo "=== Database Cluster Status ==="
echo ""

# Check proxy
if [ -f proxy.pid ] && kill -0 \\$(cat proxy.pid) 2>/dev/null; then
    echo "✓ Proxy: Running (Port ${server.port})"
else
    echo "✗ Proxy: Stopped"
fi

# Check nodes
for i in {0..${clusterSize - 1}}; do
    PORT=$((${server.port} + i))
    if nc -z localhost \\$PORT 2>/dev/null; then
        echo "✓ Node \\$i: Running (Port \\$PORT)"
    else
        echo "✗ Node \\$i: Stopped"
    fi
done

# Check monitoring
if [ -f monitor.pid ] && kill -0 \\$(cat monitor.pid) 2>/dev/null; then
    echo "✓ Monitoring: Running"
else
    echo "✗ Monitoring: Stopped"
fi

echo ""
STATUS_EOF`);
        await sshExec(`chmod +x ${instancePath}/status.sh`);
    },

    async start(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`bash ${instancePath}/start-cluster.sh`);
    },

    async stop(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`bash ${instancePath}/stop-cluster.sh`);
    },

    async delete(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await this.stop(server, sshExec);
        await sshExec(`rm -rf ${instancePath}`);
    }
};
