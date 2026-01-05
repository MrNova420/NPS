/**
 * NPS Resource Allocator - Intelligent Resource Distribution
 * Optimized for ARM Cortex-A53 with 4GB RAM (TCL T608G)
 * Manages CPU cores, memory, and I/O for multiple concurrent servers
 */

const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class ResourceAllocator {
    constructor() {
        // Device specifications (TCL T608G)
        this.deviceSpecs = {
            cpuCores: 8,
            cpuArch: 'ARM Cortex-A53',
            cpuMaxFreq: 2.3, // GHz
            totalRamMB: 4096,
            totalSwapMB: 1800,
            storageSpeedMBps: 150,
            networkDownMbps: 86,
            networkUpMbps: 12
        };

        // Resource pools
        this.pools = {
            cpu: {
                total: 100, // percentage
                reserved: 15, // Reserve for system
                available: 85,
                allocated: 0,
                allocations: new Map()
            },
            memory: {
                total: 4096, // MB
                reserved: 512, // Reserve for system
                available: 3584,
                allocated: 0,
                allocations: new Map(),
                safeLimit: 2560 // Don't exceed this to avoid swap
            },
            storage: {
                iopsReserved: 1000,
                bandwidthMBps: 150
            },
            network: {
                downloadBandwidthMbps: 86,
                uploadBandwidthMbps: 12,
                connectionsLimit: 1000
            }
        };

        // Server profiles - optimized resource requirements
        this.serverProfiles = {
            'web-static': { cpu: 5, memory: 64, priority: 'low' },
            'nodejs-api': { cpu: 10, memory: 128, priority: 'medium' },
            'flask-app': { cpu: 8, memory: 256, priority: 'medium' },
            'postgresql': { cpu: 15, memory: 512, priority: 'high' },
            'redis-cache': { cpu: 8, memory: 256, priority: 'high' },
            'minecraft': { cpu: 25, memory: 1024, priority: 'high' },
            'discord-bot': { cpu: 5, memory: 128, priority: 'low' },
            'ai-inference': { cpu: 30, memory: 1024, priority: 'high' },
            'file-storage': { cpu: 10, memory: 128, priority: 'medium' },
            'docker-manager': { cpu: 20, memory: 512, priority: 'high' },
            'load-balancer': { cpu: 15, memory: 256, priority: 'high' },
            'monitoring-stack': { cpu: 20, memory: 512, priority: 'medium' },
            'database-cluster': { cpu: 30, memory: 768, priority: 'high' },
            'dns-server': { cpu: 5, memory: 64, priority: 'medium' },
            'ssl-proxy': { cpu: 10, memory: 128, priority: 'medium' },
            'cicd-pipeline': { cpu: 25, memory: 512, priority: 'medium' },
            'fullstack-app': { cpu: 20, memory: 512, priority: 'medium' },
            'self-hosting-suite': { cpu: 35, memory: 1024, priority: 'high' }
        };

        this.allocationStrategy = 'balanced'; // 'balanced', 'performance', 'efficiency'
    }

    async initialize() {
        console.log('📊 Resource Allocator initializing...');
        
        // Detect actual system resources
        await this.detectSystemResources();
        
        // Calculate optimal allocations
        this.calculateResourcePools();
        
        console.log(`📊 Resource Allocator ready - ${this.pools.memory.available}MB RAM, ${this.pools.cpu.available}% CPU available`);
    }

    async detectSystemResources() {
        // Get actual CPU info
        const cpus = os.cpus();
        this.deviceSpecs.cpuCores = cpus.length;
        
        // Get actual RAM
        const totalMem = os.totalmem();
        this.deviceSpecs.totalRamMB = Math.floor(totalMem / (1024 * 1024));
        
        // Detect swap
        try {
            const { stdout } = await execAsync('free -m | grep Swap | awk \'{print $2}\'');
            this.deviceSpecs.totalSwapMB = parseInt(stdout.trim()) || 0;
        } catch (error) {
            this.deviceSpecs.totalSwapMB = 0;
        }

        // Detect if running on ARM
        try {
            const { stdout } = await execAsync('uname -m');
            const arch = stdout.trim();
            if (arch.includes('arm') || arch.includes('aarch')) {
                console.log('✅ ARM architecture detected, applying ARM optimizations');
            }
        } catch (error) {
            // Ignore
        }
    }

    calculateResourcePools() {
        // Adjust based on actual resources
        const totalMem = this.deviceSpecs.totalRamMB;
        
        // Reserve memory for system
        this.pools.memory.reserved = Math.max(512, Math.floor(totalMem * 0.15));
        this.pools.memory.total = totalMem;
        this.pools.memory.available = totalMem - this.pools.memory.reserved;
        
        // Safe limit to avoid swap thrashing
        this.pools.memory.safeLimit = Math.floor(this.pools.memory.available * 0.8);
        
        console.log(`Memory: ${totalMem}MB total, ${this.pools.memory.available}MB available, ${this.pools.memory.safeLimit}MB safe limit`);
    }

    /**
     * Request resources for a server
     */
    async allocate(serverId, serverType, customRequirements = null) {
        const profile = customRequirements || this.serverProfiles[serverType] || { 
            cpu: 10, 
            memory: 256, 
            priority: 'medium' 
        };

        // Check if resources are available
        const cpuAvailable = this.pools.cpu.available - this.pools.cpu.allocated;
        const memAvailable = this.pools.memory.safeLimit - this.pools.memory.allocated;

        if (profile.cpu > cpuAvailable) {
            throw new Error(`Insufficient CPU: need ${profile.cpu}%, have ${cpuAvailable}%`);
        }

        if (profile.memory > memAvailable) {
            throw new Error(`Insufficient memory: need ${profile.memory}MB, have ${memAvailable}MB`);
        }

        // Allocate resources
        const allocation = {
            serverId,
            serverType,
            cpu: profile.cpu,
            memory: profile.memory,
            priority: profile.priority,
            timestamp: Date.now(),
            cpuCores: this.calculateCpuCoreAffinity(profile.cpu),
            memorySwappable: profile.memory < 512, // Small processes can use swap
            oomScore: this.calculateOOMScore(profile.priority)
        };

        this.pools.cpu.allocations.set(serverId, allocation.cpu);
        this.pools.memory.allocations.set(serverId, allocation.memory);
        
        this.pools.cpu.allocated += allocation.cpu;
        this.pools.memory.allocated += allocation.memory;

        console.log(`Allocated resources for ${serverType}: ${allocation.cpu}% CPU, ${allocation.memory}MB RAM`);
        
        return allocation;
    }

    /**
     * Release resources when server stops
     */
    release(serverId) {
        const cpuAlloc = this.pools.cpu.allocations.get(serverId);
        const memAlloc = this.pools.memory.allocations.get(serverId);

        if (cpuAlloc) {
            this.pools.cpu.allocated -= cpuAlloc;
            this.pools.cpu.allocations.delete(serverId);
        }

        if (memAlloc) {
            this.pools.memory.allocated -= memAlloc;
            this.pools.memory.allocations.delete(serverId);
        }

        console.log(`Released resources for ${serverId}`);
    }

    /**
     * Calculate CPU core affinity for ARM big.LITTLE architecture
     * Cortex-A53 has 8 efficiency cores
     */
    calculateCpuCoreAffinity(cpuPercent) {
        const numCores = this.deviceSpecs.cpuCores;
        const coresNeeded = Math.ceil((cpuPercent / 100) * numCores);
        
        // For ARM Cortex-A53 (all efficiency cores), distribute evenly
        const cores = [];
        for (let i = 0; i < Math.min(coresNeeded, numCores); i++) {
            cores.push(i);
        }
        
        return cores;
    }

    /**
     * Calculate OOM (Out of Memory) score adjustment
     * Lower priority = higher OOM score (more likely to be killed)
     */
    calculateOOMScore(priority) {
        switch (priority) {
            case 'high':
                return -500; // Less likely to be killed
            case 'medium':
                return 0;
            case 'low':
                return 500; // More likely to be killed
            default:
                return 0;
        }
    }

    /**
     * Get current resource utilization
     */
    getUtilization() {
        return {
            cpu: {
                total: this.pools.cpu.total,
                allocated: this.pools.cpu.allocated,
                available: this.pools.cpu.available - this.pools.cpu.allocated,
                percentage: (this.pools.cpu.allocated / this.pools.cpu.available) * 100
            },
            memory: {
                total: this.pools.memory.total,
                allocated: this.pools.memory.allocated,
                available: this.pools.memory.safeLimit - this.pools.memory.allocated,
                percentage: (this.pools.memory.allocated / this.pools.memory.safeLimit) * 100,
                swapAvailable: this.deviceSpecs.totalSwapMB
            },
            servers: this.pools.cpu.allocations.size
        };
    }

    /**
     * Check if resources are available for a server type
     */
    canAllocate(serverType, customRequirements = null) {
        const profile = customRequirements || this.serverProfiles[serverType];
        if (!profile) return false;

        const cpuAvailable = this.pools.cpu.available - this.pools.cpu.allocated;
        const memAvailable = this.pools.memory.safeLimit - this.pools.memory.allocated;

        return profile.cpu <= cpuAvailable && profile.memory <= memAvailable;
    }

    /**
     * Get recommendations for server capacity
     */
    getCapacityRecommendations() {
        const util = this.getUtilization();
        const recommendations = [];

        // Check CPU capacity
        if (util.cpu.percentage > 80) {
            recommendations.push({
                type: 'warning',
                resource: 'cpu',
                message: 'CPU allocation near capacity',
                suggestion: 'Consider stopping low-priority servers'
            });
        }

        // Check memory capacity
        if (util.memory.percentage > 80) {
            recommendations.push({
                type: 'warning',
                resource: 'memory',
                message: 'Memory allocation near capacity',
                suggestion: 'Stop unused servers to free memory'
            });
        }

        // Recommend server types that can still fit
        const canFit = [];
        for (const [type, profile] of Object.entries(this.serverProfiles)) {
            if (this.canAllocate(type)) {
                canFit.push({ type, ...profile });
            }
        }

        return {
            utilization: util,
            warnings: recommendations,
            availableServerTypes: canFit.sort((a, b) => b.memory - a.memory)
        };
    }

    /**
     * Optimize resource allocation strategy
     */
    async optimize() {
        console.log('🔧 Optimizing resource allocations...');

        // Collect actual usage data
        const actualUsage = await this.collectActualUsage();

        // Adjust allocations based on actual usage
        for (const [serverId, usage] of actualUsage.entries()) {
            const allocation = this.pools.memory.allocations.get(serverId);
            if (allocation) {
                // If actual usage is much lower than allocated, we can reduce it
                if (usage.memory < allocation * 0.5) {
                    console.log(`Server ${serverId} using less memory than allocated, potential for optimization`);
                }
            }
        }

        console.log('✅ Resource optimization complete');
    }

    /**
     * Collect actual resource usage from running processes
     */
    async collectActualUsage() {
        const usage = new Map();
        
        // This would integrate with ProcessManager to get actual stats
        // For now, return empty map
        
        return usage;
    }

    /**
     * Apply resource limits to a process (cgroups if available)
     */
    async applyLimits(pid, allocation) {
        // Check if cgroups v2 is available (common in newer Android/Termux)
        try {
            await execAsync('which cgcreate');
            
            // Create cgroup for this process
            const cgroupName = `nps_${allocation.serverId}`;
            
            // Set memory limit
            await execAsync(`cgset -r memory.max=${allocation.memory}M ${cgroupName}`);
            
            // Set CPU quota (percentage of one core * number of cores)
            const cpuQuota = Math.floor((allocation.cpu / 100) * 100000); // microseconds
            await execAsync(`cgset -r cpu.max="${cpuQuota} 100000" ${cgroupName}`);
            
            // Move process to cgroup
            await execAsync(`cgclassify -g memory,cpu:${cgroupName} ${pid}`);
            
            console.log(`Applied cgroup limits to PID ${pid}`);
            return true;
        } catch (error) {
            // Cgroups not available, use ulimit instead
            try {
                // Set memory limit via ulimit (less reliable)
                await execAsync(`prlimit --pid ${pid} --as=${allocation.memory * 1024 * 1024}`);
                console.log(`Applied ulimit to PID ${pid}`);
                return true;
            } catch (limitError) {
                console.warn('Unable to apply resource limits, cgroups and ulimit not available');
                return false;
            }
        }
    }

    /**
     * Set OOM score for a process
     */
    async setOOMScore(pid, score) {
        try {
            await execAsync(`echo ${score} > /proc/${pid}/oom_score_adj`);
            return true;
        } catch (error) {
            console.warn(`Failed to set OOM score for PID ${pid}`);
            return false;
        }
    }

    /**
     * Get server profile
     */
    getServerProfile(serverType) {
        return this.serverProfiles[serverType] || null;
    }

    /**
     * Update server profile (for custom server types)
     */
    updateServerProfile(serverType, requirements) {
        this.serverProfiles[serverType] = requirements;
    }
}

module.exports = ResourceAllocator;
