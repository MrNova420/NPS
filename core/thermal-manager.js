/**
 * NPS Thermal Manager - Temperature Monitoring & Throttling Management
 * Optimized for ARM Cortex-A53 thermal characteristics
 * Prevents thermal throttling and protects device longevity
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const EventEmitter = require('events');

class ThermalManager extends EventEmitter {
    constructor() {
        super();
        
        // Temperature thresholds (Celsius)
        this.thresholds = {
            normal: 45,      // Everything is fine
            warm: 55,        // Starting to get warm
            hot: 65,         // Getting hot, reduce load
            critical: 75,    // Critical, aggressive throttling
            emergency: 85    // Emergency shutdown needed
        };

        // Current state
        this.state = {
            temperature: null,
            status: 'unknown',
            throttling: false,
            throttleLevel: 0, // 0-100, higher = more aggressive
            lastCheck: null,
            trend: 'stable', // 'cooling', 'stable', 'heating'
            history: []
        };

        // Throttling actions
        this.throttleActions = [];
        this.checkInterval = 10000; // Check every 10 seconds
        this.historySize = 60; // Keep 10 minutes of history at 10s intervals
        
        // Thermal zones to check (Android/Linux)
        this.thermalZones = [
            '/sys/class/thermal/thermal_zone0/temp',
            '/sys/class/thermal/thermal_zone1/temp',
            '/sys/class/thermal/thermal_zone2/temp',
            '/sys/devices/virtual/thermal/thermal_zone0/temp',
            '/sys/devices/virtual/thermal/thermal_zone1/temp'
        ];
    }

    async initialize() {
        console.log('🌡️ Thermal Manager initializing...');
        
        // Find available thermal zones
        await this.detectThermalZones();
        
        // Start monitoring
        this.startMonitoring();
        
        console.log('🌡️ Thermal Manager active');
    }

    async detectThermalZones() {
        const available = [];
        
        for (const zone of this.thermalZones) {
            try {
                await execAsync(`test -f ${zone}`);
                available.push(zone);
            } catch {
                // Zone doesn't exist
            }
        }
        
        if (available.length === 0) {
            console.warn('⚠️ No thermal zones found, temperature monitoring disabled');
            console.warn('   This is common on some Android devices that hide thermal data');
        } else {
            console.log(`Found ${available.length} thermal zone(s)`);
            this.thermalZones = available;
        }
    }

    startMonitoring() {
        setInterval(async () => {
            await this.checkTemperature();
        }, this.checkInterval);
    }

    async checkTemperature() {
        const temp = await this.readTemperature();
        
        if (temp === null) {
            this.state.status = 'unavailable';
            return;
        }

        // Update state
        const prevTemp = this.state.temperature;
        this.state.temperature = temp;
        this.state.lastCheck = Date.now();

        // Determine trend
        if (prevTemp !== null) {
            const diff = temp - prevTemp;
            if (diff > 2) {
                this.state.trend = 'heating';
            } else if (diff < -2) {
                this.state.trend = 'cooling';
            } else {
                this.state.trend = 'stable';
            }
        }

        // Add to history
        this.state.history.push({
            timestamp: Date.now(),
            temperature: temp,
            throttleLevel: this.state.throttleLevel
        });

        // Trim history
        if (this.state.history.length > this.historySize) {
            this.state.history.shift();
        }

        // Determine status and throttle level
        this.updateStatus(temp);
        
        // Execute throttling actions if needed
        if (this.state.throttling) {
            await this.executeThrottling();
        }
    }

    async readTemperature() {
        if (this.thermalZones.length === 0) {
            return null;
        }

        const temperatures = [];
        
        for (const zone of this.thermalZones) {
            try {
                const { stdout } = await execAsync(`cat ${zone}`);
                const temp = parseInt(stdout.trim());
                
                if (!isNaN(temp)) {
                    // Convert millidegrees to degrees
                    temperatures.push(temp > 200 ? temp / 1000 : temp);
                }
            } catch {
                // Failed to read this zone
            }
        }

        if (temperatures.length === 0) {
            return null;
        }

        // Return the maximum temperature (worst case)
        return Math.max(...temperatures);
    }

    updateStatus(temp) {
        let status, throttleLevel, throttling;

        if (temp >= this.thresholds.emergency) {
            status = 'emergency';
            throttleLevel = 100;
            throttling = true;
            this.emit('thermal:emergency', { temperature: temp });
            console.error(`🚨 THERMAL EMERGENCY: ${temp}°C`);
        } else if (temp >= this.thresholds.critical) {
            status = 'critical';
            throttleLevel = 80;
            throttling = true;
            this.emit('thermal:critical', { temperature: temp });
            console.warn(`⚠️ CRITICAL TEMPERATURE: ${temp}°C`);
        } else if (temp >= this.thresholds.hot) {
            status = 'hot';
            throttleLevel = 50;
            throttling = true;
            this.emit('thermal:hot', { temperature: temp });
        } else if (temp >= this.thresholds.warm) {
            status = 'warm';
            throttleLevel = 20;
            throttling = true;
            this.emit('thermal:warm', { temperature: temp });
        } else {
            status = 'normal';
            throttleLevel = 0;
            throttling = false;
        }

        // Check if status changed
        if (this.state.status !== status) {
            console.log(`Thermal status: ${this.state.status} -> ${status} (${temp}°C)`);
            this.emit('thermal:status-change', { 
                from: this.state.status, 
                to: status, 
                temperature: temp 
            });
        }

        this.state.status = status;
        this.state.throttleLevel = throttleLevel;
        this.state.throttling = throttling;
    }

    async executeThrottling() {
        const level = this.state.throttleLevel;

        // Execute registered throttle actions
        for (const action of this.throttleActions) {
            try {
                await action(level, this.state);
            } catch (error) {
                console.error('Throttle action failed:', error.message);
            }
        }

        // Built-in throttling actions
        if (level >= 80) {
            // Critical: Reduce CPU frequency
            await this.reduceCPUFrequency(80);
        } else if (level >= 50) {
            // Hot: Moderate CPU frequency reduction
            await this.reduceCPUFrequency(60);
        } else if (level >= 20) {
            // Warm: Slight CPU frequency reduction
            await this.reduceCPUFrequency(80);
        }
    }

    async reduceCPUFrequency(percentage) {
        try {
            // Try to reduce CPU frequency (requires root on most Android devices)
            // This is a best-effort approach
            const cpuCount = require('os').cpus().length;
            
            for (let i = 0; i < cpuCount; i++) {
                const freqPath = `/sys/devices/system/cpu/cpu${i}/cpufreq/scaling_max_freq`;
                
                try {
                    // Read max frequency
                    const { stdout: maxFreqStr } = await execAsync(`cat ${freqPath}`);
                    const maxFreq = parseInt(maxFreqStr.trim());
                    
                    if (!isNaN(maxFreq)) {
                        const targetFreq = Math.floor(maxFreq * (percentage / 100));
                        await execAsync(`echo ${targetFreq} > ${freqPath}`);
                    }
                } catch {
                    // Can't modify this CPU, skip
                }
            }
        } catch (error) {
            // CPU frequency control not available (common without root)
            // This is expected on most devices
        }
    }

    /**
     * Register a throttling action callback
     * Callback receives (throttleLevel, state)
     */
    registerThrottleAction(callback) {
        this.throttleActions.push(callback);
    }

    /**
     * Get current thermal state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Get temperature trend analysis
     */
    getTrend() {
        if (this.state.history.length < 6) {
            return { trend: 'insufficient-data', rate: 0 };
        }

        // Calculate average temperature change over last 6 readings
        const recent = this.state.history.slice(-6);
        const oldest = recent[0].temperature;
        const newest = recent[recent.length - 1].temperature;
        const change = newest - oldest;
        const timespan = (recent[recent.length - 1].timestamp - recent[0].timestamp) / 1000; // seconds
        const ratePerMinute = (change / timespan) * 60;

        let trend;
        if (ratePerMinute > 0.5) {
            trend = 'heating-fast';
        } else if (ratePerMinute > 0.1) {
            trend = 'heating';
        } else if (ratePerMinute < -0.5) {
            trend = 'cooling-fast';
        } else if (ratePerMinute < -0.1) {
            trend = 'cooling';
        } else {
            trend = 'stable';
        }

        return { trend, rate: ratePerMinute };
    }

    /**
     * Predict if thermal throttling is likely in next N minutes
     */
    predictThrottling(minutes = 5) {
        const trend = this.getTrend();
        
        if (trend.trend === 'insufficient-data') {
            return { likely: false, reason: 'insufficient-data' };
        }

        const currentTemp = this.state.temperature;
        const projectedTemp = currentTemp + (trend.rate * minutes);

        if (projectedTemp >= this.thresholds.critical) {
            return { 
                likely: true, 
                severity: 'critical',
                projectedTemp,
                minutesUntil: Math.max(0, (this.thresholds.critical - currentTemp) / trend.rate),
                recommendation: 'Stop non-essential servers immediately'
            };
        } else if (projectedTemp >= this.thresholds.hot) {
            return { 
                likely: true, 
                severity: 'moderate',
                projectedTemp,
                minutesUntil: Math.max(0, (this.thresholds.hot - currentTemp) / trend.rate),
                recommendation: 'Reduce load or improve cooling'
            };
        }

        return { likely: false, projectedTemp };
    }

    /**
     * Get thermal performance report
     */
    getReport() {
        const trend = this.getTrend();
        const prediction = this.predictThrottling();
        
        return {
            current: {
                temperature: this.state.temperature,
                status: this.state.status,
                throttling: this.state.throttling,
                throttleLevel: this.state.throttleLevel
            },
            trend: {
                direction: trend.trend,
                rate: trend.rate.toFixed(2) + '°C/min'
            },
            prediction: prediction,
            thresholds: this.thresholds,
            history: this.state.history
        };
    }

    /**
     * Check if it's safe to start a new server
     */
    isSafeToStart(serverLoad = 'medium') {
        if (this.state.temperature === null) {
            // No thermal data available, allow start
            return { safe: true, reason: 'no-thermal-data' };
        }

        const loadIncrease = {
            'low': 2,      // Expected temp increase for low-load server
            'medium': 5,   // Expected temp increase for medium-load server
            'high': 10     // Expected temp increase for high-load server
        };

        const expectedIncrease = loadIncrease[serverLoad] || 5;
        const projectedTemp = this.state.temperature + expectedIncrease;

        if (projectedTemp >= this.thresholds.critical) {
            return { 
                safe: false, 
                reason: 'thermal-risk',
                currentTemp: this.state.temperature,
                projectedTemp,
                recommendation: 'Wait for device to cool down'
            };
        } else if (projectedTemp >= this.thresholds.hot && this.state.trend === 'heating') {
            return { 
                safe: false, 
                reason: 'thermal-trend',
                currentTemp: this.state.temperature,
                projectedTemp,
                recommendation: 'Device is heating, wait before starting new servers'
            };
        }

        return { safe: true };
    }

    /**
     * Get cooling recommendations
     */
    getCoolingRecommendations() {
        const recommendations = [];
        
        if (this.state.status === 'hot' || this.state.status === 'critical') {
            recommendations.push('Stop or pause resource-intensive servers');
            recommendations.push('Reduce CPU frequency if possible');
            recommendations.push('Improve device ventilation');
            recommendations.push('Remove device from hot environment');
            
            if (this.state.status === 'critical') {
                recommendations.push('⚠️ CRITICAL: Consider shutting down all servers temporarily');
            }
        }

        return recommendations;
    }

    /**
     * Update thresholds (for custom devices)
     */
    updateThresholds(thresholds) {
        this.thresholds = { ...this.thresholds, ...thresholds };
        console.log('Updated thermal thresholds:', this.thresholds);
    }
}

module.exports = ThermalManager;
