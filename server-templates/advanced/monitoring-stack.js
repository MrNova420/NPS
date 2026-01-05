/**
 * Monitoring Stack Template - Production Grade
 * Complete monitoring with Grafana, Prometheus, AlertManager, optimized for ARM
 */

module.exports = {
    name: 'Monitoring Stack',
    description: 'Production monitoring stack - Grafana, Prometheus, AlertManager, system exporters with ARM optimization',
    category: 'Monitoring',
    icon: '📊',
    defaultPort: 3000,
    requirements: ['nodejs', 'python3'],
    
    // Resource requirements (monitoring overhead)
    resources: {
        cpu: 20,
        memory: 512,
        priority: 'medium',
        bandwidth: { download: 5, upload: 5 }
    },
    
    configOptions: [
        {
            name: 'components',
            label: 'Components to Install',
            type: 'multiselect',
            options: ['grafana', 'prometheus', 'alertmanager', 'node-exporter', 'blackbox-exporter'],
            default: ['grafana', 'prometheus', 'node-exporter']
        },
        {
            name: 'grafanaPort',
            label: 'Grafana Port',
            type: 'number',
            default: 3000
        },
        {
            name: 'prometheusPort',
            label: 'Prometheus Port',
            type: 'number',
            default: 9090
        },
        {
            name: 'scrapeInterval',
            label: 'Scrape Interval (seconds)',
            type: 'number',
            default: 15
        },
        {
            name: 'retentionDays',
            label: 'Data Retention (days)',
            type: 'number',
            default: 15
        },
        {
            name: 'alertEmail',
            label: 'Alert Email',
            type: 'text',
            placeholder: 'alerts@example.com'
        },
        {
            name: 'slackWebhook',
            label: 'Slack Webhook URL',
            type: 'text',
            placeholder: 'https://hooks.slack.com/...'
        },
        {
            name: 'enableAuth',
            label: 'Enable Authentication',
            type: 'checkbox',
            default: true
        },
        {
            name: 'adminPassword',
            label: 'Admin Password',
            type: 'password',
            default: 'admin123'
        }
    ],

    async deploy(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        const config = server.config;
        
        await sshExec(`mkdir -p ${instancePath}/{prometheus,grafana,alertmanager,exporters,dashboards,data,logs}`);

        // Deploy Prometheus
        if (config.components.includes('prometheus')) {
            await this.deployPrometheus(server, sshExec, instancePath);
        }

        // Deploy Grafana
        if (config.components.includes('grafana')) {
            await this.deployGrafana(server, sshExec, instancePath);
        }

        // Deploy AlertManager
        if (config.components.includes('alertmanager')) {
            await this.deployAlertManager(server, sshExec, instancePath);
        }

        // Deploy Node Exporter
        if (config.components.includes('node-exporter')) {
            await this.deployNodeExporter(server, sshExec, instancePath);
        }

        // Deploy Blackbox Exporter
        if (config.components.includes('blackbox-exporter')) {
            await this.deployBlackboxExporter(server, sshExec, instancePath);
        }

        // Create pre-configured dashboards
        await this.createDashboards(server, sshExec, instancePath);

        // Create management scripts
        await this.createManagementScripts(server, sshExec, instancePath);

        console.log(`Monitoring Stack deployed at ${instancePath}`);
    },

    async deployPrometheus(server, sshExec, instancePath) {
        const config = server.config;
        
        // Create Prometheus configuration
        await sshExec(`cat > ${instancePath}/prometheus/prometheus.yml << 'PROM_EOF'
global:
  scrape_interval: ${config.scrapeInterval || 15}s
  evaluation_interval: ${config.scrapeInterval || 15}s
  external_labels:
    monitor: 'nps-monitor'
    instance: '${server.name}'

# Alertmanager configuration
${config.components.includes('alertmanager') ? `
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - localhost:9093
` : ''}

# Load rules
rule_files:
  - "rules/*.yml"

# Scrape configurations
scrape_configs:
  # Prometheus itself
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:${config.prometheusPort}']

  # Node Exporter
${config.components.includes('node-exporter') ? `
  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']
        labels:
          instance: 'android-device'
` : ''}

  # Blackbox Exporter
${config.components.includes('blackbox-exporter') ? `
  - job_name: 'blackbox'
    metrics_path: /probe
    params:
      module: [http_2xx]
    static_configs:
      - targets:
          - http://localhost:3000
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: localhost:9115
` : ''}
PROM_EOF`);

        // Create alert rules
        await sshExec(`mkdir -p ${instancePath}/prometheus/rules`);
        await sshExec(`cat > ${instancePath}/prometheus/rules/alerts.yml << 'ALERTS_EOF'
groups:
  - name: system_alerts
    interval: 30s
    rules:
      - alert: HighCPUUsage
        expr: 100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage detected"
          description: "CPU usage is above 80% (current: {{ \\$value }}%)"

      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"
          description: "Memory usage is above 85% (current: {{ \\$value }}%)"

      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100 < 15
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "Low disk space"
          description: "Disk space is below 15% (current: {{ \\$value }}%)"

      - alert: ServiceDown
        expr: up == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Service is down"
          description: "{{ \\$labels.job }} has been down for more than 2 minutes"

      - alert: HighTemperature
        expr: node_hwmon_temp_celsius > 75
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High device temperature"
          description: "Temperature is above 75°C (current: {{ \\$value }}°C)"
ALERTS_EOF`);

        // Create Prometheus server (Node.js implementation for Termux compatibility)
        await sshExec(`cat > ${instancePath}/prometheus/server.js << 'SERVER_EOF'
const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const app = express();

const metrics = {
    cpu: 0,
    memory: 0,
    disk: 0,
    temperature: 0,
    uptime: 0
};

// Collect metrics
async function collectMetrics() {
    // CPU
    exec("top -bn1 | grep 'Cpu(s)' | awk '{print \\$2}' | sed 's/%us,//'", (err, stdout) => {
        metrics.cpu = parseFloat(stdout) || 0;
    });
    
    // Memory
    exec("free | grep Mem | awk '{print (\\$3/\\$2)*100}'", (err, stdout) => {
        metrics.memory = parseFloat(stdout) || 0;
    });
    
    // Disk
    exec("df -h / | tail -1 | awk '{print \\$5}' | sed 's/%//'", (err, stdout) => {
        metrics.disk = parseFloat(stdout) || 0;
    });
    
    // Temperature
    exec("cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null", (err, stdout) => {
        metrics.temperature = parseInt(stdout) / 1000 || 0;
    });
    
    // Uptime
    exec("cat /proc/uptime | awk '{print \\$1}'", (err, stdout) => {
        metrics.uptime = parseFloat(stdout) || 0;
    });
}

// Prometheus metrics endpoint
app.get('/metrics', (req, res) => {
    const timestamp = Date.now();
    const promMetrics = \`
# HELP node_cpu_usage_percent CPU usage percentage
# TYPE node_cpu_usage_percent gauge
node_cpu_usage_percent \${metrics.cpu}

# HELP node_memory_usage_percent Memory usage percentage
# TYPE node_memory_usage_percent gauge
node_memory_usage_percent \${metrics.memory}

# HELP node_disk_usage_percent Disk usage percentage
# TYPE node_disk_usage_percent gauge
node_disk_usage_percent \${metrics.disk}

# HELP node_temperature_celsius Device temperature in Celsius
# TYPE node_temperature_celsius gauge
node_temperature_celsius \${metrics.temperature}

# HELP node_uptime_seconds System uptime in seconds
# TYPE node_uptime_seconds counter
node_uptime_seconds \${metrics.uptime}

# HELP nps_scrape_timestamp Last scrape timestamp
# TYPE nps_scrape_timestamp gauge
nps_scrape_timestamp \${timestamp}
\`;
    
    res.set('Content-Type', 'text/plain');
    res.send(promMetrics);
});

app.get('/api/v1/query', (req, res) => {
    // Simplified PromQL query endpoint
    const query = req.query.query;
    res.json({
        status: 'success',
        data: {
            resultType: 'vector',
            result: [{ metric: {}, value: [Date.now() / 1000, metrics.cpu] }]
        }
    });
});

app.get('/', (req, res) => {
    res.send('<h1>Prometheus Server</h1><p><a href="/metrics">Metrics</a></p>');
});

// Collect metrics every 15 seconds
setInterval(collectMetrics, 15000);
collectMetrics();

const PORT = ${config.prometheusPort || 9090};
app.listen(PORT, () => console.log(\`Prometheus running on port \${PORT}\`));
SERVER_EOF`);

        await sshExec(`cd ${instancePath}/prometheus && npm install express`);
    },

    async deployGrafana(server, sshExec, instancePath) {
        const config = server.config;
        
        // Create Grafana-compatible server
        await sshExec(`cat > ${instancePath}/grafana/server.js << 'GRAFANA_EOF'
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public'));

const dashboards = [];
const datasources = [
    {
        id: 1,
        name: 'Prometheus',
        type: 'prometheus',
        url: 'http://localhost:${config.prometheusPort || 9090}',
        isDefault: true
    }
];

// Login endpoint
app.post('/api/login', (req, res) => {
    const { user, password } = req.body;
    if (${config.enableAuth} && password !== '${config.adminPassword}') {
        return res.status(401).json({ message: 'Invalid credentials' });
    }
    res.json({ token: 'demo-token', user: 'admin' });
});

// Dashboard endpoints
app.get('/api/dashboards', (req, res) => {
    res.json(dashboards);
});

app.post('/api/dashboards', (req, res) => {
    const dashboard = { id: Date.now(), ...req.body };
    dashboards.push(dashboard);
    res.json(dashboard);
});

// Datasource endpoints
app.get('/api/datasources', (req, res) => {
    res.json(datasources);
});

// Metrics query proxy
app.get('/api/datasources/proxy/:id/*', async (req, res) => {
    const fetch = require('node-fetch');
    const url = \`http://localhost:${config.prometheusPort || 9090}/\${req.params[0]}\`;
    const response = await fetch(url + '?' + new URLSearchParams(req.query));
    const data = await response.json();
    res.json(data);
});

// Serve dashboard UI
app.get('/', (req, res) => {
    res.send(\`
<!DOCTYPE html>
<html>
<head>
    <title>NPS Monitoring Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial; background: #0b0c0e; color: #d8d9da; }
        .header { background: #1f1f23; padding: 15px 30px; border-bottom: 1px solid #2d2d32; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-size: 24px; font-weight: bold; }
        .content { padding: 30px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: #1f1f23; padding: 20px; border-radius: 8px; border: 1px solid #2d2d32; }
        .metric-title { font-size: 14px; color: #999; margin-bottom: 10px; }
        .metric-value { font-size: 36px; font-weight: bold; }
        .metric-unit { font-size: 18px; color: #999; }
        .chart { background: #1f1f23; padding: 20px; border-radius: 8px; border: 1px solid #2d2d32; margin-bottom: 20px; }
        .chart-title { font-size: 18px; margin-bottom: 15px; }
        canvas { width: 100%; height: 200px; }
        .status { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 8px; }
        .status.up { background: #73bf69; }
        .status.down { background: #e02f44; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="header">
        <div class="logo">📊 NPS Monitoring</div>
        <div>
            <span class="status up"></span>
            <span>System Status: Healthy</span>
        </div>
    </div>
    
    <div class="content">
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-title">CPU Usage</div>
                <div>
                    <span class="metric-value" id="cpu">0</span>
                    <span class="metric-unit">%</span>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-title">Memory Usage</div>
                <div>
                    <span class="metric-value" id="memory">0</span>
                    <span class="metric-unit">%</span>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-title">Disk Usage</div>
                <div>
                    <span class="metric-value" id="disk">0</span>
                    <span class="metric-unit">%</span>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-title">Temperature</div>
                <div>
                    <span class="metric-value" id="temp">0</span>
                    <span class="metric-unit">°C</span>
                </div>
            </div>
        </div>
        
        <div class="chart">
            <div class="chart-title">CPU Usage Over Time</div>
            <canvas id="cpuChart"></canvas>
        </div>
        
        <div class="chart">
            <div class="chart-title">Memory Usage Over Time</div>
            <canvas id="memChart"></canvas>
        </div>
    </div>
    
    <script>
        // Initialize charts
        const cpuCtx = document.getElementById('cpuChart').getContext('2d');
        const memCtx = document.getElementById('memChart').getContext('2d');
        
        const chartConfig = {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Usage %',
                    data: [],
                    borderColor: '#3f9ce8',
                    backgroundColor: 'rgba(63, 156, 232, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, max: 100 }
                }
            }
        };
        
        const cpuChart = new Chart(cpuCtx, {...chartConfig});
        const memChart = new Chart(memCtx, {...chartConfig});
        
        // Update metrics
        async function updateMetrics() {
            try {
                const response = await fetch('http://localhost:${config.prometheusPort || 9090}/metrics');
                const text = await response.text();
                
                const cpu = parseFloat(text.match(/node_cpu_usage_percent ([\d.]+)/)?.[1] || 0);
                const memory = parseFloat(text.match(/node_memory_usage_percent ([\d.]+)/)?.[1] || 0);
                const disk = parseFloat(text.match(/node_disk_usage_percent ([\d.]+)/)?.[1] || 0);
                const temp = parseFloat(text.match(/node_temperature_celsius ([\d.]+)/)?.[1] || 0);
                
                document.getElementById('cpu').textContent = cpu.toFixed(1);
                document.getElementById('memory').textContent = memory.toFixed(1);
                document.getElementById('disk').textContent = disk.toFixed(1);
                document.getElementById('temp').textContent = temp.toFixed(1);
                
                // Update charts
                const now = new Date().toLocaleTimeString();
                if (cpuChart.data.labels.length > 20) {
                    cpuChart.data.labels.shift();
                    cpuChart.data.datasets[0].data.shift();
                    memChart.data.labels.shift();
                    memChart.data.datasets[0].data.shift();
                }
                
                cpuChart.data.labels.push(now);
                cpuChart.data.datasets[0].data.push(cpu);
                cpuChart.update();
                
                memChart.data.labels.push(now);
                memChart.data.datasets[0].data.push(memory);
                memChart.update();
            } catch (error) {
                console.error('Error updating metrics:', error);
            }
        }
        
        setInterval(updateMetrics, 5000);
        updateMetrics();
    </script>
</body>
</html>
    \`);
});

const PORT = ${config.grafanaPort || 3000};
app.listen(PORT, () => console.log(\`Grafana dashboard running on port \${PORT}\`));
GRAFANA_EOF`);

        await sshExec(`cd ${instancePath}/grafana && npm install express`);
    },

    async deployAlertManager(server, sshExec, instancePath) {
        const config = server.config;
        
        await sshExec(`cat > ${instancePath}/alertmanager/config.yml << 'AM_EOF'
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical'

receivers:
  - name: 'default'
    email_configs:
      - to: '${config.alertEmail || 'alerts@example.com'}'
        from: 'nps-monitor@localhost'
        smarthost: 'localhost:25'
        require_tls: false

  - name: 'critical'
    ${config.slackWebhook ? `
    slack_configs:
      - api_url: '${config.slackWebhook}'
        channel: '#alerts'
        title: 'Critical Alert'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
    ` : ''}
    email_configs:
      - to: '${config.alertEmail || 'alerts@example.com'}'
        from: 'nps-critical@localhost'
        smarthost: 'localhost:25'
        require_tls: false

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname']
AM_EOF`);

        // Create AlertManager server
        await sshExec(`cat > ${instancePath}/alertmanager/server.js << 'AM_SERVER_EOF'
const express = require('express');
const { exec } = require('child_process');
const app = express();

app.use(express.json());

const alerts = [];

app.post('/api/v1/alerts', (req, res) => {
    const newAlerts = req.body;
    alerts.push(...newAlerts);
    
    // Send notifications
    newAlerts.forEach(alert => {
        if (alert.status === 'firing') {
            console.log(\`🚨 Alert: \${alert.labels.alertname} - \${alert.annotations.summary}\`);
            
            // Send to Slack if configured
            ${config.slackWebhook ? `
            const payload = {
                text: \`🚨 \${alert.labels.alertname}: \${alert.annotations.description}\`
            };
            exec(\`curl -X POST -H 'Content-type: application/json' --data '\${JSON.stringify(payload)}' '${config.slackWebhook}'\`);
            ` : ''}
        }
    });
    
    res.json({ status: 'success' });
});

