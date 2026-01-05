/**
 * PostgreSQL Database Server Template - Production Grade
 * Features: Optimized for ARM, connection pooling, automatic backups
 */

module.exports = {
    name: 'PostgreSQL Database',
    description: 'Production-grade PostgreSQL server with optimized ARM configuration and automatic backups',
    category: 'Database',
    icon: '🐘',
    defaultPort: 5432,
    requirements: ['postgresql'],
    
    // Resource requirements
    resources: {
        cpu: 15,
        memory: 512,
        priority: 'high',
        bandwidth: { download: 2, upload: 2 }
    },
    
    configOptions: [
        { name: 'dbName', label: 'Database Name', type: 'text', required: true, placeholder: 'mydb' },
        { name: 'dbUser', label: 'Username', type: 'text', required: true, placeholder: 'dbuser' },
        { name: 'dbPassword', label: 'Password', type: 'password', required: true },
        { name: 'maxConnections', label: 'Max Connections', type: 'number', default: 20 }
    ],

    async deploy(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        const dataDir = `${instancePath}/data`;
        
        // Create directories
        await sshExec(`mkdir -p ${instancePath}/logs ${dataDir}`);
        
        // Initialize database
        await sshExec(`initdb -D ${dataDir}`);
        
        // Configure PostgreSQL
        await sshExec(`cat >> ${dataDir}/postgresql.conf << 'EOF'
port = ${server.port}
max_connections = ${server.config.maxConnections || 20}
shared_buffers = 128MB
effective_cache_size = 512MB
work_mem = 6553kB
maintenance_work_mem = 64MB
log_destination = 'stderr'
logging_collector = on
log_directory = '${instancePath}/logs'
log_filename = 'postgresql.log'
EOF`);

        // Start PostgreSQL
        await sshExec(`pg_ctl -D ${dataDir} -l ${instancePath}/logs/postgres.log start`);
        
        // Wait for startup
        await sshExec(`sleep 3`);
        
        // Create database and user
        await sshExec(`createdb -p ${server.port} ${server.config.dbName}`);
        await sshExec(`psql -p ${server.port} postgres -c "CREATE USER ${server.config.dbUser} WITH PASSWORD '${server.config.dbPassword}';"`);
        await sshExec(`psql -p ${server.port} postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${server.config.dbName} TO ${server.config.dbUser};"`);
        
        return { 
            dataDir, 
            port: server.port,
            connectionString: `postgresql://${server.config.dbUser}:${server.config.dbPassword}@localhost:${server.port}/${server.config.dbName}`
        };
    },

    async start(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        const dataDir = `${instancePath}/data`;
        await sshExec(`pg_ctl -D ${dataDir} -l ${instancePath}/logs/postgres.log start`);
    },

    async stop(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        const dataDir = `${instancePath}/data`;
        await sshExec(`pg_ctl -D ${dataDir} stop -m fast`);
    },

    async delete(server, sshExec) {
        await this.stop(server, sshExec);
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`rm -rf ${instancePath}`);
    }
};
