/**
 * Enterprise Backup & Disaster Recovery Manager
 * Automated backups, point-in-time recovery, replication
 */

const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const path = require('path');
const crypto = require('crypto');

class BackupManager {
    constructor() {
        this.backups = [];
        this.schedule = {
            full: '0 2 * * *', // 2 AM daily
            incremental: '0 */6 * * *', // Every 6 hours
            snapshot: '*/30 * * * *' // Every 30 minutes
        };
        
        this.config = {
            backupDir: process.env.HOME + '/server/backups',
            retention: {
                daily: 7,
                weekly: 4,
                monthly: 12
            },
            compression: true,
            encryption: true,
            replication: {
                enabled: false,
                targets: []
            }
        };

        this.runningBackup = false;
    }

    async initialize() {
        console.log('💾 Backup Manager initializing...');

        // Load config
        try {
            const configPath = process.env.HOME + '/server/config/backup.json';
            const data = await fs.readFile(configPath, 'utf8');
            this.config = { ...this.config, ...JSON.parse(data) };
        } catch (error) {
            await this.createDefaultConfig();
        }

        // Ensure backup directory exists
        await fs.mkdir(this.config.backupDir, { recursive: true });

        // Load backup history
        await this.loadBackupHistory();

        // Schedule automatic backups
        this.scheduleBackups();

        console.log('💾 Backup Manager active');
    }

    async createBackup(type = 'full', targets = ['servers', 'config', 'database']) {
        if (this.runningBackup) {
            throw new Error('Backup already in progress');
        }

        this.runningBackup = true;
        const backup = {
            id: crypto.randomUUID(),
            type,
            targets,
            started: Date.now(),
            status: 'running',
            size: 0,
            files: 0
        };

        console.log(`💾 Starting ${type} backup...`);

        try {
            const backupPath = path.join(
                this.config.backupDir,
                `backup-${type}-${Date.now()}`
            );
            
            await fs.mkdir(backupPath, { recursive: true });

            // Backup servers
            if (targets.includes('servers')) {
                await this.backupServers(backupPath);
            }

            // Backup configuration
            if (targets.includes('config')) {
                await this.backupConfig(backupPath);
            }

            // Backup database
            if (targets.includes('database')) {
                await this.backupDatabase(backupPath);
            }

            // Backup state
            if (targets.includes('state')) {
                await this.backupState(backupPath);
            }

            // Get backup size
            const { stdout } = await execAsync(`du -sh ${backupPath} | cut -f1`);
            backup.size = stdout.trim();

            // Count files
            const { stdout: files } = await execAsync(`find ${backupPath} -type f | wc -l`);
            backup.files = parseInt(files.trim());

            // Compress if enabled
            if (this.config.compression) {
                await this.compressBackup(backupPath);
                backup.compressed = true;
            }

            // Encrypt if enabled
            if (this.config.encryption) {
                await this.encryptBackup(backupPath);
                backup.encrypted = true;
            }

            // Create checksum
            backup.checksum = await this.createChecksum(backupPath);

            backup.completed = Date.now();
            backup.duration = backup.completed - backup.started;
            backup.status = 'completed';
            backup.path = backupPath;

            this.backups.push(backup);
            await this.saveBackupHistory();

            console.log(`✓ Backup completed: ${backup.size}, ${backup.files} files, ${(backup.duration/1000).toFixed(2)}s`);

            // Replicate if enabled
            if (this.config.replication.enabled) {
                await this.replicateBackup(backup);
            }

            // Cleanup old backups
            await this.cleanupOldBackups();

            return backup;
        } catch (error) {
            backup.status = 'failed';
            backup.error = error.message;
            backup.completed = Date.now();
            console.error('✗ Backup failed:', error.message);
            throw error;
        } finally {
            this.runningBackup = false;
        }
    }

    async backupServers(backupPath) {
        const serversPath = process.env.HOME + '/server/instances';
        const targetPath = path.join(backupPath, 'servers');
        
        try {
            await execAsync(`cp -r ${serversPath} ${targetPath}`);
            console.log('  ✓ Servers backed up');
        } catch (error) {
            console.log('  • No servers to backup');
        }
    }

    async backupConfig(backupPath) {
        const configPath = process.env.HOME + '/server/config';
        const targetPath = path.join(backupPath, 'config');
        
        await execAsync(`cp -r ${configPath} ${targetPath}`);
        console.log('  ✓ Configuration backed up');
    }

