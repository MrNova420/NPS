/**
 * NPS Service Discovery - Find and Import Existing Services
 * Discovers running services on the device and allows importing them into NPS
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const fs = require('fs').promises;

class ServiceDiscovery {
    constructor() {
        this.knownServices = {
            // Port ranges for common services
            'postgresql': { ports: [5432, 5433, 5434], command: 'postgres' },
            'redis': { ports: [6379, 6380, 6381], command: 'redis-server' },
            'mysql': { ports: [3306, 3307], command: 'mysqld' },
            'mongodb': { ports: [27017, 27018], command: 'mongod' },
            'nginx': { ports: [80, 8080, 8081], command: 'nginx' },
            'apache': { ports: [80, 8080, 8081], command: 'httpd' },
            'nodejs': { ports: [3000, 3001, 8000, 8080], command: 'node' },
            'python': { ports: [5000, 8000, 8080], command: 'python' },
            'minecraft': { ports: [25565, 25566], command: 'java' },
            'ssh': { ports: [22, 8022], command: 'sshd' },
            'docker': { ports: [2375, 2376], command: 'dockerd' }
        };
    }

    async initialize() {
        console.log('🔍 Service Discovery initializing...');
        console.log('🔍 Service Discovery ready');
    }

    /**
     * Scan for all running services on the system
     */
    async scanSystem() {
        console.log('🔍 Scanning system for running services...');
        
        const [listeningPorts, runningProcesses] = await Promise.all([
            this.getListeningPorts(),
            this.getRunningProcesses()
        ]);

        const services = this.matchServicesToProcesses(listeningPorts, runningProcesses);
        
        console.log(`Found ${services.length} potentially importable services`);
        return services;
    }

    /**
     * Get all ports with listening processes
     */
    async getListeningPorts() {
        try {
            // Use netstat or ss to find listening ports
            const { stdout } = await execAsync('netstat -tulpn 2>/dev/null || ss -tulpn 2>/dev/null || echo ""');
            
            const ports = [];
            const lines = stdout.split('\n');
            
            for (const line of lines) {
                // Parse netstat/ss output
                const match = line.match(/(?:tcp|udp)\s+\d+\s+\d+\s+[\d.]+:(\d+)\s+.*?(\d+)\/(.*?)(?:\s|$)/);
                if (match) {
                    const [, port, pid, program] = match;
                    ports.push({
                        port: parseInt(port),
                        pid: parseInt(pid),
                        program: program.trim(),
                        protocol: line.includes('tcp') ? 'tcp' : 'udp'
                    });
                }
            }
            
            return ports;
        } catch (error) {
            console.error('Failed to get listening ports:', error.message);
            return [];
        }
    }

    /**
     * Get all running processes
     */
    async getRunningProcesses() {
        try {
            const { stdout } = await execAsync('ps aux');
            
            const processes = [];
            const lines = stdout.split('\n').slice(1); // Skip header
            
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 11) {
                    processes.push({
                        user: parts[0],
                        pid: parseInt(parts[1]),
                        cpu: parseFloat(parts[2]),
                        mem: parseFloat(parts[3]),
                        command: parts.slice(10).join(' ')
                    });
                }
            }
            
            return processes;
        } catch (error) {
            console.error('Failed to get running processes:', error.message);
            return [];
        }
    }

    /**
     * Match listening ports to known service types
     */
    matchServicesToProcesses(listeningPorts, runningProcesses) {
        const services = [];
        
        for (const portInfo of listeningPorts) {
            const process = runningProcesses.find(p => p.pid === portInfo.pid);
            if (!process) continue;

            // Try to identify service type
            let serviceType = 'unknown';
            let serviceName = portInfo.program;

            for (const [type, config] of Object.entries(this.knownServices)) {
                if (process.command.toLowerCase().includes(config.command) || 
                    config.ports.includes(portInfo.port)) {
                    serviceType = type;
                    break;
                }
            }

            // Check if this looks like a user-managed service
            const isUserService = process.user !== 'root' && 
                                 process.user !== 'system' &&
                                 !process.command.includes('/system/');

            services.push({
                type: serviceType,
                name: serviceName,
                port: portInfo.port,
                pid: portInfo.pid,
                protocol: portInfo.protocol,
                cpu: process.cpu,
                memory: process.mem,
                command: process.command,
                user: process.user,
                importable: isUserService,
                manageable: isUserService || serviceType !== 'unknown'
            });
        }

        return services.sort((a, b) => b.importable - a.importable);
    }

    /**
     * Import an existing service into NPS
     */
    async importService(serviceInfo) {
        console.log(`📥 Importing service: ${serviceInfo.name} on port ${serviceInfo.port}`);

        // Create a server configuration based on discovered service
        const serverConfig = {
            id: `imported_${Date.now()}`,
            name: serviceInfo.name || `${serviceInfo.type}_${serviceInfo.port}`,
            type: serviceInfo.type,
            port: serviceInfo.port,
            status: 'running',
            imported: true,
            originalPid: serviceInfo.pid,
            created: new Date().toISOString(),
            config: {
                imported: true,
                originalCommand: serviceInfo.command,
                originalUser: serviceInfo.user
            },
            stats: {
                cpu: serviceInfo.cpu,
                memory: serviceInfo.memory,
                uptime: 0
            }
        };

        return serverConfig;
    }

    /**
     * Detect orphaned processes (processes not managed by NPS but look like servers)
     */
    async findOrphans(managedServerIds) {
        const allServices = await this.scanSystem();
        
        // Filter out system services and managed services
        const orphans = allServices.filter(service => {
            // Skip if it's a system service
            if (!service.manageable) return false;
            
            // Skip if it's already managed (check by port or PID)
            // This would need integration with ServerManager
            return true;
        });

        return orphans;
    }

    /**
     * Get detailed info about a specific port
     */
    async getPortInfo(port) {
        try {
            const { stdout } = await execAsync(`lsof -i :${port} -n -P 2>/dev/null || netstat -tulpn 2>/dev/null | grep :${port}`);
            
            if (!stdout.trim()) {
                return { available: true, port };
            }

            // Parse lsof output
            const lines = stdout.trim().split('\n');
            const info = [];
            
            for (const line of lines) {
                if (line.includes('COMMAND') || !line.trim()) continue;
                
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 2) {
                    info.push({
                        command: parts[0],
                        pid: parseInt(parts[1]),
                        user: parts[2] || 'unknown'
                    });
                }
            }

            return {
                available: false,
                port,
                processes: info
            };
        } catch (error) {
            // Port is likely available if command fails
            return { available: true, port };
        }
    }

    /**
     * Check if a port is available
     */
    async isPortAvailable(port) {
        const info = await this.getPortInfo(port);
        return info.available;
    }

    /**
     * Find next available port in a range
     */
    async findAvailablePort(startPort = 8000, endPort = 9000) {
        for (let port = startPort; port <= endPort; port++) {
            if (await this.isPortAvailable(port)) {
                return port;
            }
        }
        throw new Error(`No available ports in range ${startPort}-${endPort}`);
    }

    /**
     * Get process details by PID
     */
    async getProcessDetails(pid) {
        try {
            const [psInfo, lsofInfo] = await Promise.all([
                execAsync(`ps -p ${pid} -o pid,ppid,user,%cpu,%mem,etime,command`),
                execAsync(`lsof -p ${pid} 2>/dev/null`).catch(() => ({ stdout: '' }))
            ]);

            const lines = psInfo.stdout.split('\n');
            if (lines.length < 2) {
                return null;
            }

            const parts = lines[1].trim().split(/\s+/);
            
            return {
                pid: parseInt(parts[0]),
                ppid: parseInt(parts[1]),
                user: parts[2],
                cpu: parseFloat(parts[3]),
                memory: parseFloat(parts[4]),
                uptime: parts[5],
                command: parts.slice(6).join(' '),
                openFiles: lsofInfo.stdout.split('\n').length - 1
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Kill a process safely
     */
    async killProcess(pid, signal = 'SIGTERM') {
        try {
            console.log(`Sending ${signal} to PID ${pid}`);
            await execAsync(`kill -${signal} ${pid}`);
            
            // Wait a bit and check if process is still running
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const stillRunning = await this.getProcessDetails(pid);
            if (stillRunning) {
                console.log(`Process ${pid} still running, trying SIGKILL`);
                await execAsync(`kill -SIGKILL ${pid}`);
            }
            
            return true;
        } catch (error) {
            console.error(`Failed to kill process ${pid}:`, error.message);
            return false;
        }
    }

    /**
     * Get system resource summary
     */
    async getSystemSummary() {
        const [ports, processes] = await Promise.all([
            this.getListeningPorts(),
            this.getRunningProcesses()
        ]);

        const services = this.matchServicesToProcesses(ports, processes);

        return {
            totalProcesses: processes.length,
            listeningPorts: ports.length,
            identifiedServices: services.filter(s => s.type !== 'unknown').length,
            importableServices: services.filter(s => s.importable).length,
            services: services,
            portUsage: this.analyzePortUsage(ports),
            resourceUsage: this.analyzeResourceUsage(processes)
        };
    }

    /**
     * Analyze port usage patterns
     */
    analyzePortUsage(ports) {
        const ranges = {
            wellKnown: ports.filter(p => p.port < 1024).length,
            registered: ports.filter(p => p.port >= 1024 && p.port < 49152).length,
            dynamic: ports.filter(p => p.port >= 49152).length
        };

        const byProtocol = {
            tcp: ports.filter(p => p.protocol === 'tcp').length,
            udp: ports.filter(p => p.protocol === 'udp').length
        };

        return { ranges, byProtocol };
    }

    /**
     * Analyze resource usage
     */
    analyzeResourceUsage(processes) {
        const totalCpu = processes.reduce((sum, p) => sum + p.cpu, 0);
        const totalMem = processes.reduce((sum, p) => sum + p.mem, 0);

        const topCpu = processes.sort((a, b) => b.cpu - a.cpu).slice(0, 5);
        const topMem = processes.sort((a, b) => b.mem - a.mem).slice(0, 5);

        return {
            totalCpu: Math.round(totalCpu * 10) / 10,
            totalMem: Math.round(totalMem * 10) / 10,
            topCpuProcesses: topCpu.map(p => ({
                pid: p.pid,
                command: p.command.substring(0, 50),
                cpu: p.cpu
            })),
            topMemProcesses: topMem.map(p => ({
                pid: p.pid,
                command: p.command.substring(0, 50),
                mem: p.mem
            }))
        };
    }
}

module.exports = ServiceDiscovery;
