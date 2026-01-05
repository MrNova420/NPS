/**
 * NPS Process Manager - Production-Grade Process Orchestration
 * Manages server processes with health checks, auto-recovery, and resource limits
 * Similar to PM2 but optimized for Android/Termux environment
 */

const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class ProcessManager extends EventEmitter {
    constructor() {
        super();
        this.processes = new Map();
        this.stateFile = path.join(process.env.HOME, 'server/state/processes.json');
        this.healthCheckInterval = 30000; // 30 seconds
        this.restartDelay = 5000; // 5 seconds
        this.maxRestarts = 10;
        this.restartWindow = 60000; // 1 minute
    }

    async initialize() {
        console.log('🔧 Process Manager initializing...');
        
        // Ensure state directory exists
        await fs.mkdir(path.dirname(this.stateFile), { recursive: true });
        
        // Load existing processes
        await this.loadProcesses();
        
        // Start health checks
        this.startHealthChecks();
        
        // Setup graceful shutdown
        this.setupShutdownHandlers();
        
        console.log('🔧 Process Manager initialized');
    }

    async loadProcesses() {
        try {
            const data = await fs.readFile(this.stateFile, 'utf8');
            const saved = JSON.parse(data);
            
            for (const proc of saved) {
                // Verify process is still running
                const isRunning = await this.isProcessRunning(proc.pid);
                if (isRunning) {
                    this.processes.set(proc.id, proc);
                    console.log(`Restored process: ${proc.name} (PID: ${proc.pid})`);
                } else {
                    console.log(`Process ${proc.name} not running, will restart if enabled`);
                    if (proc.autoRestart) {
                        await this.restartProcess(proc.id);
                    }
                }
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Failed to load processes:', error.message);
            }
        }
    }

    async saveProcesses() {
        try {
            const data = Array.from(this.processes.values()).map(p => ({
                id: p.id,
                name: p.name,
                pid: p.pid,
                command: p.command,
                cwd: p.cwd,
                env: p.env,
                port: p.port,
                autoRestart: p.autoRestart,
                maxRestarts: p.maxRestarts,
                status: p.status,
                resources: p.resources
            }));
            
            await fs.writeFile(this.stateFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Failed to save processes:', error.message);
        }
    }

    /**
     * Start a new process
     */
    async start(config) {
        const {
            id,
            name,
            command,
            args = [],
            cwd = process.cwd(),
            env = {},
            port,
            autoRestart = true,
            maxMemory, // MB
            maxCpu, // Percentage
            logFile
        } = config;

        if (this.processes.has(id)) {
            throw new Error(`Process ${id} already exists`);
        }

        // Create log directory
        const logDir = path.join(process.env.HOME, 'server/logs', id);
        await fs.mkdir(logDir, { recursive: true });

        const outLog = path.join(logDir, 'out.log');
        const errLog = path.join(logDir, 'error.log');

        // Open log file streams
        const outStream = require('fs').createWriteStream(outLog, { flags: 'a' });
        const errStream = require('fs').createWriteStream(errLog, { flags: 'a' });

        // Spawn process
        const proc = spawn(command, args, {
            cwd,
            env: { ...process.env, ...env },
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        // Pipe output to logs
        proc.stdout.pipe(outStream);
        proc.stderr.pipe(errStream);

        // Detach from parent
        proc.unref();

        const processInfo = {
            id,
            name,
            pid: proc.pid,
            command,
            args,
            cwd,
            env,
            port,
            autoRestart,
            maxRestarts: this.maxRestarts,
            status: 'running',
            startTime: Date.now(),
            restarts: 0,
            restartHistory: [],
            resources: {
                maxMemory,
                maxCpu,
                currentMemory: 0,
                currentCpu: 0
            },
            logs: {
                out: outLog,
                error: errLog
            },
            health: {
                lastCheck: Date.now(),
                status: 'healthy',
                consecutiveFailures: 0
            }
        };

        this.processes.set(id, processInfo);
        await this.saveProcesses();

        // Handle process exit
        proc.on('exit', (code, signal) => {
            this.handleProcessExit(id, code, signal);
        });

        this.emit('process:start', processInfo);
        console.log(`Started process: ${name} (PID: ${proc.pid})`);

        return processInfo;
    }

    /**
     * Stop a process
     */
    async stop(id, signal = 'SIGTERM') {
        const proc = this.processes.get(id);
        if (!proc) {
            throw new Error(`Process ${id} not found`);
        }

        try {
            // Try graceful shutdown first
            process.kill(proc.pid, signal);
            
            // Wait for process to stop
            await this.waitForProcessStop(proc.pid, 10000);
            
            proc.status = 'stopped';
            proc.autoRestart = false; // Disable auto-restart on manual stop
            await this.saveProcesses();
            
            this.emit('process:stop', proc);
            console.log(`Stopped process: ${proc.name} (PID: ${proc.pid})`);
            
            return true;
        } catch (error) {
            // Force kill if graceful shutdown fails
            console.warn(`Force killing process ${proc.name}`);
            try {
                process.kill(proc.pid, 'SIGKILL');
                proc.status = 'killed';
                await this.saveProcesses();
                return true;
            } catch (killError) {
                throw new Error(`Failed to stop process: ${error.message}`);
            }
        }
    }

    /**
     * Restart a process
     */
    async restart(id) {
        const proc = this.processes.get(id);
        if (!proc) {
            throw new Error(`Process ${id} not found`);
        }

        const config = {
            id: proc.id,
            name: proc.name,
            command: proc.command,
            args: proc.args,
            cwd: proc.cwd,
            env: proc.env,
            port: proc.port,
            autoRestart: proc.autoRestart,
            maxMemory: proc.resources.maxMemory,
            maxCpu: proc.resources.maxCpu
        };

        await this.stop(id);
        await new Promise(resolve => setTimeout(resolve, this.restartDelay));
        return await this.start(config);
    }

    /**
     * Delete a process completely
     */
    async delete(id) {
        const proc = this.processes.get(id);
        if (!proc) {
            throw new Error(`Process ${id} not found`);
        }

        // Stop if running
        if (proc.status === 'running') {
            await this.stop(id);
        }

        // Remove from map
        this.processes.delete(id);
        await this.saveProcesses();

        this.emit('process:delete', { id, name: proc.name });
        console.log(`Deleted process: ${proc.name}`);
    }

    /**
     * Get process information
     */
    get(id) {
        return this.processes.get(id);
    }

    /**
     * Get all processes
     */
    list() {
        return Array.from(this.processes.values());
    }

    /**
     * Get process stats
     */
    async getStats(id) {
        const proc = this.processes.get(id);
        if (!proc || proc.status !== 'running') {
            return null;
        }

        try {
            const stats = await this.getProcessStats(proc.pid);
            proc.resources.currentMemory = stats.memory;
            proc.resources.currentCpu = stats.cpu;
            return stats;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get process statistics from system
     */
    async getProcessStats(pid) {
        return new Promise((resolve, reject) => {
            exec(`ps -p ${pid} -o %cpu,%mem,vsz,rss,etime | tail -1`, (error, stdout) => {
                if (error) {
                    reject(error);
                    return;
                }

                const parts = stdout.trim().split(/\s+/);
                if (parts.length < 5) {
                    reject(new Error('Invalid ps output'));
                    return;
                }

                resolve({
                    cpu: parseFloat(parts[0]) || 0,
                    memoryPercent: parseFloat(parts[1]) || 0,
                    memory: parseInt(parts[3]) / 1024, // Convert to MB
                    uptime: parts[4],
                    timestamp: Date.now()
                });
            });
        });
    }

    /**
     * Check if process is running
     */
    async isProcessRunning(pid) {
        try {
            process.kill(pid, 0);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Wait for process to stop
     */
    async waitForProcessStop(pid, timeout = 10000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            if (!await this.isProcessRunning(pid)) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('Process stop timeout');
    }

    /**
     * Handle process exit
     */
    async handleProcessExit(id, code, signal) {
        const proc = this.processes.get(id);
        if (!proc) return;

        console.log(`Process ${proc.name} exited with code ${code}, signal ${signal}`);

        proc.status = code === 0 ? 'exited' : 'crashed';
        proc.exitCode = code;
        proc.exitSignal = signal;

        // Record restart history
        proc.restartHistory.push({
            timestamp: Date.now(),
            exitCode: code,
            signal
        });

        // Trim old restart history
        const cutoff = Date.now() - this.restartWindow;
        proc.restartHistory = proc.restartHistory.filter(r => r.timestamp > cutoff);

        // Auto-restart if enabled and not exceeded max restarts
        if (proc.autoRestart && proc.restartHistory.length < proc.maxRestarts) {
            console.log(`Auto-restarting ${proc.name} in ${this.restartDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, this.restartDelay));
            
            try {
                await this.restartProcess(id);
            } catch (error) {
                console.error(`Failed to auto-restart ${proc.name}:`, error.message);
                proc.status = 'failed';
            }
        } else if (proc.restartHistory.length >= proc.maxRestarts) {
            console.error(`Process ${proc.name} exceeded max restarts, giving up`);
            proc.status = 'failed';
            this.emit('process:failed', proc);
        }

        await this.saveProcesses();
        this.emit('process:exit', proc);
    }

    /**
     * Restart process (internal)
     */
    async restartProcess(id) {
        const proc = this.processes.get(id);
        if (!proc) return;

        proc.restarts++;
        
        const config = {
            id: proc.id,
            name: proc.name,
            command: proc.command,
            args: proc.args,
            cwd: proc.cwd,
            env: proc.env,
            port: proc.port,
            autoRestart: proc.autoRestart,
            maxMemory: proc.resources.maxMemory,
            maxCpu: proc.resources.maxCpu
        };

        return await this.start(config);
    }

    /**
     * Start health checks
     */
    startHealthChecks() {
        setInterval(async () => {
            for (const [id, proc] of this.processes) {
                if (proc.status !== 'running') continue;

                try {
                    // Check if process is alive
                    const isAlive = await this.isProcessRunning(proc.pid);
                    
                    if (!isAlive) {
                        console.warn(`Health check failed: ${proc.name} not running`);
                        proc.health.consecutiveFailures++;
                        
                        if (proc.health.consecutiveFailures >= 3) {
                            await this.handleProcessExit(id, null, 'health-check-failed');
                        }
                        continue;
                    }

                    // Check resource limits
                    const stats = await this.getStats(id);
                    if (stats) {
                        // Check memory limit
                        if (proc.resources.maxMemory && stats.memory > proc.resources.maxMemory) {
                            console.warn(`Process ${proc.name} exceeded memory limit: ${stats.memory}MB > ${proc.resources.maxMemory}MB`);
                            this.emit('process:limit-exceeded', { id, type: 'memory', value: stats.memory });
                            
                            // Kill process if severely over limit
                            if (stats.memory > proc.resources.maxMemory * 1.5) {
                                console.error(`Killing ${proc.name} due to excessive memory usage`);
                                await this.stop(id, 'SIGKILL');
                            }
                        }

                        // Check CPU limit (average over time)
                        if (proc.resources.maxCpu && stats.cpu > proc.resources.maxCpu * 1.2) {
                            console.warn(`Process ${proc.name} exceeded CPU limit: ${stats.cpu}% > ${proc.resources.maxCpu}%`);
                            this.emit('process:limit-exceeded', { id, type: 'cpu', value: stats.cpu });
                        }
                    }

                    proc.health.lastCheck = Date.now();
                    proc.health.status = 'healthy';
                    proc.health.consecutiveFailures = 0;
                } catch (error) {
                    console.error(`Health check error for ${proc.name}:`, error.message);
                    proc.health.consecutiveFailures++;
                }
            }
        }, this.healthCheckInterval);
    }

    /**
     * Setup graceful shutdown handlers
     */
    setupShutdownHandlers() {
        const shutdown = async (signal) => {
            console.log(`\nReceived ${signal}, stopping all processes...`);
            
            const promises = Array.from(this.processes.keys()).map(id => 
                this.stop(id).catch(err => console.error(`Error stopping ${id}:`, err.message))
            );
            
            await Promise.all(promises);
            await this.saveProcesses();
            
            console.log('All processes stopped');
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }

    /**
     * Get process logs
     */
    async getLogs(id, lines = 100) {
        const proc = this.processes.get(id);
        if (!proc) {
            throw new Error(`Process ${id} not found`);
        }

        const readLastLines = async (file, n) => {
            try {
                const content = await fs.readFile(file, 'utf8');
                const allLines = content.split('\n');
                return allLines.slice(-n).join('\n');
            } catch (error) {
                return '';
            }
        };

        const [stdout, stderr] = await Promise.all([
            readLastLines(proc.logs.out, lines),
            readLastLines(proc.logs.error, lines)
        ]);

        return { stdout, stderr };
    }
}

module.exports = ProcessManager;