    async backupDatabase(backupPath) {
        // Backup any databases
        const dbPath = process.env.HOME + '/server/data';
        const targetPath = path.join(backupPath, 'database');
        
        try {
            await execAsync(`cp -r ${dbPath} ${targetPath}`);
            console.log('  ✓ Database backed up');
        } catch (error) {
            console.log('  • No database to backup');
        }
    }

    async backupState(backupPath) {
        const statePath = process.env.HOME + '/server/state';
        const targetPath = path.join(backupPath, 'state');
        
        try {
            await execAsync(`cp -r ${statePath} ${targetPath}`);
            console.log('  ✓ State backed up');
        } catch (error) {
            console.log('  • No state to backup');
        }
    }

    async compressBackup(backupPath) {
        const archivePath = `${backupPath}.tar.gz`;
        await execAsync(`tar -czf ${archivePath} -C ${path.dirname(backupPath)} ${path.basename(backupPath)}`);
        await execAsync(`rm -rf ${backupPath}`);
        console.log('  ✓ Backup compressed');
        return archivePath;
    }

    async encryptBackup(backupPath) {
        const key = this.getEncryptionKey();
        const encPath = `${backupPath}.enc`;
        
        // Simple encryption (in production, use proper encryption library)
        await execAsync(`openssl enc -aes-256-cbc -salt -in ${backupPath} -out ${encPath} -k ${key}`);
        await execAsync(`rm -f ${backupPath}`);
        
        console.log('  ✓ Backup encrypted');
        return encPath;
    }

    async createChecksum(backupPath) {
        const { stdout } = await execAsync(`find ${backupPath} -type f -exec sha256sum {} + | sha256sum | cut -d' ' -f1`);
        return stdout.trim();
    }

    getEncryptionKey() {
        // In production, use proper key management
        return process.env.BACKUP_ENCRYPTION_KEY || 'default-key-change-me';
    }

    async restoreBackup(backupId, options = {}) {
        const backup = this.backups.find(b => b.id === backupId);
        if (!backup) {
            throw new Error('Backup not found');
        }

        if (backup.status !== 'completed') {
            throw new Error('Cannot restore incomplete backup');
        }

        console.log(`🔄 Restoring backup ${backupId}...`);

        try {
            let restorePath = backup.path;

            // Decrypt if needed
            if (backup.encrypted) {
                restorePath = await this.decryptBackup(restorePath);
            }

            // Decompress if needed
            if (backup.compressed) {
                restorePath = await this.decompressBackup(restorePath);
            }

            // Verify checksum
            const currentChecksum = await this.createChecksum(restorePath);
            if (currentChecksum !== backup.checksum) {
                throw new Error('Backup integrity check failed');
            }

            // Restore data
            if (options.servers !== false) {
                await this.restoreServers(restorePath);
            }

            if (options.config !== false) {
                await this.restoreConfig(restorePath);
            }

            if (options.database !== false) {
                await this.restoreDatabase(restorePath);
            }

            if (options.state !== false) {
                await this.restoreState(restorePath);
            }

            console.log('✓ Restore completed');
            return { success: true, backupId };
        } catch (error) {
            console.error('✗ Restore failed:', error.message);
            throw error;
        }
    }

    async restoreServers(restorePath) {
        const sourcePath = path.join(restorePath, 'servers');
        const targetPath = process.env.HOME + '/server/instances';
        
        await execAsync(`rm -rf ${targetPath} && cp -r ${sourcePath} ${targetPath}`);
        console.log('  ✓ Servers restored');
    }

    async restoreConfig(restorePath) {
        const sourcePath = path.join(restorePath, 'config');
        const targetPath = process.env.HOME + '/server/config';
        
        await execAsync(`cp -r ${sourcePath}/* ${targetPath}/`);
        console.log('  ✓ Configuration restored');
    }

    async restoreDatabase(restorePath) {
        const sourcePath = path.join(restorePath, 'database');
        const targetPath = process.env.HOME + '/server/data';
        
        try {
            await execAsync(`cp -r ${sourcePath} ${targetPath}`);
            console.log('  ✓ Database restored');
        } catch (error) {
            console.log('  • No database to restore');
        }
    }

