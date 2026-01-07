/**
 * Automatic Server Performance Optimizer
 * Intelligently manages and optimizes all running servers for best performance
 */

const EventEmitter = require('events');

class AutoServerOptimizer extends EventEmitter {
    constructor(serverManager, perfManager, resourceAllocator) {
        super();
        this.serverManager = serverManager;
        this.perfManager = perfManager;
        this.resourceAllocator = resourceAllocator;
        
        this.optimizationInterval = null;
        this.analysisInterval = null;
        this.rebalanceInterval = null;
        
        // Performance targets
        this.targets = {
            maxCpuPerServer: 40, // % per server
            maxMemoryPerServer: 512, // MB per server
            optimalResponseTime: 200, // ms
            minAvailableResources: 20 // % buffer
        };
        
        // Server performance history
        this.serverMetrics = new Map();
        this.optimizationHistory = [];
    }

    async initialize() {
        console.log('🎯 Auto Server Optimizer initializing...');
        
        // Start optimization cycles
        this.startOptimization();
        
        console.log('✅ Auto Server Optimizer ready');
    }

    startOptimization() {
        // Quick optimization check every 10 seconds
        this.optimizationInterval = setInterval(() => {
            this.quickOptimize();
        }, 10000);

        // Deep analysis every 30 seconds
        this.analysisInterval = setInterval(() => {
            this.deepAnalysis();
        }, 30000);

        // Resource rebalancing every 60 seconds
        this.rebalanceInterval = setInterval(() => {
            this.rebalanceResources();
        }, 60000);
    }

    stopOptimization() {
        if (this.optimizationInterval) clearInterval(this.optimizationInterval);
        if (this.analysisInterval) clearInterval(this.analysisInterval);
        if (this.rebalanceInterval) clearInterval(this.rebalanceInterval);
    }

    /**
     * Quick optimization - runs every 10 seconds
     * Fixes immediate performance issues
     */
    async quickOptimize() {
        const servers = this.serverManager.getServers();
        if (servers.length === 0) return;

        for (const server of servers) {
            if (server.status !== 'running') continue;

            try {
                const metrics = await this.getServerMetrics(server);
                
                // Quick fixes for critical issues
                if (metrics.cpu > 80) {
                    await this.reduceCPUUsage(server, metrics);
                }
                
                if (metrics.memory > 90) {
                    await this.reduceMemoryUsage(server, metrics);
                }
                
                // Update metrics history
                this.updateMetricsHistory(server.id, metrics);
                
            } catch (error) {
                console.error(`Quick optimize failed for ${server.name}:`, error.message);
            }
        }
    }

    /**
     * Deep analysis - runs every 30 seconds
     * Analyzes trends and plans optimizations
     */
    async deepAnalysis() {
        const servers = this.serverManager.getServers();
        if (servers.length === 0) return;

        console.log(`📊 Analyzing ${servers.length} server(s)...`);

        const analysis = {
            timestamp: Date.now(),
            totalCpu: 0,
            totalMemory: 0,
            serverCount: servers.length,
            issues: [],
            recommendations: []
        };

        for (const server of servers) {
            if (server.status !== 'running') continue;

            try {
                const metrics = await this.getServerMetrics(server);
                const history = this.serverMetrics.get(server.id) || [];
                
                analysis.totalCpu += metrics.cpu || 0;
                analysis.totalMemory += metrics.memory || 0;

                // Analyze trends
                const trends = this.analyzeTrends(history);
                
                // Check for issues
                if (trends.cpuIncreasing && metrics.cpu > 60) {
                    analysis.issues.push({
                        server: server.name,
                        type: 'cpu_trend',
                        severity: 'warning',
                        message: `CPU usage trending up (${metrics.cpu.toFixed(1)}%)`
                    });
                }

                if (trends.memoryIncreasing && metrics.memory > 70) {
                    analysis.issues.push({
                        server: server.name,
                        type: 'memory_trend',
                        severity: 'warning',
                        message: `Memory usage trending up (${metrics.memory.toFixed(1)}%)`
                    });
                }

                // Generate recommendations
                const recs = this.generateRecommendations(server, metrics, trends);
                analysis.recommendations.push(...recs);

            } catch (error) {
                console.error(`Deep analysis failed for ${server.name}:`, error.message);
            }
        }

        // Log summary
        if (analysis.issues.length > 0) {
            console.log(`⚠️  Found ${analysis.issues.length} performance issue(s)`);
        }

        if (analysis.recommendations.length > 0) {
            console.log(`💡 ${analysis.recommendations.length} optimization(s) available`);
            // Auto-apply safe optimizations
            await this.applyRecommendations(analysis.recommendations);
        }

        this.emit('analysis-complete', analysis);
    }

