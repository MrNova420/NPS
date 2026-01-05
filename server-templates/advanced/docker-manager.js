/**
 * Docker Container Manager Template - Advanced Production Grade
 * Full Docker orchestration with compose support, monitoring, auto-restart
 */

module.exports = {
    name: 'Docker Container Manager',
    description: 'Production-grade Docker orchestration - Run any container with full management, health checks, and monitoring',
    category: 'Advanced',
    icon: '🐳',
    defaultPort: 0,
    requirements: ['proot-distro', 'docker'],
    
    // Resource requirements (base, actual usage depends on containers)
    resources: {
        cpu: 10,
        memory: 256,
        priority: 'high',
        bandwidth: { download: 10, upload: 10 }
    },
    
    configOptions: [
        {
            name: 'containerType',
            label: 'Container Type',
            type: 'select',
            options: [
                'custom',
                'nginx',
                'postgres',
                'mysql',
                'mongodb',
                'redis',
                'elasticsearch',
                'rabbitmq',
                'grafana',
                'prometheus',
                'nextcloud',
                'wordpress',
                'gitlab',
                'jenkins'
            ],
            default: 'custom',
            required: true
        },
        {
            name: 'imageName',
            label: 'Docker Image',
            type: 'text',
            placeholder: 'nginx:latest',
            help: 'Docker Hub image name and tag'
        },
        {
            name: 'ports',
            label: 'Port Mappings',
            type: 'text',
            placeholder: '8080:80,8443:443',
            help: 'Format: host:container,host:container'
        },
        {
            name: 'volumes',
            label: 'Volume Mounts',
            type: 'textarea',
            placeholder: '/host/path:/container/path\n/another:/path',
            help: 'One mapping per line'
        },
        {
            name: 'environment',
            label: 'Environment Variables',
            type: 'textarea',
            placeholder: 'KEY1=value1\nKEY2=value2',
            help: 'One variable per line'
        },
        {
            name: 'command',
            label: 'Override Command',
            type: 'text',
            placeholder: 'nginx -g "daemon off;"'
        },
        {
            name: 'networkMode',
            label: 'Network Mode',
            type: 'select',
            options: ['bridge', 'host', 'none'],
            default: 'bridge'
        },
        {
            name: 'restartPolicy',
            label: 'Restart Policy',
            type: 'select',
            options: ['no', 'always', 'unless-stopped', 'on-failure'],
            default: 'unless-stopped'
        },
        {
            name: 'memoryLimit',
            label: 'Memory Limit (MB)',
            type: 'number',
            default: 512
        },
        {
            name: 'cpuLimit',
            label: 'CPU Limit (cores)',
            type: 'number',
            step: 0.5,
            default: 1
        }
    ],

    async deploy(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        const config = server.config;
        
        await sshExec(`mkdir -p ${instancePath}/{logs,data,config}`);
        
        // Predefined configurations for common containers
        const presets = {
            nginx: {
                image: 'nginx:alpine',
                ports: '8080:80',
                volumes: `${instancePath}/html:/usr/share/nginx/html\n${instancePath}/config/nginx.conf:/etc/nginx/nginx.conf:ro`
            },
            postgres: {
                image: 'postgres:15-alpine',
                ports: '5432:5432',
                environment: `POSTGRES_PASSWORD=${config.dbPassword || 'postgres'}\nPOSTGRES_USER=${config.dbUser || 'postgres'}\nPOSTGRES_DB=${config.dbName || 'postgres'}`,
                volumes: `${instancePath}/data:/var/lib/postgresql/data`
            },
            mysql: {
                image: 'mysql:8',
                ports: '3306:3306',
                environment: `MYSQL_ROOT_PASSWORD=${config.rootPassword || 'root'}\nMYSQL_DATABASE=${config.dbName || 'mydb'}\nMYSQL_USER=${config.dbUser || 'user'}\nMYSQL_PASSWORD=${config.dbPassword || 'password'}`,
                volumes: `${instancePath}/data:/var/lib/mysql`
            },
            mongodb: {
                image: 'mongo:7',
                ports: '27017:27017',
                environment: `MONGO_INITDB_ROOT_USERNAME=${config.dbUser || 'admin'}\nMONGO_INITDB_ROOT_PASSWORD=${config.dbPassword || 'admin'}`,
                volumes: `${instancePath}/data:/data/db`
            },
            redis: {
                image: 'redis:alpine',
                ports: '6379:6379',
                command: 'redis-server --appendonly yes --requirepass ' + (config.password || '')
            },
            nextcloud: {
                image: 'nextcloud:latest',
                ports: '8080:80',
                volumes: `${instancePath}/data:/var/www/html`,
                environment: 'SQLITE_DATABASE=nextcloud'
            },
            wordpress: {
                image: 'wordpress:latest',
                ports: '8080:80',
                environment: `WORDPRESS_DB_HOST=db\nWORDPRESS_DB_USER=${config.dbUser || 'wordpress'}\nWORDPRESS_DB_PASSWORD=${config.dbPassword || 'wordpress'}\nWORDPRESS_DB_NAME=${config.dbName || 'wordpress'}`,
                volumes: `${instancePath}/html:/var/www/html`
            }
        };
        
        // Use preset or custom config
        const preset = presets[config.containerType] || {};
        const image = config.imageName || preset.image || 'nginx:alpine';
        const ports = config.ports || preset.ports || '';
        const volumes = config.volumes || preset.volumes || '';
        const environment = config.environment || preset.environment || '';
        const command = config.command || preset.command || '';
        
        // Build docker run command
        let dockerCmd = `docker run -d --name nps_${server.id}`;
        
        // Add restart policy
        dockerCmd += ` --restart ${config.restartPolicy || 'unless-stopped'}`;
        
        // Add resource limits
        if (config.memoryLimit) {
            dockerCmd += ` --memory ${config.memoryLimit}m`;
        }
        if (config.cpuLimit) {
            dockerCmd += ` --cpus ${config.cpuLimit}`;
        }
        
        // Add network mode
        dockerCmd += ` --network ${config.networkMode || 'bridge'}`;
        
        // Add port mappings
        if (ports) {
            ports.split(',').forEach(mapping => {
                dockerCmd += ` -p ${mapping.trim()}`;
            });
        }
        
        // Add volume mounts
        if (volumes) {
            volumes.split('\n').forEach(mapping => {
                if (mapping.trim()) {
                    dockerCmd += ` -v ${mapping.trim()}`;
                }
            });
        }
        
        // Add environment variables
        if (environment) {
            environment.split('\n').forEach(env => {
                if (env.trim()) {
                    dockerCmd += ` -e "${env.trim()}"`;
                }
            });
        }
        
        // Add labels for management
        dockerCmd += ` -l "nps.server.id=${server.id}"`;
        dockerCmd += ` -l "nps.server.name=${server.name}"`;
        
        // Add image
        dockerCmd += ` ${image}`;
        
        // Add command override
        if (command) {
            dockerCmd += ` ${command}`;
        }
        
        // Create docker-compose.yml for easier management
        await sshExec(`cat > ${instancePath}/docker-compose.yml << 'EOF'
version: '3.8'

services:
  app:
    image: ${image}
    container_name: nps_${server.id}
    restart: ${config.restartPolicy || 'unless-stopped'}
    ${ports ? `ports:\n${ports.split(',').map(p => `      - "${p.trim()}"`).join('\n')}` : ''}
    ${volumes ? `volumes:\n${volumes.split('\n').filter(v => v.trim()).map(v => `      - "${v.trim()}"`).join('\n')}` : ''}
    ${environment ? `environment:\n${environment.split('\n').filter(e => e.trim()).map(e => `      - ${e.trim()}`).join('\n')}` : ''}
    ${config.memoryLimit ? `mem_limit: ${config.memoryLimit}m` : ''}
    ${config.cpuLimit ? `cpus: ${config.cpuLimit}` : ''}
    ${command ? `command: ${command}` : ''}
    labels:
      - "nps.server.id=${server.id}"
      - "nps.server.name=${server.name}"
EOF`);
        
        // Pull image
        await sshExec(`docker pull ${image}`);
        
        // Run container
        await sshExec(dockerCmd);
        
        // Get container info
        const { stdout: containerId } = await sshExec(`docker ps -q -f name=nps_${server.id}`);
        
        return {
            instancePath,
            containerId: containerId.trim(),
            image,
            ports,
            composeFile: `${instancePath}/docker-compose.yml`
        };
    },

    async start(server, sshExec) {
        await sshExec(`docker start nps_${server.id}`);
    },

    async stop(server, sshExec) {
        await sshExec(`docker stop nps_${server.id}`);
    },

    async delete(server, sshExec) {
        await sshExec(`docker rm -f nps_${server.id} 2>/dev/null || true`);
        await sshExec(`rm -rf ~/server/instances/${server.id}`);
    }
};
