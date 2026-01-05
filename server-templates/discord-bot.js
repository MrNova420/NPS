/**
 * Discord Bot Template - Production Grade
 * Features: Discord.js v14, command handler, error handling, auto-reconnect
 */

module.exports = {
    name: 'Discord Bot',
    description: 'Production-grade Discord.js bot with command handler, logging, and auto-reconnect',
    category: 'Bots',
    icon: '🤖',
    defaultPort: 0, // No port needed
    requirements: ['nodejs', 'npm'],
    
    // Resource requirements
    resources: {
        cpu: 5,
        memory: 128,
        priority: 'low',
        bandwidth: { download: 2, upload: 2 }
    },
    
    configOptions: [
        { name: 'botToken', label: 'Bot Token', type: 'password', required: true },
        { name: 'prefix', label: 'Command Prefix', type: 'text', default: '!' },
        { name: 'botName', label: 'Bot Name', type: 'text', required: true, placeholder: 'MyBot' },
        { name: 'enableLogging', label: 'Enable Logging', type: 'checkbox', default: true }
    ],

    async deploy(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        
        // Create directory structure
        await sshExec(`mkdir -p ${instancePath}/{logs,commands,config,data}`);
        
        // Create package.json with production dependencies
        await sshExec(`cat > ${instancePath}/package.json << 'EOF'
{
  "name": "${server.config.botName || server.name}",
  "version": "1.0.0",
  "main": "bot.js",
  "scripts": {
    "start": "node bot.js",
    "dev": "nodemon bot.js"
  },
  "dependencies": {
    "discord.js": "^14.14.1",
    "dotenv": "^16.3.1"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
EOF`);

        // Create production-grade bot.js
        await sshExec(`cat > ${instancePath}/bot.js << 'EOF'
const { Client, GatewayIntentBits, Collection, Events, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Configuration
const PREFIX = '${server.config.prefix || '!'}';
const BOT_NAME = '${server.config.botName}';
const ENABLE_LOGGING = ${server.config.enableLogging !== false};

// Create client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    presence: {
        activities: [{ name: PREFIX + 'help', type: ActivityType.Watching }],
        status: 'online'
    }
});

// Commands collection
client.commands = new Collection();

// Logging utility
const log = (level, message) => {
    const timestamp = new Date().toISOString();
    const logMessage = \`[\${timestamp}] [\${level}] \${message}\`;
    console.log(logMessage);
    
    if (ENABLE_LOGGING) {
        const logFile = path.join(__dirname, 'logs', 'bot.log');
        fs.appendFileSync(logFile, logMessage + '\\n');
    }
};

// Error handling
process.on('unhandledRejection', (error) => {
    log('ERROR', \`Unhandled rejection: \${error.message}\`);
    console.error(error);
});

process.on('uncaughtException', (error) => {
    log('FATAL', \`Uncaught exception: \${error.message}\`);
    console.error(error);
    process.exit(1);
});

// Bot ready event
client.once(Events.ClientReady, (c) => {
    log('INFO', \`Bot is ready! Logged in as \${c.user.tag}\`);
    log('INFO', \`Serving \${c.guilds.cache.size} guild(s)\`);
    
    // Set activity
    c.user.setActivity(PREFIX + 'help', { type: ActivityType.Watching });
});

// Reconnection handling
client.on(Events.Disconnect, () => {
    log('WARN', 'Bot disconnected from Discord');
});

client.on(Events.Reconnecting, () => {
    log('INFO', 'Bot reconnecting to Discord...');
});

client.on(Events.Resume, () => {
    log('INFO', 'Bot resumed connection');
});

// Guild join/leave logging
client.on(Events.GuildCreate, (guild) => {
    log('INFO', \`Joined new guild: \${guild.name} (ID: \${guild.id})\`);
});

client.on(Events.GuildDelete, (guild) => {
    log('INFO', \`Left guild: \${guild.name} (ID: \${guild.id})\`);
});

// Message handler with command processing
client.on(Events.MessageCreate, async (message) => {
    // Ignore bot messages and non-command messages
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    try {
        // Built-in commands
        switch (commandName) {
            case 'ping':
                const start = Date.now();
                const msg = await message.reply('Pinging...');
                const latency = Date.now() - start;
                await msg.edit(\`🏓 Pong!\\nLatency: \${latency}ms\\nAPI Latency: \${Math.round(client.ws.ping)}ms\`);
                log('COMMAND', \`ping executed by \${message.author.tag}\`);
                break;

            case 'help':
                const embed = {
                    color: 0x0099ff,
                    title: \`\${BOT_NAME} Commands\`,
                    description: 'Available commands:',
                    fields: [
                        { name: \`\${PREFIX}ping\`, value: 'Check bot latency', inline: true },
                        { name: \`\${PREFIX}help\`, value: 'Show this message', inline: true },
                        { name: \`\${PREFIX}stats\`, value: 'Bot statistics', inline: true },
                        { name: \`\${PREFIX}uptime\`, value: 'Bot uptime', inline: true },
                        { name: \`\${PREFIX}serverinfo\`, value: 'Server information', inline: true },
                        { name: \`\${PREFIX}userinfo\`, value: 'User information', inline: true },
                    ],
                    footer: { text: 'Powered by NPS' },
                    timestamp: new Date()
                };
                await message.reply({ embeds: [embed] });
                log('COMMAND', \`help executed by \${message.author.tag}\`);
                break;

            case 'stats':
                const memUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
                const uptime = Math.floor(process.uptime());
                const statsEmbed = {
                    color: 0x00ff00,
                    title: 'Bot Statistics',
                    fields: [
                        { name: 'Servers', value: \`\${client.guilds.cache.size}\`, inline: true },
                        { name: 'Users', value: \`\${client.users.cache.size}\`, inline: true },
                        { name: 'Memory Usage', value: \`\${memUsage} MB\`, inline: true },
                        { name: 'Uptime', value: \`\${uptime} seconds\`, inline: true },
                        { name: 'Ping', value: \`\${Math.round(client.ws.ping)}ms\`, inline: true },
                    ],
                    timestamp: new Date()
                };
                await message.reply({ embeds: [statsEmbed] });
                log('COMMAND', \`stats executed by \${message.author.tag}\`);
                break;

            case 'uptime':
                const seconds = Math.floor(process.uptime());
                const days = Math.floor(seconds / 86400);
                const hours = Math.floor((seconds % 86400) / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);
                const secs = seconds % 60;
                await message.reply(\`⏰ Uptime: \${days}d \${hours}h \${minutes}m \${secs}s\`);
                log('COMMAND', \`uptime executed by \${message.author.tag}\`);
                break;

            case 'serverinfo':
                if (!message.guild) {
                    await message.reply('This command can only be used in a server!');
                    return;
                }
                const serverEmbed = {
                    color: 0xff9900,
                    title: message.guild.name,
                    thumbnail: { url: message.guild.iconURL() },
                    fields: [
                        { name: 'Owner', value: \`<@\${message.guild.ownerId}>\`, inline: true },
                        { name: 'Members', value: \`\${message.guild.memberCount}\`, inline: true },
                        { name: 'Created', value: message.guild.createdAt.toDateString(), inline: true },
                    ],
                    timestamp: new Date()
                };
                await message.reply({ embeds: [serverEmbed] });
                log('COMMAND', \`serverinfo executed by \${message.author.tag}\`);
                break;

            case 'userinfo':
                const user = message.mentions.users.first() || message.author;
                const member = message.guild?.members.cache.get(user.id);
                const userEmbed = {
                    color: 0x9900ff,
                    title: user.tag,
                    thumbnail: { url: user.displayAvatarURL() },
                    fields: [
                        { name: 'ID', value: user.id, inline: true },
                        { name: 'Joined Discord', value: user.createdAt.toDateString(), inline: true },
                        { name: 'Bot', value: user.bot ? 'Yes' : 'No', inline: true },
                    ],
                    timestamp: new Date()
                };
                if (member) {
                    userEmbed.fields.push({ name: 'Joined Server', value: member.joinedAt.toDateString(), inline: true });
                }
                await message.reply({ embeds: [userEmbed] });
                log('COMMAND', \`userinfo executed by \${message.author.tag}\`);
                break;

            default:
                await message.reply(\`Unknown command. Use \${PREFIX}help for available commands.\`);
        }
    } catch (error) {
        log('ERROR', \`Command error (\${commandName}): \${error.message}\`);
        await message.reply('An error occurred while executing that command.').catch(() => {});
    }
});

// Error event
client.on(Events.Error, (error) => {
    log('ERROR', \`Discord client error: \${error.message}\`);
    console.error(error);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    log('INFO', 'Received SIGTERM, shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

process.on('SIGINT', async () => {
    log('INFO', 'Received SIGINT, shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

// Login
client.login('${server.config.botToken}').catch((error) => {
    log('FATAL', \`Failed to login: \${error.message}\`);
    console.error(error);
    process.exit(1);
});

// Health check interval
setInterval(() => {
    log('DEBUG', \`Status: \${client.ws.status} | Guilds: \${client.guilds.cache.size} | Users: \${client.users.cache.size}\`);
}, 300000); // Every 5 minutes
EOF`);

        // Install dependencies
        console.log('Installing Discord bot dependencies...');
        await sshExec(`cd ${instancePath} && npm install --production --no-audit --no-fund`);
        
        // Start bot
        await sshExec(`cd ${instancePath} && nohup node bot.js > logs/console.log 2>&1 & echo $! > logs/bot.pid`);
        
        // Wait for bot to start
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Get PID
        const { stdout: pidOut } = await sshExec(`cat ${instancePath}/logs/bot.pid`);
        const pid = parseInt(pidOut.trim());
        
        return { 
            instancePath, 
            botName: server.config.botName,
            prefix: server.config.prefix,
            pid,
            endpoints: {
                logs: `${instancePath}/logs/bot.log`,
                console: `${instancePath}/logs/console.log`
            }
        };
    },

    async start(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`cd ${instancePath} && nohup node bot.js > logs/bot.log 2>&1 & echo $! > logs/bot.pid`);
    },

    async stop(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`kill $(cat ${instancePath}/logs/bot.pid) 2>/dev/null || true`);
    },

    async delete(server, sshExec) {
        await this.stop(server, sshExec);
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`rm -rf ${instancePath}`);
    }
};
