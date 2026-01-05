/**
 * NPS Cleanup & Maintenance System
 * Manages disk space, cleans logs, removes unused files, optimizes storage
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const fs = require('fs').promises;
const path = require('path');

class CleanupSystem {
    constructor() {
        this.basePath = path.join(process.env.HOME, 'server');
        this.config = {
            logRetentionDays: 7,
            backupRetentionDays: 30,
            tempFileAgeDays: 1,
            minFreeSpaceGB: 2,
            autoCleanup: true
        };
    }

    async initialize() {
        console.log('🧹 Cleanup System initializing...');
        
        // Setup automatic cleanup if enabled
        if (this.config.autoCleanup) {
            this.startAutoCleanup();
        }
        
        console.log('🧹 Cleanup System ready');
    }

    /**
     * Start automatic cleanup (daily)
     */
    startAutoCleanup() {
        // Run cleanup every 24 hours
        setInterval(async () => {
            console.log('🧹 Running automatic cleanup...');
            await this.performRoutineCleanup();
        }, 24 * 60 * 60 * 1000);
    }

    /**
     * Perform routine cleanup
     */
    async performRoutineCleanup() {
        const results = {
            timestamp: new Date().toISOString(),
            actions: [],
            spaceFreed: 0,
            errors: []
        };

        try {
            // Clean old logs
            const logsResult = await this.cleanOldLogs();
            results.actions.push(logsResult);
            results.spaceFreed += logsResult.spaceFreed || 0;

            // Clean old backups
            const backupsResult = await this.cleanOldBackups();
            results.actions.push(backupsResult);
            results.spaceFreed += backupsResult.spaceFreed || 0;

            // Clean temp files
            const tempResult = await this.cleanTempFiles();
            results.actions.push(tempResult);
            results.spaceFreed += tempResult.spaceFreed || 0;

            // Clean npm cache
            const npmResult = await this.cleanNpmCache();
            results.actions.push(npmResult);
            results.spaceFreed += npmResult.spaceFreed || 0;

            console.log(`✅ Cleanup complete. Freed ${this.formatBytes(results.spaceFreed)}`);
        } catch (error) {
            results.errors.push(error.message);
            console.error('Cleanup error:', error.message);
        }

        return results;
    }

    /**
     * Clean old log files
     */
    async cleanOldLogs() {
        const logsPath = path.join(this.basePath, 'instances');
        const cutoffDate = Date.now() - (this.config.logRetentionDays * 24 * 60 * 60 * 1000);
        
        let filesRemoved = 0;
        let spaceFreed = 0;

        try {
            const instances = await fs.readdir(logsPath);
            
            for (const instance of instances) {
                const logDir = path.join(logsPath, instance, 'logs');
                
                try {
                    const files = await fs.readdir(logDir);
                    
                    for (const file of files) {
                        const filePath = path.join(logDir, file);
                        const stats = await fs.stat(filePath);
                        
                        // Remove if older than retention period and ends with .log
                        if (stats.mtime.getTime() < cutoffDate && file.endsWith('.log')) {
                            spaceFreed += stats.size;
                            await fs.unlink(filePath);
                            filesRemoved++;
                        }
                    }
                } catch (error) {
                    // Directory might not exist, skip
                }
            }

            return {
                action: 'clean_old_logs',
                filesRemoved,
                spaceFreed,
                success: true
            };
        } catch (error) {
            return {
                action: 'clean_old_logs',
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Clean old backup files
     */
    async cleanOldBackups() {
        const backupsPath = path.join(this.basePath, 'backups');
        const cutoffDate = Date.now() - (this.config.backupRetentionDays * 24 * 60 * 60 * 1000);
        
        let filesRemoved = 0;
        let spaceFreed = 0;

        try {
            const files = await fs.readdir(backupsPath);
            
            for (const file of files) {
                const filePath = path.join(backupsPath, file);
                const stats = await fs.stat(filePath);
                
                if (stats.mtime.getTime() < cutoffDate) {
                    spaceFreed += stats.size;
                    await fs.unlink(filePath);
                    filesRemoved++;
                }
            }

            return {
                action: 'clean_old_backups',
                filesRemoved,
                spaceFreed,
                success: true
            };
        } catch (error) {
            return {
                action: 'clean_old_backups',
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Clean temporary files
     */
    async cleanTempFiles() {
        const tempPaths = [
            path.join(this.basePath, 'temp'),
            '/tmp/nps-*',
            path.join(process.env.HOME, '.cache/nps')
        ];
        
        let filesRemoved = 0;
        let spaceFreed = 0;

        for (const tempPath of tempPaths) {
            try {
                if (tempPath.includes('*')) {
                    // Use shell expansion
                    const { stdout } = await execAsync(`du -sb ${tempPath} 2>/dev/null || echo "0"`);
                    const size = parseInt(stdout.split('\t')[0]) || 0;
                    
                    await execAsync(`rm -rf ${tempPath} 2>/dev/null || true`);
                    spaceFreed += size;
                    filesRemoved++;
                } else {
                    try {
                        const stats = await fs.stat(tempPath);
                        const { stdout } = await execAsync(`du -sb ${tempPath}`);
                        const size = parseInt(stdout.split('\t')[0]) || 0;
                        
                        await fs.rm(tempPath, { recursive: true, force: true });
                        spaceFreed += size;
                        filesRemoved++;
                    } catch {
                        // Path doesn't exist, skip
                    }
                }
            } catch (error) {
                // Ignore errors for temp files
            }
        }

        return {
            action: 'clean_temp_files',
            filesRemoved,
            spaceFreed,
            success: true
        };
    }

    /**
     * Clean npm cache
     */
    async cleanNpmCache() {
        try {
            const { stdout: beforeSize } = await execAsync('du -sb ~/.npm 2>/dev/null || echo "0"');
            const before = parseInt(beforeSize.split('\t')[0]) || 0;
            
            await execAsync('npm cache clean --force 2>/dev/null || true');
            
            const { stdout: afterSize } = await execAsync('du -sb ~/.npm 2>/dev/null || echo "0"');
            const after = parseInt(afterSize.split('\t')[0]) || 0;
            
            return {
                action: 'clean_npm_cache',
                spaceFreed: Math.max(0, before - after),
                success: true
            };
        } catch (error) {
            return {
                action: 'clean_npm_cache',
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Analyze disk usage
     */
    async analyzeDiskUsage() {
        const analysis = {
            total: 0,
            used: 0,
            available: 0,
            breakdown: {}
        };

        try {
            // Get overall disk usage
            const { stdout: dfOutput } = await execAsync(`df -h ${process.env.HOME} | tail -1`);
            const parts = dfOutput.trim().split(/\s+/);
            
            analysis.total = parts[1];
            analysis.used = parts[2];
            analysis.available = parts[3];
            analysis.percentUsed = parseInt(parts[4]);

            // Analyze NPS directories
            const directories = [
                'instances',
                'logs',
                'backups',
                'state',
                'config',
                'temp'
            ];

            for (const dir of directories) {
                const dirPath = path.join(this.basePath, dir);
                try {
                    const { stdout } = await execAsync(`du -sh ${dirPath} 2>/dev/null || echo "0\t${dirPath}"`);
                    const size = stdout.split('\t')[0].trim();
                    analysis.breakdown[dir] = size;
                } catch {
                    analysis.breakdown[dir] = '0B';
                }
            }

            // Find largest directories
            const { stdout: largestDirs } = await execAsync(`du -sh ${this.basePath}/* 2>/dev/null | sort -hr | head -10`);
            analysis.largestDirectories = largestDirs.trim().split('\n').map(line => {
                const [size, path] = line.split('\t');
                return { size, path };
            });

        } catch (error) {
            console.error('Failed to analyze disk usage:', error.message);
        }

        return analysis;
    }

    /**
     * Find large files
     */
    async findLargeFiles(minSizeMB = 100, searchPath = null) {
        const path = searchPath || this.basePath;
        
        try {
            const { stdout } = await execAsync(
                `find ${path} -type f -size +${minSizeMB}M -exec ls -lh {} \\; 2>/dev/null | awk '{print $5, $9}' | sort -hr`
            );
            
            const files = stdout.trim().split('\n')
                .filter(line => line.trim())
                .map(line => {
                    const [size, ...pathParts] = line.split(' ');
                    return {
                        size,
                        path: pathParts.join(' ')
                    };
                });

            return files;
        } catch (error) {
            return [];
        }
    }

    /**
     * Clean specific server instance
     */
    async cleanServerInstance(serverId) {
        const instancePath = path.join(this.basePath, 'instances', serverId);
        let spaceFreed = 0;

        try {
            // Clean logs
            const logsPath = path.join(instancePath, 'logs');
            const { stdout: logSize } = await execAsync(`du -sb ${logsPath} 2>/dev/null || echo "0"`);
            spaceFreed += parseInt(logSize.split('\t')[0]) || 0;
            
            await execAsync(`find ${logsPath} -type f -name "*.log" -delete 2>/dev/null || true`);

            // Clean temp files
            const tempPath = path.join(instancePath, 'temp');
            const { stdout: tempSize } = await execAsync(`du -sb ${tempPath} 2>/dev/null || echo "0"`);
            spaceFreed += parseInt(tempSize.split('\t')[0]) || 0;
            
            await fs.rm(tempPath, { recursive: true, force: true });
            await fs.mkdir(tempPath, { recursive: true });

            return {
                success: true,
                spaceFreed,
                instancePath
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Vacuum/optimize databases
     */
    async optimizeDatabases(serverId = null) {
        const results = [];

        try {
            const instancesPath = path.join(this.basePath, 'instances');
            const instances = serverId ? [serverId] : await fs.readdir(instancesPath);

            for (const instance of instances) {
                const instancePath = path.join(instancesPath, instance);
                
                // Check for PostgreSQL
                const pgDataPath = path.join(instancePath, 'data', 'postgresql.conf');
                try {
                    await fs.access(pgDataPath);
                    // PostgreSQL found, run VACUUM
                    const result = await execAsync(`psql -U postgres -c "VACUUM ANALYZE;" 2>&1`).catch(e => ({ stdout: e.message }));
                    results.push({
                        instance,
                        type: 'postgresql',
                        action: 'VACUUM ANALYZE',
                        result: result.stdout
                    });
                } catch {
                    // Not a PostgreSQL instance
                }

                // Check for SQLite databases
                try {
                    const { stdout: sqliteFiles } = await execAsync(`find ${instancePath} -name "*.db" -o -name "*.sqlite" 2>/dev/null`);
                    const files = sqliteFiles.trim().split('\n').filter(f => f);
                    
                    for (const dbFile of files) {
                        const result = await execAsync(`sqlite3 ${dbFile} "VACUUM;" 2>&1`).catch(e => ({ stdout: e.message }));
                        results.push({
                            instance,
                            type: 'sqlite',
                            file: dbFile,
                            action: 'VACUUM',
                            result: result.stdout
                        });
                    }
                } catch {
                    // No SQLite databases
                }
            }
        } catch (error) {
            console.error('Database optimization error:', error.message);
        }

        return results;
    }

    /**
     * Compress old log files
     */
    async compressLogs(serverId = null) {
        const instancesPath = path.join(this.basePath, 'instances');
        const instances = serverId ? [serverId] : await fs.readdir(instancesPath);
        
        let filesCompressed = 0;
        let spaceFreed = 0;

        for (const instance of instances) {
            const logsPath = path.join(instancesPath, instance, 'logs');
            
            try {
                const files = await fs.readdir(logsPath);
                
                for (const file of files) {
                    // Compress .log files that are older than 1 day and not already compressed
                    if (file.endsWith('.log') && !file.endsWith('.gz')) {
                        const filePath = path.join(logsPath, file);
                        const stats = await fs.stat(filePath);
                        
                        const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
                        if (ageHours > 24) {
                            const sizeBefore = stats.size;
                            await execAsync(`gzip ${filePath}`);
                            
                            const { stdout } = await execAsync(`du -b ${filePath}.gz`);
                            const sizeAfter = parseInt(stdout.split('\t')[0]);
                            
                            spaceFreed += sizeBefore - sizeAfter;
                            filesCompressed++;
                        }
                    }
                }
            } catch (error) {
                // Skip if logs directory doesn't exist
            }
        }

        return {
            filesCompressed,
            spaceFreed,
            success: true
        };
    }

    /**
     * Get cleanup recommendations
     */
    async getRecommendations() {
        const recommendations = [];
        
        // Check disk space
        const diskUsage = await this.analyzeDiskUsage();
        if (diskUsage.percentUsed > 90) {
            recommendations.push({
                priority: 'high',
                type: 'disk_space',
                message: 'Disk usage is above 90%',
                action: 'Consider cleaning old logs, backups, or removing unused servers'
            });
        } else if (diskUsage.percentUsed > 80) {
            recommendations.push({
                priority: 'medium',
                type: 'disk_space',
                message: 'Disk usage is above 80%',
                action: 'Monitor disk usage and plan for cleanup'
            });
        }

        // Check for old logs
        const logsPath = path.join(this.basePath, 'instances');
        try {
            const { stdout } = await execAsync(`find ${logsPath} -name "*.log" -mtime +${this.config.logRetentionDays} | wc -l`);
            const oldLogs = parseInt(stdout.trim());
            
            if (oldLogs > 50) {
                recommendations.push({
                    priority: 'medium',
                    type: 'old_logs',
                    message: `Found ${oldLogs} old log files`,
                    action: 'Run cleanup to remove old logs'
                });
            }
        } catch {
            // Ignore
        }

        // Check for large files
        const largeFiles = await this.findLargeFiles(100);
        if (largeFiles.length > 0) {
            recommendations.push({
                priority: 'low',
                type: 'large_files',
                message: `Found ${largeFiles.length} files larger than 100MB`,
                action: 'Review and remove unnecessary large files',
                files: largeFiles.slice(0, 5)
            });
        }

        return recommendations;
    }

    /**
     * Format bytes to human-readable
     */
    formatBytes(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Get cleanup report
     */
    async getCleanupReport() {
        const [diskUsage, recommendations, largeFiles] = await Promise.all([
            this.analyzeDiskUsage(),
            this.getRecommendations(),
            this.findLargeFiles(50)
        ]);

        return {
            timestamp: new Date().toISOString(),
            diskUsage,
            recommendations,
            largeFiles: largeFiles.slice(0, 10),
            config: this.config
        };
    }
}

module.exports = CleanupSystem;
