/**
 * Minecraft Server Template
 */

module.exports = {
    name: 'Minecraft Server',
    description: 'Java Edition Minecraft server with automatic setup',
    category: 'Gaming',
    icon: '⛏️',
    defaultPort: 25565,
    requirements: ['openjdk-17'],
    
    configOptions: [
        { name: 'serverName', label: 'Server Name', type: 'text', required: true, placeholder: 'My Minecraft Server' },
        { name: 'maxPlayers', label: 'Max Players', type: 'number', default: 20 },
        { name: 'difficulty', label: 'Difficulty', type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'], default: 'normal' },
        { name: 'gamemode', label: 'Game Mode', type: 'select', options: ['survival', 'creative', 'adventure'], default: 'survival' },
        { name: 'pvp', label: 'PvP Enabled', type: 'checkbox', default: true },
        { name: 'memory', label: 'Memory (MB)', type: 'number', default: 1024 }
    ],

    async deploy(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        
        // Create directories
        await sshExec(`mkdir -p ${instancePath}/logs`);
        
        // Download Paper (optimized Minecraft server)
        await sshExec(`cd ${instancePath} && wget -O server.jar https://api.papermc.io/v2/projects/paper/versions/1.20.4/builds/latest/downloads/paper-1.20.4.jar`);
        
        // Accept EULA
        await sshExec(`echo "eula=true" > ${instancePath}/eula.txt`);
        
        // Create server.properties
        await sshExec(`cat > ${instancePath}/server.properties << 'EOF'
server-name=${server.config.serverName}
server-port=${server.port}
max-players=${server.config.maxPlayers || 20}
difficulty=${server.config.difficulty || 'normal'}
gamemode=${server.config.gamemode || 'survival'}
pvp=${server.config.pvp !== false}
motd=${server.config.serverName} - Powered by Android Server Manager
view-distance=10
simulation-distance=8
spawn-protection=16
enable-command-block=true
online-mode=true
EOF`);

        // Create start script
        await sshExec(`cat > ${instancePath}/start.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
cd ${instancePath}
java -Xmx${server.config.memory || 1024}M -Xms512M \\
    -XX:+UseG1GC \\
    -XX:+ParallelRefProcEnabled \\
    -XX:MaxGCPauseMillis=200 \\
    -XX:+UnlockExperimentalVMOptions \\
    -XX:+DisableExplicitGC \\
    -XX:G1NewSizePercent=30 \\
    -XX:G1MaxNewSizePercent=40 \\
    -XX:G1HeapRegionSize=8M \\
    -jar server.jar nogui
EOF`);
        
        await sshExec(`chmod +x ${instancePath}/start.sh`);
        
        // Start server
        await sshExec(`cd ${instancePath} && nohup ./start.sh > logs/server.log 2>&1 & echo $! > logs/server.pid`);
        
        return { 
            instancePath, 
            port: server.port,
            connectAddress: `<phone-ip>:${server.port}`
        };
    },

    async start(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`cd ${instancePath} && nohup ./start.sh > logs/server.log 2>&1 & echo $! > logs/server.pid`);
    },

    async stop(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        // Gracefully stop Minecraft
        const pid = await sshExec(`cat ${instancePath}/logs/server.pid 2>/dev/null || echo ""`);
        if (pid.stdout.trim()) {
            await sshExec(`kill -SIGTERM ${pid.stdout.trim()}`);
            await sshExec(`sleep 10`); // Wait for graceful shutdown
        }
    },

    async delete(server, sshExec) {
        await this.stop(server, sshExec);
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`rm -rf ${instancePath}`);
    }
};
