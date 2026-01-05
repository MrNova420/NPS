/**
 * Discord Bot Template
 */

module.exports = {
    name: 'Discord Bot',
    description: 'Discord.js bot with automatic setup and management',
    category: 'Bots',
    icon: '🤖',
    defaultPort: 0, // No port needed
    requirements: ['nodejs', 'npm'],
    
    configOptions: [
        { name: 'botToken', label: 'Bot Token', type: 'password', required: true },
        { name: 'prefix', label: 'Command Prefix', type: 'text', default: '!' },
        { name: 'botName', label: 'Bot Name', type: 'text', required: true, placeholder: 'MyBot' }
    ],

    async deploy(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        
        // Create directory
        await sshExec(`mkdir -p ${instancePath}/logs ${instancePath}/commands`);
        
        // Create package.json
        await sshExec(`cat > ${instancePath}/package.json << 'EOF'
{
  "name": "${server.config.botName || server.name}",
  "version": "1.0.0",
  "main": "bot.js",
  "dependencies": {
    "discord.js": "^14.14.1"
  }
}
EOF`);

        // Create bot.js
        await sshExec(`cat > ${instancePath}/bot.js << 'EOF'
const { Client, GatewayIntentBits, Collection } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

const PREFIX = '${server.config.prefix || '!'}';

client.once('ready', () => {
    console.log('Bot is ready!');
    console.log('Logged in as: ' + client.user.tag);
    client.user.setActivity('${server.config.prefix || '!'}help', { type: 'WATCHING' });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Built-in commands
    if (command === 'ping') {
        const ping = Date.now() - message.createdTimestamp;
        message.reply('Pong! Latency: ' + ping + 'ms');
    }
    
    else if (command === 'help') {
        message.reply(
            '**Available Commands:**\\n' +
            PREFIX + 'ping - Check bot latency\\n' +
            PREFIX + 'help - Show this message\\n' +
            PREFIX + 'server - Show server stats\\n' +
            PREFIX + 'info - Bot information'
        );
    }
    
    else if (command === 'server') {
        message.reply(
            '**Server Stats:**\\n' +
            'Uptime: ' + Math.floor(process.uptime()) + ' seconds\\n' +
            'Memory: ' + Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB'
        );
    }
    
    else if (command === 'info') {
        message.reply(
            '**${server.config.botName}**\\n' +
            'Running on Android Server Manager\\n' +
            'Powered by Discord.js'
        );
    }
});

client.login('${server.config.botToken}');
EOF`);

        // Install dependencies
        await sshExec(`cd ${instancePath} && npm install --production`);
        
        // Start bot
        await sshExec(`cd ${instancePath} && nohup node bot.js > logs/bot.log 2>&1 & echo $! > logs/bot.pid`);
        
        return { instancePath, botName: server.config.botName };
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
