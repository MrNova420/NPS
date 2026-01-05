/**
 * NPS Auto-Recovery System - Automatic Server Recovery
 * Automatically restarts failed servers and handles cascading failures
 */

const EventEmitter = require('events');

class AutoRecoverySystem extends EventEmitter {
    constructor(healthCheckSystem, serverManager) {
        super();
        this.healthCheck = healthCheckSystem;
        this.serverManager = serverManager;
        
        this.config = {
            enabled: true,
            maxRecoveryAttempts: 3,
            recoveryDelay: 30000, // 30 seconds between attempts
            backoffMultiplier: 2, // Exponential backoff
            cooldownPeriod: 300000, // 5 minutes before resetting attempt counter
        };

        this.recoveryState = new Map(); // serverId -> recovery state
        
        // Listen to health check events
        this.setupEventHandlers();
    }

    async initialize() {
        console.log('🔧 Auto-Recovery System initializing...');
        console.log(`   Max attempts: ${this.config.maxRecoveryAttempts}`);
        console.log(`   Initial delay: ${this.config.recoveryDelay}ms`);
        console.log('🔧 Auto-Recovery System active');
    }

    setupEventHandlers() {
        // Listen for unhealthy server events from health check system
        this.healthCheck.on('server:unhealthy', async (event) => {
            if (this.config.enabled) {
                await this.handleUnhealthyServer(event);
            }
        });
    }

    /**
     * Handle an unhealthy server
     */
    async handleUnhealthyServer(event) {
        const { serverId, name, failures, error } = event;
        
        console.log(`🚨 Server ${name} (${serverId}) is unhealthy after ${failures} failures`);
        console.log(`   Error: ${error || 'unknown'}`);

        // Get or create recovery state
        let state = this.recoveryState.get(serverId);
        
        if (!state) {
            state = {
                serverId,
                serverName: name,
                attempts: 0,
                lastAttempt: null,
                failures: [],
                recoveries: [],
                status: 'monitoring'
            };
            this.recoveryState.set(serverId, state);
        }

        // Check if we're in cooldown period
        if (state.lastAttempt) {
            const timeSinceLastAttempt = Date.now() - state.lastAttempt;
            if (timeSinceLastAttempt < this.config.cooldownPeriod) {
                // Still in cooldown, check if we've exceeded max attempts
                if (state.attempts >= this.config.maxRecoveryAttempts) {
                    console.error(`❌ Server ${name} has exceeded max recovery attempts`);
                    state.status = 'failed';
                    this.emit('recovery:failed', { serverId, name, attempts: state.attempts });
                    return;
                }
            } else {
                // Cooldown period passed, reset attempt counter
                console.log(`✅ Cooldown period passed for ${name}, resetting attempt counter`);
                state.attempts = 0;
                state.status = 'monitoring';
            }
        }

        // Record failure
        state.failures.push({
            timestamp: Date.now(),
            error: error || 'unknown'
        });

        // Attempt recovery
        await this.attemptRecovery(serverId, state);
    }

    /**
     * Attempt to recover a server
     */
    async attemptRecovery(serverId, state) {
        state.attempts++;
        state.lastAttempt = Date.now();
        state.status = 'recovering';

        // Calculate delay with exponential backoff
        const delay = this.config.recoveryDelay * Math.pow(
            this.config.backoffMultiplier, 
            state.attempts - 1
        );

        console.log(`🔄 Attempting recovery ${state.attempts}/${this.config.maxRecoveryAttempts} for ${state.serverName}`);
        console.log(`   Waiting ${Math.round(delay / 1000)}s before recovery...`);

        this.emit('recovery:started', { 
            serverId, 
            name: state.serverName, 
            attempt: state.attempts,
            delay
        });

        // Wait before attempting recovery
        await new Promise(resolve => setTimeout(resolve, delay));

        try {
            // Attempt to restart the server
            console.log(`🔄 Restarting ${state.serverName}...`);
            
            // Stop the server first
            try {
                await this.serverManager.stopServer(serverId);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
            } catch (stopError) {
                console.warn(`Warning: Failed to stop server cleanly: ${stopError.message}`);
            }

            // Start the server
            await this.serverManager.startServer(serverId);

            // Wait for server to stabilize
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Force a health check
            const healthStatus = await this.healthCheck.forceCheck(serverId);

            if (healthStatus && healthStatus.status === 'healthy') {
                console.log(`✅ Successfully recovered ${state.serverName}`);
                
                state.recoveries.push({
                    timestamp: Date.now(),
                    attempt: state.attempts,
                    successful: true
                });
                
                state.status = 'recovered';
                
                this.emit('recovery:success', { 
                    serverId, 
                    name: state.serverName, 
                    attempts: state.attempts 
                });

                // Keep state for cooldown tracking but mark as recovered
                return true;
            } else {
                throw new Error('Server did not become healthy after restart');
            }
        } catch (error) {
            console.error(`❌ Recovery attempt ${state.attempts} failed for ${state.serverName}: ${error.message}`);
            
            state.recoveries.push({
                timestamp: Date.now(),
                attempt: state.attempts,
                successful: false,
                error: error.message
            });

            this.emit('recovery:attempt-failed', { 
                serverId, 
                name: state.serverName, 
                attempt: state.attempts,
                error: error.message
            });

            // Check if we should try again
            if (state.attempts < this.config.maxRecoveryAttempts) {
                console.log(`Will retry recovery for ${state.serverName}`);
                state.status = 'monitoring';
            } else {
                console.error(`❌ Max recovery attempts reached for ${state.serverName}`);
                state.status = 'failed';
                this.emit('recovery:failed', { 
                    serverId, 
                    name: state.serverName, 
                    attempts: state.attempts 
                });
            }

            return false;
        }
    }