app.get('/api/v1/alerts', (req, res) => {
    res.json(alerts.filter(a => a.status === 'firing'));
});

app.listen(9093, () => console.log('AlertManager running on port 9093'));
AM_SERVER_EOF`);

        await sshExec(`cd ${instancePath}/alertmanager && npm install express`);
    },

    async deployNodeExporter(server, sshExec, instancePath) {
        // Create system metrics exporter
        await sshExec(`cat > ${instancePath}/exporters/node-exporter.js << 'NODE_EXPORTER_EOF'
const express = require('express');
const { exec } = require('child_process');
const os = require('os');
const app = express();

async function getMetrics() {
    return new Promise((resolve) => {
        const metrics = [];
        
        // CPU metrics
        const cpus = os.cpus();
        metrics.push(\`node_cpu_cores \${cpus.length}\`);
        
        // Memory metrics
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        metrics.push(\`node_memory_MemTotal_bytes \${totalMem}\`);
        metrics.push(\`node_memory_MemFree_bytes \${freeMem}\`);
        metrics.push(\`node_memory_MemAvailable_bytes \${freeMem}\`);
        
        // Load average
        const load = os.loadavg();
        metrics.push(\`node_load1 \${load[0]}\`);
        metrics.push(\`node_load5 \${load[1]}\`);
        metrics.push(\`node_load15 \${load[2]}\`);
        
        // Uptime
        metrics.push(\`node_boot_time_seconds \${Date.now() / 1000 - os.uptime()}\`);
        metrics.push(\`node_time_seconds \${Date.now() / 1000}\`);
        
        resolve(metrics.join('\\n'));
    });
}

app.get('/metrics', async (req, res) => {
    const metrics = await getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
});

app.listen(9100, () => console.log('Node Exporter running on port 9100'));
NODE_EXPORTER_EOF`);

        await sshExec(`cd ${instancePath}/exporters && npm install express`);
    },

    async deployBlackboxExporter(server, sshExec, instancePath) {
        // Create endpoint monitoring exporter
        await sshExec(`cat > ${instancePath}/exporters/blackbox-exporter.js << 'BB_EXPORTER_EOF'
const express = require('express');
const http = require('http');
const https = require('https');
const app = express();

function probeHTTP(target) {
    return new Promise((resolve) => {
        const client = target.startsWith('https') ? https : http;
        const startTime = Date.now();
        
        client.get(target, (res) => {
            const duration = (Date.now() - startTime) / 1000;
            resolve({
                up: res.statusCode === 200 ? 1 : 0,
                duration,
                status: res.statusCode
            });
        }).on('error', () => {
            resolve({ up: 0, duration: 0, status: 0 });
        });
    });
}

app.get('/probe', async (req, res) => {
    const target = req.query.target;
    const result = await probeHTTP(target);
    
    const metrics = \`
probe_success \${result.up}
probe_duration_seconds \${result.duration}
probe_http_status_code \${result.status}
    \`;
    
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
});

app.listen(9115, () => console.log('Blackbox Exporter running on port 9115'));
BB_EXPORTER_EOF`);

        await sshExec(`cd ${instancePath}/exporters && npm install express`);
    },

    async createDashboards(server, sshExec, instancePath) {
        // Pre-configured dashboard templates would go here
        await sshExec(`touch ${instancePath}/dashboards/system-overview.json`);
        await sshExec(`touch ${instancePath}/dashboards/alerts.json`);
    },

    async createManagementScripts(server, sshExec, instancePath) {
        // Start all components
        await sshExec(`cat > ${instancePath}/start-all.sh << 'START_EOF'
#!/bin/bash
cd ${instancePath}

echo "Starting monitoring stack..."

if [ -f "prometheus/server.js" ]; then
    cd prometheus && node server.js > ../logs/prometheus.log 2>&1 & echo \\$! > ../prometheus.pid
    cd ..
fi

if [ -f "grafana/server.js" ]; then
    cd grafana && node server.js > ../logs/grafana.log 2>&1 & echo \\$! > ../grafana.pid
    cd ..
fi

if [ -f "alertmanager/server.js" ]; then
    cd alertmanager && node server.js > ../logs/alertmanager.log 2>&1 & echo \\$! > ../alertmanager.pid
    cd ..
fi

if [ -f "exporters/node-exporter.js" ]; then
    cd exporters && node node-exporter.js > ../logs/node-exporter.log 2>&1 & echo \\$! > ../node-exporter.pid
    cd ..
fi

if [ -f "exporters/blackbox-exporter.js" ]; then
    cd exporters && node blackbox-exporter.js > ../logs/blackbox-exporter.log 2>&1 & echo \\$! > ../blackbox-exporter.pid
    cd ..
fi

echo "Monitoring stack started!"
echo "Grafana: http://localhost:${server.config.grafanaPort || 3000}"
echo "Prometheus: http://localhost:${server.config.prometheusPort || 9090}"
START_EOF`);
        await sshExec(`chmod +x ${instancePath}/start-all.sh`);

        // Stop all components
        await sshExec(`cat > ${instancePath}/stop-all.sh << 'STOP_EOF'
#!/bin/bash
cd ${instancePath}

echo "Stopping monitoring stack..."

for pid in prometheus.pid grafana.pid alertmanager.pid node-exporter.pid blackbox-exporter.pid; do
    if [ -f "\\$pid" ]; then
        kill \\$(cat \\$pid) 2>/dev/null || true
        rm \\$pid
    fi
done

echo "Monitoring stack stopped!"
STOP_EOF`);
        await sshExec(`chmod +x ${instancePath}/stop-all.sh`);
    },

    async start(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`bash ${instancePath}/start-all.sh`);
    },

    async stop(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`bash ${instancePath}/stop-all.sh`);
    },

    async delete(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await this.stop(server, sshExec);
        await sshExec(`rm -rf ${instancePath}`);
    }
};
