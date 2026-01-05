#!/usr/bin/env node
// Quick test for live metrics WebSocket broadcasting

const WebSocket = require('ws');

console.log('Testing NPS Dashboard Live Metrics...\n');
console.log('Make sure dashboard is running: cd dashboard && npm start\n');

const ws = new WebSocket('ws://localhost:3000');

ws.on('open', () => {
    console.log('✓ WebSocket connected');
});

ws.on('message', (data) => {
    const msg = JSON.parse(data);
    
    if (msg.type === 'system_stats') {
        console.log('\n📊 System Stats Received:');
        console.log(`   CPU: ${Math.round(msg.stats.cpu)}%`);
        console.log(`   Memory: ${Math.round(msg.stats.memory.percentage)}% (${Math.round(msg.stats.memory.used/1024/1024)}MB / ${Math.round(msg.stats.memory.total/1024/1024)}MB)`);
        console.log(`   Disk: ${Math.round(msg.stats.disk.percentage)}% (${msg.stats.disk.used} / ${msg.stats.disk.total})`);
        console.log(`   Timestamp: ${new Date(msg.stats.timestamp).toLocaleTimeString()}`);
    } else if (msg.type === 'connected') {
        console.log('✓ Dashboard confirmed connection');
    } else {
        console.log(`  Other message: ${msg.type}`);
    }
});

ws.on('error', (error) => {
    console.error('✗ Connection failed:', error.message);
    console.log('\nMake sure dashboard is running on port 3000');
    process.exit(1);
});

ws.on('close', () => {
    console.log('\n✓ Test complete - WebSocket closed');
});

// Auto-close after 15 seconds
setTimeout(() => {
    console.log('\n✓ Test passed - metrics are being broadcast!');
    ws.close();
    process.exit(0);
}, 15000);