    /**
     * Get recovery state for a server
     */
    getState(serverId) {
        return this.recoveryState.get(serverId) || null;
    }

    /**
     * Get all recovery states
     */
    getAllStates() {
        return Array.from(this.recoveryState.values());
    }

    /**
     * Reset recovery state for a server
     */
    resetState(serverId) {
        this.recoveryState.delete(serverId);
        console.log(`Reset recovery state for server ${serverId}`);
    }

    /**
     * Get recovery statistics
     */
    getStatistics() {
        const states = Array.from(this.recoveryState.values());
        
        const stats = {
            total: states.length,
            monitoring: states.filter(s => s.status === 'monitoring').length,
            recovering: states.filter(s => s.status === 'recovering').length,
            recovered: states.filter(s => s.status === 'recovered').length,
            failed: states.filter(s => s.status === 'failed').length,
            totalAttempts: states.reduce((sum, s) => sum + s.attempts, 0),
            totalRecoveries: states.reduce((sum, s) => sum + s.recoveries.filter(r => r.successful).length, 0),
            successRate: 0
        };

        const totalRecoveryAttempts = states.reduce((sum, s) => sum + s.recoveries.length, 0);
        if (totalRecoveryAttempts > 0) {
            stats.successRate = Math.round((stats.totalRecoveries / totalRecoveryAttempts) * 100);
        }

        return stats;
    }

    /**
     * Get recovery report for a server
     */
    getReport(serverId) {
        const state = this.recoveryState.get(serverId);
        if (!state) {
            return { message: 'No recovery state found for this server' };
        }

        return {
            server: {
                id: state.serverId,
                name: state.serverName
            },
            status: state.status,
            attempts: {
                current: state.attempts,
                max: this.config.maxRecoveryAttempts
            },
            timing: {
                lastAttempt: state.lastAttempt,
                cooldownEndsAt: state.lastAttempt 
                    ? state.lastAttempt + this.config.cooldownPeriod 
                    : null,
                inCooldown: state.lastAttempt 
                    ? (Date.now() - state.lastAttempt) < this.config.cooldownPeriod
                    : false
            },
            history: {
                failures: state.failures.slice(-10), // Last 10 failures
                recoveries: state.recoveries.slice(-10) // Last 10 recovery attempts
            }
        };
    }

    /**
     * Enable/disable auto-recovery
     */
    setEnabled(enabled) {
        this.config.enabled = enabled;
        console.log(`Auto-recovery ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        console.log('Auto-recovery configuration updated:', this.config);
    }

    /**
     * Manual recovery trigger
     */
    async triggerRecovery(serverId) {
        const server = this.serverManager.getServerById(serverId);
        if (!server) {
            throw new Error('Server not found');
        }

        let state = this.recoveryState.get(serverId);
        if (!state) {
            state = {
                serverId,
                serverName: server.name,
                attempts: 0,
                lastAttempt: null,
                failures: [],
                recoveries: [],
                status: 'monitoring'
            };
            this.recoveryState.set(serverId, state);
        }

        console.log(`Manual recovery triggered for ${server.name}`);
        return await this.attemptRecovery(serverId, state);
    }
}

module.exports = AutoRecoverySystem;
