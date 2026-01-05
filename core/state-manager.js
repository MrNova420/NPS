/**
 * State Manager - Persistent state management with auto-save
 * Prevents data loss during shutdowns
 */

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class StateManager extends EventEmitter {
    constructor(stateFile = '~/server/state/app-state.json') {
        super();
        this.stateFile = stateFile.replace('~', process.env.HOME);
        this.state = {
            servers: [],
            config: {},
            metrics: [],
            alerts: [],
            lastSaved: null,
            version: '1.0.0'
        };
        this.saveInterval = null;
        this.autoSaveDelay = 5000; // Save every 5 seconds if changed
        this.hasChanges = false;
    }

    async initialize() {
        // Ensure state directory exists
        const stateDir = path.dirname(this.stateFile);
        await fs.mkdir(stateDir, { recursive: true });

        // Load existing state
        await this.load();

        // Setup auto-save
        this.startAutoSave();

        // Handle graceful shutdown
        this.setupShutdownHandlers();

        console.log('State Manager initialized');
    }

    async load() {
        try {
            const data = await fs.readFile(this.stateFile, 'utf8');
            const loaded = JSON.parse(data);
            
            // Migrate if version mismatch
            if (loaded.version !== this.state.version) {
                this.state = this.migrate(loaded);
            } else {
                this.state = loaded;
            }
            
            console.log(`State loaded from ${this.stateFile}`);
            this.emit('loaded', this.state);
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('No existing state found, starting fresh');
                await this.save(); // Create initial state file
            } else {
                console.error('Failed to load state:', error.message);
            }
        }
    }

    async save() {
        try {
            this.state.lastSaved = new Date().toISOString();
            
            // Write to temp file first
            const tempFile = this.stateFile + '.tmp';
            await fs.writeFile(tempFile, JSON.stringify(this.state, null, 2));
            
            // Atomic rename
            await fs.rename(tempFile, this.stateFile);
            
            this.hasChanges = false;
            this.emit('saved', this.state);
            
            return true;
        } catch (error) {
            console.error('Failed to save state:', error.message);
            this.emit('save-error', error);
            return false;
        }
    }

    startAutoSave() {
        this.saveInterval = setInterval(() => {
            if (this.hasChanges) {
                this.save().catch(console.error);
            }
        }, this.autoSaveDelay);
    }

    stopAutoSave() {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
            this.saveInterval = null;
        }
    }

    setupShutdownHandlers() {
        const shutdown = async (signal) => {
            console.log(`\nReceived ${signal}, saving state...`);
            this.stopAutoSave();
            await this.save();
            console.log('State saved successfully');
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGHUP', () => shutdown('SIGHUP'));
        
        // Handle uncaught exceptions
        process.on('uncaughtException', async (error) => {
            console.error('Uncaught exception:', error);
            await this.save();
            process.exit(1);
        });
    }

    // State mutation methods
    updateServers(servers) {
        this.state.servers = servers;
        this.hasChanges = true;
        this.emit('servers-updated', servers);
    }

    addServer(server) {
        this.state.servers.push(server);
        this.hasChanges = true;
        this.emit('server-added', server);
    }

    updateServer(serverId, updates) {
        const index = this.state.servers.findIndex(s => s.id === serverId);
        if (index !== -1) {
            this.state.servers[index] = { ...this.state.servers[index], ...updates };
            this.hasChanges = true;
            this.emit('server-updated', this.state.servers[index]);
        }
    }

    removeServer(serverId) {
        const index = this.state.servers.findIndex(s => s.id === serverId);
        if (index !== -1) {
            const removed = this.state.servers.splice(index, 1)[0];
            this.hasChanges = true;
            this.emit('server-removed', removed);
        }
    }

    updateConfig(config) {
        this.state.config = { ...this.state.config, ...config };
        this.hasChanges = true;
        this.emit('config-updated', this.state.config);
    }

    addMetric(metric) {
        this.state.metrics.push(metric);
        
        // Keep only last 1000 metrics
        if (this.state.metrics.length > 1000) {
            this.state.metrics.shift();
        }
        
        this.hasChanges = true;
    }

    addAlert(alert) {
        this.state.alerts.push(alert);
        
        // Keep only last 100 alerts
        if (this.state.alerts.length > 100) {
            this.state.alerts.shift();
        }
        
        this.hasChanges = true;
    }

    clearOldMetrics(maxAge = 86400000) { // Default: 24 hours
        const cutoff = Date.now() - maxAge;
        const before = this.state.metrics.length;
        
        this.state.metrics = this.state.metrics.filter(m => 
            new Date(m.timestamp).getTime() > cutoff
        );
        
        if (this.state.metrics.length !== before) {
            this.hasChanges = true;
        }
    }

    // Getters
    getServers() {
        return this.state.servers;
    }

    getServer(serverId) {
        return this.state.servers.find(s => s.id === serverId);
    }

    getConfig() {
        return this.state.config;
    }

    getMetrics() {
        return this.state.metrics;
    }

    getAlerts() {
        return this.state.alerts;
    }

    getState() {
        return this.state;
    }

    // Migration helper
    migrate(oldState) {
        console.log(`Migrating state from ${oldState.version} to ${this.state.version}`);
        
        return {
            ...this.state,
            ...oldState,
            version: this.state.version
        };
    }

    // Backup state
    async backup() {
        const backupFile = this.stateFile.replace('.json', `-backup-${Date.now()}.json`);
        
        try {
            await fs.copyFile(this.stateFile, backupFile);
            console.log(`State backed up to ${backupFile}`);
            
            // Keep only last 10 backups
            const backupDir = path.dirname(this.stateFile);
            const files = await fs.readdir(backupDir);
            const backups = files
                .filter(f => f.includes('-backup-'))
                .sort()
                .reverse();
            
            for (let i = 10; i < backups.length; i++) {
                await fs.unlink(path.join(backupDir, backups[i]));
            }
            
            return backupFile;
        } catch (error) {
            console.error('Backup failed:', error.message);
            return null;
        }
    }

    // Restore from backup
    async restore(backupFile) {
        try {
            await fs.copyFile(backupFile, this.stateFile);
            await this.load();
            console.log(`State restored from ${backupFile}`);
            return true;
        } catch (error) {
            console.error('Restore failed:', error.message);
            return false;
        }
    }

    // Export state
    async export(exportFile) {
        try {
            const exportData = {
                ...this.state,
                exportedAt: new Date().toISOString(),
                exportVersion: this.state.version
            };
            
            await fs.writeFile(exportFile, JSON.stringify(exportData, null, 2));
            console.log(`State exported to ${exportFile}`);
            return true;
        } catch (error) {
            console.error('Export failed:', error.message);
            return false;
        }
    }

    // Import state
    async import(importFile) {
        try {
            const data = await fs.readFile(importFile, 'utf8');
            const imported = JSON.parse(data);
            
            // Backup current state first
            await this.backup();
            
            // Migrate if needed
            this.state = this.migrate(imported);
            await this.save();
            
            console.log(`State imported from ${importFile}`);
            this.emit('imported', this.state);
            return true;
        } catch (error) {
            console.error('Import failed:', error.message);
            return false;
        }
    }
}

module.exports = StateManager;
