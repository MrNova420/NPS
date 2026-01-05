/**
 * Minecraft Server Template - Production Grade
 * Features: Paper server, optimized JVM flags, auto-backup, monitoring
 */

module.exports = {
    name: 'Minecraft Server',
    description: 'Production-grade Paper Minecraft server with JVM optimization, auto-backup, and monitoring',
    category: 'Gaming',
    icon: '⛏️',
    defaultPort: 25565,
    requirements: ['openjdk-17'],
    
    // Resource requirements
    resources: {
        cpu: 25,
        memory: 1024,
        priority: 'high',
        bandwidth: { download: 5, upload: 5 }
    },
    
    configOptions: [
        { name: 'serverName', label: 'Server Name', type: 'text', required: true, placeholder: 'My Minecraft Server' },
        { name: 'maxPlayers', label: 'Max Players', type: 'number', default: 20 },
        { name: 'difficulty', label: 'Difficulty', type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'], default: 'normal' },
        { name: 'gamemode', label: 'Game Mode', type: 'select', options: ['survival', 'creative', 'adventure'], default: 'survival' },
        { name: 'pvp', label: 'PvP Enabled', type: 'checkbox', default: true },
        { name: 'memory', label: 'Memory (MB)', type: 'number', default: 1024 },
        { name: 'viewDistance', label: 'View Distance', type: 'number', default: 8 },
        { name: 'enableBackups', label: 'Enable Auto-Backup', type: 'checkbox', default: true }
    ],

    async deploy(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        const memory = server.config.memory || 1024;
        const viewDistance = server.config.viewDistance || 8;
        
        // Create directories
        await sshExec(`mkdir -p ${instancePath}/{logs,backups,plugins,world}`);
        
        // Download Paper (optimized Minecraft server) - Latest stable version
        console.log('Downloading Paper server...');
        await sshExec(`cd ${instancePath} && curl -o server.jar https://api.papermc.io/v2/projects/paper/versions/1.20.4/builds/latest/downloads/paper-1.20.4-latest.jar`);
        
        // Accept EULA
        await sshExec(`echo "eula=true" > ${instancePath}/eula.txt`);
        
        // Create optimized server.properties
        await sshExec(`cat > ${instancePath}/server.properties << 'EOF'
# Server Identity
server-name=${server.config.serverName}
server-port=${server.port}
motd=§6${server.config.serverName}§r\\n§7Powered by NPS

# Performance Settings (Optimized for ARM)
max-players=${server.config.maxPlayers || 20}
view-distance=${viewDistance}
simulation-distance=${Math.max(4, viewDistance - 2)}
max-world-size=10000
network-compression-threshold=256

# Game Settings
difficulty=${server.config.difficulty || 'normal'}
gamemode=${server.config.gamemode || 'survival'}
hardcore=false
pvp=${server.config.pvp !== false}
spawn-protection=16
allow-flight=false
enable-command-block=true

# World Settings
level-name=world
level-seed=
generate-structures=true
level-type=minecraft\\:normal

# Network Settings
online-mode=true
prevent-proxy-connections=false
enable-status=true
enable-rcon=false
max-tick-time=60000
rate-limit=0

# Spawn Settings
spawn-animals=true
spawn-monsters=true
spawn-npcs=true

# Performance
entity-broadcast-range-percentage=100
use-native-transport=true

# Other
white-list=false
enforce-whitelist=false
resource-pack=
EOF`);

        // Create optimized Paper config
        await sshExec(`mkdir -p ${instancePath}/config`);
        await sshExec(`cat > ${instancePath}/config/paper-global.yml << 'EOF'
# Paper Configuration - ARM Optimized
_version: 28

chunk-loading:
  autoconfig-send-distance: true
  enable-frustum-priority: true
  global-max-chunk-load-rate: 100.0
  global-max-chunk-send-rate: 75.0
  global-max-concurrent-loads: 20.0
  max-concurrent-sends: 1
  min-load-radius: 2
  player-max-chunk-load-rate: 50.0
  player-max-concurrent-loads: 4.0
  target-player-chunk-send-rate: 10.0

timings:
  enabled: true
  verbose: false
  server-name: ${server.config.serverName}

unsupported-settings:
  allow-permanent-block-break-exploits: false
  allow-piston-duplication: false
EOF`);

        // Create start script with ARM-optimized JVM flags
        await sshExec(`cat > ${instancePath}/start.sh << 'EOF'
#!/bin/bash
cd ${instancePath}

# ARM-optimized JVM flags for Cortex-A53
java -Xmx${memory}M -Xms${Math.floor(memory * 0.5)}M \\
    -XX:+UseG1GC \\
    -XX:+ParallelRefProcEnabled \\
    -XX:MaxGCPauseMillis=200 \\
    -XX:+UnlockExperimentalVMOptions \\
    -XX:+DisableExplicitGC \\
    -XX:+AlwaysPreTouch \\
    -XX:G1NewSizePercent=30 \\
    -XX:G1MaxNewSizePercent=40 \\
    -XX:G1HeapRegionSize=8M \\
    -XX:G1ReservePercent=20 \\
    -XX:G1HeapWastePercent=5 \\
    -XX:G1MixedGCCountTarget=4 \\
    -XX:InitiatingHeapOccupancyPercent=15 \\
    -XX:G1MixedGCLiveThresholdPercent=90 \\
    -XX:G1RSetUpdatingPauseTimePercent=5 \\
    -XX:SurvivorRatio=32 \\
    -XX:+PerfDisableSharedMem \\
    -XX:MaxTenuringThreshold=1 \\
    -Dusing.aikars.flags=https://mcflags.emc.gs \\
    -Daikars.new.flags=true \\
    -jar server.jar nogui

echo "Server stopped at $(date)" >> logs/stop.log
EOF`);
        
        await sshExec(`chmod +x ${instancePath}/start.sh`);
        
        // Setup auto-backup if enabled
        if (server.config.enableBackups) {
            await this.setupBackups(server, sshExec, instancePath);
        }
        
        // Create server management commands
        await sshExec(`cat > ${instancePath}/send-command.sh << 'EOF'
#!/bin/bash
# Send command to Minecraft server via screen
screen -S minecraft-${server.id} -p 0 -X stuff "$1^M"
EOF`);
        await sshExec(`chmod +x ${instancePath}/send-command.sh`);
        
        // Start server in screen session for easier management
        await sshExec(`screen -dmS minecraft-${server.id} bash -c 'cd ${instancePath} && ./start.sh > logs/server.log 2>&1'`);
        
        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Get PID
        const { stdout: pidOut } = await sshExec(`pgrep -f "server.jar" | head -1`);
        const pid = parseInt(pidOut.trim());
        
        return { 
            instancePath, 
            port: server.port,
            connectAddress: `<phone-ip>:${server.port}`,
            memory: memory,
            pid,
            screenSession: `minecraft-${server.id}`,
            endpoints: {
                console: `screen -r minecraft-${server.id}`,
                sendCommand: `${instancePath}/send-command.sh`
            }
        };
    },

    async setupBackups(server, sshExec, instancePath) {
        // Create backup script
        await sshExec(`cat > ${instancePath}/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="${instancePath}/backups"
DATE=\$(date +%Y%m%d_%H%M%S)
WORLD_DIR="${instancePath}/world"

# Create backup
if [ -d "\${WORLD_DIR}" ]; then
    echo "Creating backup at \${DATE}..."
    tar -czf "\${BACKUP_DIR}/world_\${DATE}.tar.gz" -C "${instancePath}" world world_nether world_the_end
    echo "Backup completed: world_\${DATE}.tar.gz"
    
    # Keep only last 7 backups
    cd "\${BACKUP_DIR}"
    ls -t world_*.tar.gz | tail -n +8 | xargs -r rm
    echo "Old backups cleaned"
else
    echo "World directory not found"
fi
EOF`);

        await sshExec(`chmod +x ${instancePath}/backup.sh`);
        
        // Schedule daily backups at 3 AM
        await sshExec(`(crontab -l 2>/dev/null; echo "0 3 * * * ${instancePath}/backup.sh >> ${instancePath}/logs/backup.log 2>&1") | crontab -`);
        
        console.log('Auto-backup configured: Daily at 3 AM, keeping last 7 backups');
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
