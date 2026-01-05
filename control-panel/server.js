#!/usr/bin/env node
/**
 * Web-based Control Panel for Android Server
 * Provides browser interface for server management
 */

const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const app = express();

const PORT = 3000;
const ANDROID_HOST = process.env.ANDROID_HOST || 'localhost';
const ANDROID_PORT = process.env.ANDROID_PORT || '8022';
const ANDROID_USER = process.env.ANDROID_USER || 'u0_a';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Execute SSH command on Android server
function sshExec(command) {
    return new Promise((resolve, reject) => {
        const sshCmd = `ssh -p ${ANDROID_PORT} ${ANDROID_USER}@${ANDROID_HOST} "${command}"`;
        exec(sshCmd, (error, stdout, stderr) => {
            if (error) {
                reject({ error: stderr || error.message });
            } else {
                resolve({ output: stdout });
            }
        });
    });
}

// API Endpoints

// Get system information
app.get('/api/system/info', async (req, res) => {
    try {
        const result = await sshExec('~/server/scripts/system-info.sh');
        res.json({ success: true, data: result.output });
    } catch (error) {
        res.status(500).json({ success: false, error: error.error });
    }
});

// Service control
app.post('/api/service/:action', async (req, res) => {
    const { action } = req.params;
    if (!['start', 'stop', 'status'].includes(action)) {
        return res.status(400).json({ success: false, error: 'Invalid action' });
    }
    
    try {
        const result = await sshExec(`~/server/scripts/service-manager.sh ${action}`);
        res.json({ success: true, data: result.output });
    } catch (error) {
        res.status(500).json({ success: false, error: error.error });
    }
});

// Execute custom command
app.post('/api/execute', async (req, res) => {
    const { command } = req.body;
    if (!command) {
        return res.status(400).json({ success: false, error: 'Command required' });
    }
    
    try {
        const result = await sshExec(command);
        res.json({ success: true, output: result.output });
    } catch (error) {
        res.status(500).json({ success: false, error: error.error });
    }
});

// Get resource usage
app.get('/api/resources', async (req, res) => {
    try {
        const [cpu, mem, disk] = await Promise.all([
            sshExec("top -bn1 | grep 'CPU:' | head -1"),
            sshExec("free -m | grep Mem"),
            sshExec("df -h $HOME | tail -1")
        ]);
        
        res.json({
            success: true,
            data: {
                cpu: cpu.output.trim(),
                memory: mem.output.trim(),
                disk: disk.output.trim()
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.error });
    }
});

// List running processes
app.get('/api/processes', async (req, res) => {
    try {
        const result = await sshExec("ps aux | head -20");
        res.json({ success: true, data: result.output });
    } catch (error) {
        res.status(500).json({ success: false, error: error.error });
    }
});

app.listen(PORT, () => {
    console.log(`Android Server Control Panel running on http://localhost:${PORT}`);
    console.log(`Connecting to: ${ANDROID_USER}@${ANDROID_HOST}:${ANDROID_PORT}`);
});
