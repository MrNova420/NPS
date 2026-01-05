#!/usr/bin/env node
/**
 * Simple test server - stripped down version to test what's working
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Simple API test
app.get('/api/test', (req, res) => {
    res.json({ status: 'ok', message: 'Server working!' });
});

// Get templates
app.get('/api/templates', async (req, res) => {
    try {
        const templatesDir = path.join(__dirname, '../../server-templates');
        const advancedDir = path.join(templatesDir, 'advanced');
        
        const basicFiles = await fs.readdir(templatesDir);
        const basicTemplates = basicFiles
            .filter(f => f.endsWith('.js'))
            .map(f => ({ name: f.replace('.js', ''), path: templatesDir }));
        
        let advancedTemplates = [];
        try {
            const advancedFiles = await fs.readdir(advancedDir);
            advancedTemplates = advancedFiles
                .filter(f => f.endsWith('.js'))
                .map(f => ({ name: f.replace('.js', ''), path: advancedDir }));
        } catch (e) {
            console.log('No advanced templates directory');
        }
        
        const allTemplates = [...basicTemplates, ...advancedTemplates];
        
        const details = await Promise.all(
            allTemplates.map(async ({ name, path: templatePath }) => {
                try {
                    const template = require(path.join(templatePath, `${name}.js`));
                    return {
                        id: name,
                        name: template.name || name,
                        description: template.description || 'No description',
                        category: template.category || 'basic',
                        icon: template.icon || '📦',
                        defaultPort: template.defaultPort || 8000
                    };
                } catch (err) {
                    console.error(`Failed to load template ${name}:`, err.message);
                    return null;
                }
            })
        );
        
        res.json(details.filter(d => d !== null));
    } catch (error) {
        console.error('Template loading error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get servers (mock)
app.get('/api/servers', (req, res) => {
    res.json([]);
});

// System stats (mock)
app.get('/api/system/stats', (req, res) => {
    const os = require('os');
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    res.json({
        stats: {
            cpu: Math.random() * 50,
            memory: {
                total: Math.round(totalMem / 1024 / 1024),
                used: Math.round(usedMem / 1024 / 1024),
                percentage: Math.round((usedMem / totalMem) * 100)
            },
            disk: {
                percentage: 50
            },
            timestamp: Date.now()
        }
    });
});

app.listen(PORT, () => {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  NPS Dashboard - Simple Test Server             ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log(`🚀 Running on http://localhost:${PORT}`);
    console.log('');
    console.log('Testing basic functionality:');
    console.log('  ✓ Express server');
    console.log('  ✓ Static file serving');
    console.log('  ✓ Template loading');
    console.log('  ✓ API endpoints');
    console.log('');
    console.log('Open http://localhost:3002 in your browser');
});