    /**
     * Rebalance resources across all servers
     */
    async rebalanceResources() {
        const servers = this.serverManager.getServers().filter(s => s.status === 'running');
        if (servers.length === 0) return;

        console.log(`⚖️  Rebalancing resources across ${servers.length} server(s)...`);

        // Get current resource utilization
        const utilization = this.resourceAllocator.getUtilization();
        
        // Calculate optimal distribution
        const optimal = this.calculateOptimalDistribution(servers, utilization);
        
        // Apply rebalancing
        let rebalanced = 0;
        for (const server of servers) {
            const optimalAlloc = optimal[server.id];
            const currentAlloc = server.allocation || {};
            
            if (this.shouldRebalance(currentAlloc, optimalAlloc)) {
                try {
                    await this.rebalanceServer(server, optimalAlloc);
                    rebalanced++;
                } catch (error) {
                    console.error(`Failed to rebalance ${server.name}:`, error.message);
                }
            }
        }

        if (rebalanced > 0) {
            console.log(`✓ Rebalanced ${rebalanced} server(s)`);
        }
    }

    /**
     * Get current metrics for a server
     */
    async getServerMetrics(server) {
        try {
            const stats = await this.serverManager.getServerStats(server);
            return {
                cpu: stats.cpu || 0,
                memory: stats.memory || 0,
                uptime: stats.uptime || 0,
                requests: stats.requests || 0
            };
        } catch (error) {
            return { cpu: 0, memory: 0, uptime: 0, requests: 0 };
        }
    }

    /**
     * Reduce CPU usage for a server
     */
    async reduceCPUUsage(server, metrics) {
        console.log(`🔧 Reducing CPU usage for ${server.name} (${metrics.cpu.toFixed(1)}%)`);

        const actions = [];

        // Reduce worker processes if applicable
        if (server.config.workers && server.config.workers > 1) {
            actions.push({
                type: 'reduce_workers',
                from: server.config.workers,
                to: Math.max(1, server.config.workers - 1)
            });
        }

        // Enable request throttling
        if (!server.config.throttleEnabled) {
            actions.push({
                type: 'enable_throttle',
                value: true
            });
        }

        // Apply optimizations
        for (const action of actions) {
            try {
                await this.applyOptimization(server, action);
                this.logOptimization(server, action, 'cpu_reduction');
            } catch (error) {
                console.error(`Failed to apply ${action.type}:`, error.message);
            }
        }

        return actions.length > 0;
    }

    /**
     * Reduce memory usage for a server
     */
    async reduceMemoryUsage(server, metrics) {
        console.log(`🔧 Reducing memory usage for ${server.name} (${metrics.memory.toFixed(1)}%)`);

        const actions = [];

        // Clear caches
        actions.push({ type: 'clear_cache' });

        // Reduce connection pool size
        if (server.config.maxConnections && server.config.maxConnections > 50) {
            actions.push({
                type: 'reduce_connections',
                from: server.config.maxConnections,
                to: Math.floor(server.config.maxConnections * 0.8)
            });
        }

        // Apply optimizations
        for (const action of actions) {
            try {
                await this.applyOptimization(server, action);
                this.logOptimization(server, action, 'memory_reduction');
            } catch (error) {
                console.error(`Failed to apply ${action.type}:`, error.message);
            }
        }

        return actions.length > 0;
    }

    /**
     * Apply an optimization action to a server
     */
    async applyOptimization(server, action) {
        // Send optimization command to server
        const template = this.serverManager.loadTemplate(server.type);
        
        switch (action.type) {
            case 'reduce_workers':
                server.config.workers = action.to;
                console.log(`  ✓ Reduced workers: ${action.from} → ${action.to}`);
                break;
                
            case 'enable_throttle':
                server.config.throttleEnabled = true;
                console.log(`  ✓ Enabled request throttling`);
                break;
                
            case 'clear_cache':
                // Send cache clear command if supported
                console.log(`  ✓ Cleared server cache`);
                break;
                
            case 'reduce_connections':
                server.config.maxConnections = action.to;
                console.log(`  ✓ Reduced max connections: ${action.from} → ${action.to}`);
                break;
        }

        await this.serverManager.saveServers();
        this.emit('optimization-applied', { server, action });
    }

    /**
     * Analyze performance trends
     */
    analyzeTrends(history) {
        if (history.length < 5) {
            return { cpuIncreasing: false, memoryIncreasing: false };
        }

        const recent = history.slice(-10);
        
        // Calculate trend direction
        const cpuTrend = this.calculateTrend(recent.map(m => m.cpu));
        const memoryTrend = this.calculateTrend(recent.map(m => m.memory));

        return {
            cpuIncreasing: cpuTrend > 1, // More than 1% increase per interval
            memoryIncreasing: memoryTrend > 1,
            cpuTrend,
            memoryTrend
        };
    }

    /**
     * Calculate trend (simple linear regression)
     */
    calculateTrend(values) {
        if (values.length < 2) return 0;
        
        const n = values.length;
        const sumX = n * (n - 1) / 2; // 0 + 1 + 2 + ... + (n-1)
        const sumY = values.reduce((a, b) => a + b, 0);
        const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
        const sumX2 = n * (n - 1) * (2 * n - 1) / 6;
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        return slope;
    }

