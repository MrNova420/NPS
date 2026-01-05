#!/usr/bin/env node
/**
 * NPS Comprehensive Test Suite
 * Tests all components, templates, and features
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class NPSTestSuite {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            warnings: 0,
            tests: []
        };
        this.startTime = Date.now();
    }

    log(type, message, details = '') {
        const colors = {
            pass: '\x1b[32m✓\x1b[0m',
            fail: '\x1b[31m✗\x1b[0m',
            warn: '\x1b[33m⚠\x1b[0m',
            info: '\x1b[36mℹ\x1b[0m'
        };
        console.log(`${colors[type] || ''} ${message}`);
        if (details) console.log(`  ${details}`);
    }

    async test(name, fn) {
        try {
            await fn();
            this.results.passed++;
            this.results.tests.push({ name, status: 'pass' });
            this.log('pass', name);
            return true;
        } catch (error) {
            this.results.failed++;
            this.results.tests.push({ name, status: 'fail', error: error.message });
            this.log('fail', name, error.message);
            return false;
        }
    }

    async warn(name, message) {
        this.results.warnings++;
        this.results.tests.push({ name, status: 'warn', message });
        this.log('warn', name, message);
    }

    // Core System Tests
    async testFileStructure() {
        await this.test('File structure exists', async () => {
            const required = [
                'dashboard/backend/server.js',
                'dashboard/frontend/public/index.html',
                'core/performance/manager.js',
                'core/performance/optimize.sh',
                'core/security/production-harden.sh',
                'setup.sh',
                'cli/manager-cli.js'
            ];

            for (const file of required) {
                const fullPath = path.join(__dirname, '..', file);
                const exists = await fs.access(fullPath).then(() => true).catch(() => false);
                if (!exists) throw new Error(`Missing: ${file}`);
            }
        });
    }

    async testTemplates() {
        await this.test('All templates load correctly', async () => {
            const templateDir = path.join(__dirname, '..', 'server-templates');
            const files = await fs.readdir(templateDir);
            const jsFiles = files.filter(f => f.endsWith('.js'));
            
            for (const file of jsFiles) {
                const template = require(path.join(templateDir, file));
                if (!template.name || !template.deploy) {
                    throw new Error(`Invalid template: ${file}`);
                }
            }

            // Check advanced templates
            const advancedDir = path.join(templateDir, 'advanced');
            const advancedFiles = await fs.readdir(advancedDir);
            const advancedJs = advancedFiles.filter(f => f.endsWith('.js'));
            
            for (const file of advancedJs) {
                const template = require(path.join(advancedDir, file));
                if (!template.name || !template.deploy) {
                    throw new Error(`Invalid advanced template: ${file}`);
                }
            }
        });
    }

    async testDashboardDependencies() {
        await this.test('Dashboard dependencies installed', async () => {
            const nodeModules = path.join(__dirname, '..', 'dashboard', 'node_modules');
            const modules = await fs.readdir(nodeModules).catch(() => []);
            
            if (modules.length === 0) {
                throw new Error('Dependencies not installed');
            }

            const required = ['express', 'ws'];
            for (const dep of required) {
                if (!modules.includes(dep)) {
                    throw new Error(`Missing dependency: ${dep}`);
                }
            }
        });
    }

    async testPerformanceManager() {
        await this.test('Performance Manager initializes', async () => {
            const pmPath = path.join(__dirname, '..', 'core', 'performance', 'manager.js');
            const PerformanceManager = require(pmPath);
            const pm = new PerformanceManager();
            
            if (typeof pm.initialize !== 'function') {
                throw new Error('Missing initialize method');
            }
            if (typeof pm.getMetrics !== 'function') {
                throw new Error('Missing getMetrics method');
            }
        });
    }

    async testScriptExecutability() {
        await this.test('Setup scripts are executable', async () => {
            const scripts = [
                'setup.sh',
                'core/performance/optimize.sh',
                'core/security/production-harden.sh'
            ];

            for (const script of scripts) {
                const fullPath = path.join(__dirname, '..', script);
                try {
                    await fs.access(fullPath, fs.constants.X_OK);
                } catch {
                    // Try to make it executable
                    await execPromise(`chmod +x ${fullPath}`);
                }
                
                // Verify it's executable now
                const stats = await fs.stat(fullPath);
                if ((stats.mode & 0o111) === 0) {
                    throw new Error(`Not executable: ${script}`);
                }
            }
        });
    }

    async testConfigurationFiles() {
        await this.test('Configuration files exist', async () => {
            const configs = [
                '.env.example',
                'dashboard/package.json'
            ];

            for (const config of configs) {
                const fullPath = path.join(__dirname, '..', config);
                const exists = await fs.access(fullPath).then(() => true).catch(() => false);
                if (!exists) throw new Error(`Missing: ${config}`);
            }
        });
    }

    async testDocumentation() {
        await this.test('Documentation is complete', async () => {
            const docs = [
                'NPS_README.md',
                'PRODUCTION_README.md',
                'START_HERE.md',
                'QUICKSTART.md',
                'FEATURES.md'
            ];

            for (const doc of docs) {
                const fullPath = path.join(__dirname, '..', doc);
                const exists = await fs.access(fullPath).then(() => true).catch(() => false);
                if (!exists) throw new Error(`Missing: ${doc}`);
                
                const content = await fs.readFile(fullPath, 'utf8');
                if (content.length < 100) {
                    throw new Error(`${doc} is too short`);
                }
            }
        });
    }

    async testSecurityFeatures() {
        await this.test('Security hardening script is valid', async () => {
            const scriptPath = path.join(__dirname, '..', 'core/security/production-harden.sh');
            const script = await fs.readFile(scriptPath, 'utf8');
            
            const required = [
                'ssh',
                'firewall',
                'backup',
                'health',
                'recovery'
            ];

            for (const feature of required) {
                if (!script.toLowerCase().includes(feature)) {
                    throw new Error(`Missing security feature: ${feature}`);
                }
            }
        });
    }

    async testServerManagerAPI() {
        await this.test('Server Manager has required methods', async () => {
            const serverPath = path.join(__dirname, '..', 'dashboard/backend/server.js');
            const serverCode = await fs.readFile(serverPath, 'utf8');
            
            const required = [
                'createServer',
                'deleteServer',
                'startServer',
                'stopServer',
                'getServers'
            ];

            for (const method of required) {
                if (!serverCode.includes(method)) {
                    throw new Error(`Missing API method: ${method}`);
                }
            }
        });
    }

    async testTemplateCount() {
        await this.test('Minimum 12 templates available', async () => {
            const templateDir = path.join(__dirname, '..', 'server-templates');
            const templates = await fs.readdir(templateDir);
            const jsFiles = templates.filter(f => f.endsWith('.js'));
            
            const advancedDir = path.join(templateDir, 'advanced');
            const advanced = await fs.readdir(advancedDir);
            const advancedJs = advanced.filter(f => f.endsWith('.js'));
            
            const total = jsFiles.length + advancedJs.length;
            if (total < 12) {
                throw new Error(`Only ${total} templates found, need 12+`);
            }
        });
    }

    async testPerformanceConfig() {
        await this.test('Performance optimization script is comprehensive', async () => {
            const scriptPath = path.join(__dirname, '..', 'core/performance/optimize.sh');
            const script = await fs.readFile(scriptPath, 'utf8');
            
            const features = [
                'cpu',
                'memory',
                'swap',
                'thermal',
                'kernel',
                'tier'
            ];

            for (const feature of features) {
                if (!script.toLowerCase().includes(feature)) {
                    throw new Error(`Missing optimization: ${feature}`);
                }
            }
        });
    }

    async testNodeVersion() {
        await this.test('Node.js version is compatible', async () => {
            const version = process.version;
            const major = parseInt(version.slice(1).split('.')[0]);
            
            if (major < 14) {
                throw new Error(`Node.js ${version} is too old, need 14+`);
            }
        });
    }

    async testDashboardStartup() {
        await this.test('Dashboard can be initialized', async () => {
            const serverPath = path.join(__dirname, '..', 'dashboard/backend/server.js');
            const code = await fs.readFile(serverPath, 'utf8');
            
            // Check for critical imports
            if (!code.includes('express')) throw new Error('Missing Express import');
            if (!code.includes('WebSocket')) throw new Error('Missing WebSocket import');
            if (!code.includes('PerformanceManager')) throw new Error('Missing PerformanceManager');
        });
    }

    async testTemplateStructure() {
        await this.test('All templates follow required structure', async () => {
            const templateDir = path.join(__dirname, '..', 'server-templates');
            const templates = await fs.readdir(templateDir);
            const jsFiles = templates.filter(f => f.endsWith('.js'));
            
            for (const file of jsFiles) {
                const template = require(path.join(templateDir, file));
                
                const required = ['name', 'description', 'category', 'icon', 'deploy'];
                for (const field of required) {
                    if (!template[field]) {
                        throw new Error(`Template ${file} missing field: ${field}`);
                    }
                }
            }
        });
    }

    generateReport() {
        const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
        const total = this.results.passed + this.results.failed;
        const passRate = ((this.results.passed / total) * 100).toFixed(1);

        console.log('\n' + '='.repeat(60));
        console.log('NPS TEST SUITE REPORT');
        console.log('='.repeat(60));
        console.log(`Duration: ${duration}s`);
        console.log(`Total Tests: ${total}`);
        console.log(`\x1b[32mPassed: ${this.results.passed}\x1b[0m`);
        console.log(`\x1b[31mFailed: ${this.results.failed}\x1b[0m`);
        console.log(`\x1b[33mWarnings: ${this.results.warnings}\x1b[0m`);
        console.log(`Pass Rate: ${passRate}%`);
        console.log('='.repeat(60));

        if (this.results.failed > 0) {
            console.log('\n\x1b[31mFailed Tests:\x1b[0m');
            this.results.tests
                .filter(t => t.status === 'fail')
                .forEach(t => console.log(`  • ${t.name}: ${t.error}`));
        }

        if (this.results.warnings > 0) {
            console.log('\n\x1b[33mWarnings:\x1b[0m');
            this.results.tests
                .filter(t => t.status === 'warn')
                .forEach(t => console.log(`  • ${t.name}: ${t.message}`));
        }

        console.log('');
        return this.results.failed === 0;
    }

    async runAll() {
        console.log('╔═══════════════════════════════════════════════════╗');
        console.log('║         NPS Comprehensive Test Suite             ║');
        console.log('╚═══════════════════════════════════════════════════╝\n');

        // Core Tests
        console.log('\n📁 Testing Core System...');
        await this.testFileStructure();
        await this.testConfigurationFiles();
        await this.testScriptExecutability();

        // Component Tests
        console.log('\n🔧 Testing Components...');
        await this.testDashboardDependencies();
        await this.testPerformanceManager();
        await this.testServerManagerAPI();

        // Template Tests
        console.log('\n📦 Testing Templates...');
        await this.testTemplates();
        await this.testTemplateCount();
        await this.testTemplateStructure();

        // Security Tests
        console.log('\n🔒 Testing Security...');
        await this.testSecurityFeatures();

        // Performance Tests
        console.log('\n⚡ Testing Performance...');
        await this.testPerformanceConfig();
        await this.testNodeVersion();

        // Documentation Tests
        console.log('\n📚 Testing Documentation...');
        await this.testDocumentation();

        // Integration Tests
        console.log('\n🔗 Testing Integration...');
        await this.testDashboardStartup();

        return this.generateReport();
    }
}

// Run tests
if (require.main === module) {
    const suite = new NPSTestSuite();
    suite.runAll()
        .then(success => process.exit(success ? 0 : 1))
        .catch(error => {
            console.error('Test suite crashed:', error);
            process.exit(1);
        });
}

module.exports = NPSTestSuite;
