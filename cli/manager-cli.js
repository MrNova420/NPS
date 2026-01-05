#!/usr/bin/env node
/**
 * CLI for Android Server Manager
 * Command-line interface for managing servers
 */

const { exec } = require('child_process');
const readline = require('readline');
const fs = require('fs').promises;

const ANDROID_HOST = process.env.ANDROID_HOST || 'localhost';
const ANDROID_PORT = process.env.ANDROID_PORT || '8022';
const ANDROID_USER = process.env.ANDROID_USER || 'u0_a';
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function apiCall(endpoint, method = 'GET', body = null) {
    const fetch = (await import('node-fetch')).default;
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);
    
    const response = await fetch(`${DASHBOARD_URL}/api${endpoint}`, options);
    return await response.json();
}

async function listServers() {
    console.log('\n📋 Active Servers:\n');
    const servers = await apiCall('/servers');
    
    if (servers.length === 0) {
        console.log('No servers running.\n');
        return;
    }
    
    servers.forEach(s => {
        console.log(`┌─ ${s.name} (${s.id})`);
        console.log(`│  Type: ${s.type}`);
        console.log(`│  Status: ${s.status}`);
        console.log(`│  Port: ${s.port}`);
        console.log(`│  CPU: ${s.stats.cpu?.toFixed(1) || 0}% | Memory: ${s.stats.memory?.toFixed(1) || 0}%`);
        console.log(`└─\n`);
    });
}

async function listTemplates() {
    console.log('\n🎨 Available Templates:\n');
    const templates = await apiCall('/templates');
    
    templates.forEach(t => {
        console.log(`${t.icon}  ${t.name}`);
        console.log(`   ${t.description}`);
        console.log(`   Category: ${t.category}\n`);
    });
}

async function createServer() {
    console.log('\n🚀 Create New Server\n');
    
    const templates = await apiCall('/templates');
    console.log('Available templates:');
    templates.forEach((t, i) => {
        console.log(`${i + 1}. ${t.icon} ${t.name}`);
    });
    
    const choice = await question('\nSelect template (number): ');
    const template = templates[parseInt(choice) - 1];
    
    if (!template) {
        console.log('Invalid choice.');
        return;
    }
    
    const name = await question('Server name: ');
    const port = await question(`Port (default: ${template.defaultPort}): `);
    
    const config = {
        name,
        type: template.id,
        port: port ? parseInt(port) : template.defaultPort
    };
    
    // Ask for config options
    if (template.configOptions && template.configOptions.length > 0) {
        console.log('\nConfiguration:');
        for (const opt of template.configOptions) {
            const value = await question(`${opt.label}${opt.required ? ' (required)' : ''}: `);
            if (value || !opt.required) {
                config[opt.name] = value || opt.default;
            }
        }
    }
    
    console.log('\nCreating server...');
    const result = await apiCall('/servers', 'POST', config);
    console.log(`✓ Server created: ${result.name} (${result.id})`);
}

async function controlServer() {
    const servers = await apiCall('/servers');
    
    if (servers.length === 0) {
        console.log('No servers available.');
        return;
    }
    
    console.log('\nServers:');
    servers.forEach((s, i) => {
        console.log(`${i + 1}. ${s.name} [${s.status}]`);
    });
    
    const choice = await question('\nSelect server (number): ');
    const server = servers[parseInt(choice) - 1];
    
    if (!server) {
        console.log('Invalid choice.');
        return;
    }
    
    console.log('\nActions:');
    console.log('1. Start');
    console.log('2. Stop');
    console.log('3. Restart');
    console.log('4. View Logs');
    console.log('5. Delete');
    
    const action = await question('\nSelect action (number): ');
    
    const actions = ['start', 'stop', 'restart', 'logs', 'delete'];
    const selectedAction = actions[parseInt(action) - 1];
    
    if (selectedAction === 'logs') {
        const logs = await apiCall(`/servers/${server.id}/logs`);
        console.log('\n' + logs.logs);
    } else if (selectedAction === 'delete') {
        const confirm = await question('Are you sure? (yes/no): ');
        if (confirm.toLowerCase() === 'yes') {
            await apiCall(`/servers/${server.id}/delete`, 'POST');
            console.log('✓ Server deleted');
        }
    } else if (selectedAction) {
        await apiCall(`/servers/${server.id}/${selectedAction}`, 'POST');
        console.log(`✓ ${selectedAction} completed`);
    }
}

async function systemInfo() {
    console.log('\n📊 System Information:\n');
    const stats = await apiCall('/system/stats');
    console.log(stats.stats);
}

async function main() {
    console.log('╔═══════════════════════════════════════╗');
    console.log('║  Android Server Manager - CLI        ║');
    console.log('╚═══════════════════════════════════════╝\n');
    
    while (true) {
        console.log('\nMain Menu:');
        console.log('1. List Servers');
        console.log('2. Create Server');
        console.log('3. Control Server');
        console.log('4. View Templates');
        console.log('5. System Info');
        console.log('6. Exit\n');
        
        const choice = await question('Select option: ');
        
        try {
            switch (choice) {
                case '1':
                    await listServers();
                    break;
                case '2':
                    await createServer();
                    break;
                case '3':
                    await controlServer();
                    break;
                case '4':
                    await listTemplates();
                    break;
                case '5':
                    await systemInfo();
                    break;
                case '6':
                    console.log('\nGoodbye! 👋\n');
                    rl.close();
                    process.exit(0);
                default:
                    console.log('Invalid option.');
            }
        } catch (error) {
            console.error('Error:', error.message);
        }
    }
}

if (require.main === module) {
    main().catch(console.error);
}
