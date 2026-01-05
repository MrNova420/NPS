/**
 * Redis Cache Server Template - Production Grade
 * Features: Optimized for ARM, persistence, monitoring
 */

module.exports = {
    name: 'Redis Cache',
    description: 'Production-grade in-memory data store with ARM optimization and persistence',
    category: 'Database',
    icon: '🔴',
    defaultPort: 6379,
    requirements: ['redis'],
    
    // Resource requirements
    resources: {
        cpu: 8,
        memory: 256,
        priority: 'high',
        bandwidth: { download: 5, upload: 5 }
    },
    
    configOptions: [
        { name: 'maxMemory', label: 'Max Memory (MB)', type: 'number', default: 256 },
        { name: 'password', label: 'Password (Optional)', type: 'password' },
        { name: 'persistence', label: 'Enable Persistence', type: 'checkbox', default: true }
    ],

    async deploy(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        
        await sshExec(`mkdir -p ${instancePath}/{logs,data}`);
        
        // Create Redis config
        await sshExec(`cat > ${instancePath}/redis.conf << 'EOF'
port ${server.port}
bind 0.0.0.0
maxmemory ${server.config.maxMemory || 256}mb
maxmemory-policy allkeys-lru
${server.config.password ? `requirepass ${server.config.password}` : ''}
${server.config.persistence ? 'save 900 1\nsave 300 10\nsave 60 10000' : ''}
dir ${instancePath}/data
logfile ${instancePath}/logs/redis.log
daemonize yes
pidfile ${instancePath}/logs/redis.pid
EOF`);

        await sshExec(`redis-server ${instancePath}/redis.conf`);
        
        return { instancePath, port: server.port };
    },

    async start(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`redis-server ${instancePath}/redis.conf`);
    },

    async stop(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`redis-cli -p ${server.port} ${server.config.password ? `-a ${server.config.password}` : ''} shutdown`);
    },

    async delete(server, sshExec) {
        await this.stop(server, sshExec);
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`rm -rf ${instancePath}`);
    }
};