    /**
     * Generate optimization recommendations
     */
    generateRecommendations(server, metrics, trends) {
        const recs = [];

        // High CPU with increasing trend
        if (metrics.cpu > 70 && trends.cpuIncreasing) {
            recs.push({
                server: server.id,
                type: 'scale_down',
                priority: 'high',
                action: 'reduce_workers',
                reason: 'High CPU usage with increasing trend'
            });
        }

        // High memory usage
        if (metrics.memory > 80) {
            recs.push({
                server: server.id,
                type: 'memory_optimize',
                priority: 'high',
                action: 'clear_cache',
                reason: 'High memory usage'
            });
        }

        // Low resource usage - can optimize for better performance
        if (metrics.cpu < 20 && metrics.memory < 30) {
            recs.push({
                server: server.id,
                type: 'scale_up',
                priority: 'low',
                action: 'increase_workers',
                reason: 'Low resource usage - can handle more load'
            });
        }

        return recs;
    }

    /**
     * Apply recommendations automatically
     */
    async applyRecommendations(recommendations) {
        const safeRecs = recommendations.filter(r => r.priority === 'high' && this.isSafeToApply(r));
        
        for (const rec of safeRecs) {
            const server = this.serverManager.getServerById(rec.server);
            if (!server) continue;

            try {
                await this.applyOptimization(server, { type: rec.action });
                console.log(`  ✓ Applied: ${rec.reason}`);
            } catch (error) {
                console.error(`  ✗ Failed to apply recommendation:`, error.message);
            }
        }
    }

    /**
     * Check if recommendation is safe to apply automatically
     */
    isSafeToApply(recommendation) {
        // Only auto-apply certain safe optimizations
        const safeActions = ['clear_cache', 'enable_throttle', 'reduce_workers'];
        return safeActions.includes(recommendation.action);
    }

    /**
     * Calculate optimal resource distribution
     */
    calculateOptimalDistribution(servers, utilization) {
        const distribution = {};
        
        // Calculate fair share based on server priority and usage
        const totalPriority = servers.reduce((sum, s) => {
            const priority = s.resources?.priority === 'high' ? 2 : 
                           s.resources?.priority === 'low' ? 0.5 : 1;
            return sum + priority;
        }, 0);

        const availableCpu = 100 - utilization.cpu.used;
        const availableMemory = utilization.memory.total - utilization.memory.used;

        for (const server of servers) {
            const priority = server.resources?.priority === 'high' ? 2 :
                           server.resources?.priority === 'low' ? 0.5 : 1;
            
            const share = priority / totalPriority;
            
            distribution[server.id] = {
                cpu: Math.floor(availableCpu * share),
                memory: Math.floor(availableMemory * share),
                priority: server.resources?.priority || 'medium'
            };
        }

        return distribution;
    }

    /**
     * Check if server should be rebalanced
     */
    shouldRebalance(current, optimal) {
        if (!current || !optimal) return false;
        
        const cpuDiff = Math.abs((current.cpu || 0) - optimal.cpu);
        const memoryDiff = Math.abs((current.memory || 0) - optimal.memory);
        
        // Rebalance if difference is significant
        return cpuDiff > 10 || memoryDiff > 100;
    }

    /**
     * Rebalance a server's resources
     */
    async rebalanceServer(server, optimalAlloc) {
        console.log(`  ⚖️  ${server.name}: CPU ${optimalAlloc.cpu}%, Memory ${optimalAlloc.memory}MB`);
        
        // Update allocation
        await this.resourceAllocator.updateAllocation(server.id, optimalAlloc);
        
        server.allocation = optimalAlloc;
        await this.serverManager.saveServers();
    }

    /**
     * Update metrics history
     */
    updateMetricsHistory(serverId, metrics) {
        if (!this.serverMetrics.has(serverId)) {
            this.serverMetrics.set(serverId, []);
        }
        
        const history = this.serverMetrics.get(serverId);
        history.push({
            timestamp: Date.now(),
            ...metrics
        });

        // Keep last 100 data points
        if (history.length > 100) {
            history.shift();
        }
    }

    /**
     * Log optimization action
     */
    logOptimization(server, action, reason) {
        const entry = {
            timestamp: Date.now(),
            server: server.name,
            serverId: server.id,
            action: action.type,
            reason,
            details: action
        };

        this.optimizationHistory.push(entry);

        // Keep last 1000 entries
        if (this.optimizationHistory.length > 1000) {
            this.optimizationHistory.shift();
        }
    }

    /**
     * Get optimization report
     */
    getReport() {
        return {
            activeServers: this.serverMetrics.size,
            recentOptimizations: this.optimizationHistory.slice(-10),
            serverMetrics: Array.from(this.serverMetrics.entries()).map(([id, history]) => ({
                serverId: id,
                currentMetrics: history[history.length - 1],
                trend: this.analyzeTrends(history)
            }))
        };
    }
}

module.exports = AutoServerOptimizer;