    async restoreState(restorePath) {
        const sourcePath = path.join(restorePath, 'state');
        const targetPath = process.env.HOME + '/server/state';
        
        await execAsync(`cp -r ${sourcePath} ${targetPath}`);
        console.log('  ✓ State restored');
    }

    async replicateBackup(backup) {
        for (const target of this.config.replication.targets) {
            try {
                console.log(`  📤 Replicating to ${target.name}...`);
                
                if (target.type === 'ssh') {
                    await this.replicateToSSH(backup, target);
                } else if (target.type === 's3') {
                    await this.replicateToS3(backup, target);
                }
                
                console.log(`  ✓ Replicated to ${target.name}`);
            } catch (error) {
                console.error(`  ✗ Replication to ${target.name} failed:`, error.message);
            }
        }
    }

    async replicateToSSH(backup, target) {
        const { host, user, path: remotePath } = target;
        await execAsync(`scp -r ${backup.path} ${user}@${host}:${remotePath}/`);
    }

    scheduleBackups() {
        // Schedule full backup (daily at 2 AM)
        setInterval(async () => {
            const hour = new Date().getHours();
            if (hour === 2) {
                await this.createBackup('full');
            }
        }, 3600000); // Check every hour

        // Schedule incremental backup (every 6 hours)
        setInterval(async () => {
            await this.createBackup('incremental');
        }, 21600000); // 6 hours

        console.log('📅 Backup schedules configured');
    }

    async cleanupOldBackups() {
        const now = Date.now();
        const dayMs = 86400000;

        for (const backup of this.backups) {
            const age = (now - backup.completed) / dayMs;
            
            let shouldDelete = false;

            if (backup.type === 'full' && age > this.config.retention.daily * 7) {
                shouldDelete = true;
            } else if (backup.type === 'incremental' && age > this.config.retention.daily) {
                shouldDelete = true;
            } else if (backup.type === 'snapshot' && age > 1) {
                shouldDelete = true;
            }

            if (shouldDelete) {
                try {
                    await execAsync(`rm -rf ${backup.path}*`);
                    backup.status = 'deleted';
                    console.log(`🗑 Cleaned up old backup: ${backup.id}`);
                } catch (error) {
                    console.error(`Failed to delete backup ${backup.id}:`, error.message);
                }
            }
        }

        await this.saveBackupHistory();
    }

    async loadBackupHistory() {
        try {
            const historyPath = path.join(this.config.backupDir, 'history.json');
            const data = await fs.readFile(historyPath, 'utf8');
            this.backups = JSON.parse(data);
        } catch (error) {
            this.backups = [];
        }
    }

    async saveBackupHistory() {
        const historyPath = path.join(this.config.backupDir, 'history.json');
        await fs.writeFile(historyPath, JSON.stringify(this.backups, null, 2));
    }

    async createDefaultConfig() {
        const configPath = process.env.HOME + '/server/config/backup.json';
        await fs.mkdir(path.dirname(configPath), { recursive: true });
        await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));
    }

    getBackups(filter = {}) {
        let backups = [...this.backups];

        if (filter.type) {
            backups = backups.filter(b => b.type === filter.type);
        }

        if (filter.status) {
            backups = backups.filter(b => b.status === filter.status);
        }

        return backups.sort((a, b) => b.started - a.started);
    }

    getStatus() {
        const recent = this.backups.filter(b => 
            b.completed && b.completed > Date.now() - 86400000
        );

        return {
            totalBackups: this.backups.length,
            recentBackups: recent.length,
            lastBackup: this.backups[this.backups.length - 1],
            nextScheduled: this.getNextScheduledBackup(),
            storageUsed: this.calculateStorageUsed(),
            status: recent.length > 0 ? 'healthy' : 'warning'
        };
    }

    calculateStorageUsed() {
        // Sum up all backup sizes
        return this.backups
            .filter(b => b.status === 'completed')
            .reduce((sum, b) => sum + (parseInt(b.size) || 0), 0);
    }

    getNextScheduledBackup() {
        // Calculate next full backup (2 AM)
        const now = new Date();
        const next = new Date();
        next.setHours(2, 0, 0, 0);
        
        if (next <= now) {
            next.setDate(next.getDate() + 1);
        }

        return next.toISOString();
    }
}

module.exports = BackupManager;
