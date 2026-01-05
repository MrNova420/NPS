/**
 * CI/CD Pipeline Template
 * Complete CI/CD solution with Git, Jenkins/GitLab CI, automated testing and deployment
 */

module.exports = {
    name: 'CI/CD Pipeline',
    description: 'Automated CI/CD pipeline with Git hooks, build automation, testing, and deployment',
    category: 'DevOps',
    icon: '🔄',
    defaultPort: 8080,
    requirements: ['git', 'nodejs', 'python3', 'docker'],
    
    configOptions: [
        { 
            name: 'pipelineType', 
            label: 'Pipeline Type', 
            type: 'select',
            options: ['jenkins', 'gitlab-ci', 'gitea', 'drone'],
            required: true,
            default: 'jenkins'
        },
        {
            name: 'gitRepo',
            label: 'Git Repository Name',
            type: 'text',
            required: true,
            placeholder: 'my-project'
        },
        {
            name: 'buildCommand',
            label: 'Build Command',
            type: 'text',
            default: 'npm run build',
            placeholder: 'npm run build'
        },
        {
            name: 'testCommand',
            label: 'Test Command',
            type: 'text',
            default: 'npm test',
            placeholder: 'npm test'
        },
        {
            name: 'deployTarget',
            label: 'Deploy Target',
            type: 'text',
            placeholder: '/var/www/html'
        },
        {
            name: 'enableWebhooks',
            label: 'Enable Git Webhooks',
            type: 'checkbox',
            default: true
        },
        {
            name: 'slackWebhook',
            label: 'Slack Webhook URL (optional)',
            type: 'text',
            placeholder: 'https://hooks.slack.com/...'
        },
        {
            name: 'emailNotify',
            label: 'Email Notifications',
            type: 'text',
            placeholder: 'dev@example.com'
        }
    ],

    async deploy(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        const config = server.config;
        
        await sshExec(`mkdir -p ${instancePath}/{repos,builds,logs,scripts}`);

        // Install base packages
        await sshExec(`
            pkg install -y git openssh
        `);

        if (config.pipelineType === 'jenkins') {
            await this.deployJenkins(server, sshExec, instancePath);
        } else if (config.pipelineType === 'gitlab-ci') {
            await this.deployGitLabRunner(server, sshExec, instancePath);
        } else if (config.pipelineType === 'gitea') {
            await this.deployGitea(server, sshExec, instancePath);
        } else if (config.pipelineType === 'drone') {
            await this.deployDrone(server, sshExec, instancePath);
        }

        // Create Git repository
        await sshExec(`
            cd ${instancePath}/repos
            git init --bare ${config.gitRepo}.git
        `);

        // Create post-receive hook
        const hookScript = this.generatePostReceiveHook(config, instancePath);
        await sshExec(`cat > ${instancePath}/repos/${config.gitRepo}.git/hooks/post-receive << 'HOOK_EOF'
${hookScript}
HOOK_EOF`);
        await sshExec(`chmod +x ${instancePath}/repos/${config.gitRepo}.git/hooks/post-receive`);

        // Create pipeline configuration
        await this.createPipelineConfig(server, sshExec, instancePath);

        // Create webhook server if enabled
        if (config.enableWebhooks) {
            await this.createWebhookServer(server, sshExec, instancePath);
        }

        // Create deployment script
        await this.createDeploymentScript(server, sshExec, instancePath);

        // Create status dashboard
        await this.createStatusDashboard(server, sshExec, instancePath);

        console.log(`CI/CD Pipeline deployed at ${instancePath}`);
    },

    async deployJenkins(server, sshExec, instancePath) {
        // Simplified Jenkins alternative using Node.js
        await sshExec(`cat > ${instancePath}/jenkins-server.js << 'JENKINS_EOF'
const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const app = express();

app.use(express.json());
app.use(express.static('public'));

const jobs = new Map();
const buildHistory = [];

app.post('/job/:name/build', async (req, res) => {
    const jobName = req.params.name;
    const buildId = Date.now();
    
    const build = {
        id: buildId,
        job: jobName,
        status: 'running',
        startTime: new Date(),
        logs: []
    };
    
    buildHistory.push(build);
    
    res.json({ build: buildId, status: 'started' });
    
    // Run build
    exec('bash scripts/build.sh', { cwd: __dirname }, (error, stdout, stderr) => {
        build.status = error ? 'failed' : 'success';
        build.endTime = new Date();
        build.logs = stdout + stderr;
        
        if ('${server.config.slackWebhook}') {
            notifySlack(build);
        }
    });
});

app.get('/job/:name/builds', (req, res) => {
    const jobBuilds = buildHistory.filter(b => b.job === req.params.name);
    res.json(jobBuilds);
});

app.get('/dashboard', (req, res) => {
    res.json({
        builds: buildHistory.slice(-20),
        stats: {
            total: buildHistory.length,
            success: buildHistory.filter(b => b.status === 'success').length,
            failed: buildHistory.filter(b => b.status === 'failed').length
        }
    });
});

function notifySlack(build) {
    const webhook = '${server.config.slackWebhook}';
    if (!webhook) return;
    
    const payload = {
        text: \`Build \${build.status}: \${build.job} #\${build.id}\`,
        color: build.status === 'success' ? 'good' : 'danger'
    };
    
    exec(\`curl -X POST -H 'Content-type: application/json' --data '\${JSON.stringify(payload)}' \${webhook}\`);
}

const PORT = ${server.port};
app.listen(PORT, () => console.log(\`Jenkins-like CI running on port \${PORT}\`));
JENKINS_EOF`);

        // Install dependencies
        await sshExec(`cd ${instancePath} && npm install express`);
    },

    async deployGitLabRunner(server, sshExec, instancePath) {
        await sshExec(`cat > ${instancePath}/.gitlab-ci.yml << 'GITLAB_EOF'
stages:
  - build
  - test
  - deploy

build:
  stage: build
  script:
    - ${server.config.buildCommand}
  artifacts:
    paths:
      - build/
      - dist/

test:
  stage: test
  script:
    - ${server.config.testCommand}

deploy:
  stage: deploy
  script:
    - bash scripts/deploy.sh
  only:
    - main
    - master
GITLAB_EOF`);
    },

    async deployGitea(server, sshExec, instancePath) {
        // Lightweight Git server with actions
        await sshExec(`cat > ${instancePath}/gitea-runner.js << 'GITEA_EOF'
const express = require('express');
const { exec } = require('child_process');
const app = express();

app.use(express.json());

app.post('/webhook', (req, res) => {
    const event = req.body;
    
    if (event.ref === 'refs/heads/main' || event.ref === 'refs/heads/master') {
        console.log('Triggering build...');
        exec('bash scripts/build.sh && bash scripts/test.sh && bash scripts/deploy.sh', 
            (error, stdout, stderr) => {
                if (error) {
                    console.error('Build failed:', error);
                } else {
                    console.log('Build successful');
                }
            }
        );
    }
    
    res.json({ status: 'accepted' });
});

app.listen(${server.port}, () => console.log('Gitea runner active'));
GITEA_EOF`);

        await sshExec(`cd ${instancePath} && npm install express`);
    },

    async deployDrone(server, sshExec, instancePath) {
        await sshExec(`cat > ${instancePath}/.drone.yml << 'DRONE_EOF'
kind: pipeline
name: default

steps:
  - name: build
    image: node:18
    commands:
      - ${server.config.buildCommand}

  - name: test
    image: node:18
    commands:
      - ${server.config.testCommand}

  - name: deploy
    image: alpine
    commands:
      - sh scripts/deploy.sh
    when:
      branch:
        - main
        - master
DRONE_EOF`);
    },

    generatePostReceiveHook(config, instancePath) {
        return `#!/bin/bash
# Post-receive hook for automated CI/CD

echo "========================================="
echo "Starting CI/CD Pipeline"
echo "========================================="

# Get the branch name
while read oldrev newrev refname; do
    branch=\$(echo \$refname | sed 's/refs\\/heads\\///')
    
    if [ "\$branch" = "main" ] || [ "\$branch" = "master" ]; then
        echo "Building branch: \$branch"
        
        # Clone to build directory
        BUILD_DIR="${instancePath}/builds/\$(date +%Y%m%d_%H%M%S)"
        mkdir -p \$BUILD_DIR
        git --work-tree=\$BUILD_DIR --git-dir=\$PWD checkout -f
        
        cd \$BUILD_DIR
        
        # Run build
        echo "Running build command..."
        ${config.buildCommand} 2>&1 | tee ${instancePath}/logs/build.log
        
        if [ \$? -eq 0 ]; then
            echo "✓ Build successful"
            
            # Run tests
            echo "Running tests..."
            ${config.testCommand} 2>&1 | tee ${instancePath}/logs/test.log
            
            if [ \$? -eq 0 ]; then
                echo "✓ Tests passed"
                
                # Deploy
                echo "Deploying..."
                bash ${instancePath}/scripts/deploy.sh 2>&1 | tee ${instancePath}/logs/deploy.log
                
                if [ \$? -eq 0 ]; then
                    echo "✓ Deployment successful"
                else
                    echo "✗ Deployment failed"
                fi
            else
                echo "✗ Tests failed"
            fi
        else
            echo "✗ Build failed"
        fi
    fi
done

echo "========================================="
echo "CI/CD Pipeline Complete"
echo "========================================="
`;
    },

    async createPipelineConfig(server, sshExec, instancePath) {
        const config = server.config;
        
        await sshExec(`cat > ${instancePath}/pipeline.json << 'CONFIG_EOF'
{
  "name": "${config.gitRepo}",
  "type": "${config.pipelineType}",
  "stages": {
    "build": {
      "command": "${config.buildCommand}",
      "timeout": 600
    },
    "test": {
      "command": "${config.testCommand}",
      "timeout": 300
    },
    "deploy": {
      "target": "${config.deployTarget || '/tmp/deploy'}",
      "timeout": 300
    }
  },
  "notifications": {
    "email": "${config.emailNotify || ''}",
    "slack": "${config.slackWebhook || ''}"
  }
}
CONFIG_EOF`);
    },

    async createWebhookServer(server, sshExec, instancePath) {
        await sshExec(`cat > ${instancePath}/webhook-server.js << 'WEBHOOK_EOF'
const express = require('express');
const { exec } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
app.use(express.json());

const logFile = '${instancePath}/logs/webhooks.log';

app.post('/webhook', (req, res) => {
    const event = req.body;
    const timestamp = new Date().toISOString();
    
    fs.appendFileSync(logFile, \`[\${timestamp}] Webhook received\\n\`);
    fs.appendFileSync(logFile, JSON.stringify(event, null, 2) + '\\n');
    
    // Trigger pipeline
    exec('bash ${instancePath}/scripts/build.sh', (error, stdout, stderr) => {
        if (error) {
            fs.appendFileSync(logFile, \`Error: \${error.message}\\n\`);
        } else {
            fs.appendFileSync(logFile, \`Success: Pipeline triggered\\n\`);
        }
    });
    
    res.json({ status: 'received', timestamp });
});

app.get('/status', (req, res) => {
    const logs = fs.readFileSync(logFile, 'utf8').split('\\n').slice(-50);
    res.json({ status: 'running', recentLogs: logs });
});

app.listen(${server.port}, () => {
    console.log('Webhook server running on port ${server.port}');
    fs.appendFileSync(logFile, \`[\${new Date().toISOString()}] Webhook server started\\n\`);
});
WEBHOOK_EOF`);

        await sshExec(`cd ${instancePath} && npm install express`);
    },

    async createDeploymentScript(server, sshExec, instancePath) {
        await sshExec(`cat > ${instancePath}/scripts/deploy.sh << 'DEPLOY_EOF'
#!/bin/bash
# Automated deployment script

set -e

echo "Starting deployment..."

# Variables
DEPLOY_TARGET="${server.config.deployTarget || '/tmp/deploy'}"
BUILD_DIR="\$(pwd)"
BACKUP_DIR="${instancePath}/backups/\$(date +%Y%m%d_%H%M%S)"

# Backup current deployment
if [ -d "\$DEPLOY_TARGET" ]; then
    echo "Creating backup..."
    mkdir -p "${instancePath}/backups"
    cp -r "\$DEPLOY_TARGET" "\$BACKUP_DIR"
fi

# Deploy new build
echo "Deploying to \$DEPLOY_TARGET..."
mkdir -p "\$DEPLOY_TARGET"
cp -r * "\$DEPLOY_TARGET/"

# Restart services if needed
if [ -f "\$DEPLOY_TARGET/package.json" ]; then
    cd "\$DEPLOY_TARGET"
    npm install --production
    
    # Restart with pm2 if available
    if command -v pm2 &> /dev/null; then
        pm2 restart all || pm2 start npm -- start
    fi
fi

echo "Deployment complete!"
DEPLOY_EOF`);

        await sshExec(`chmod +x ${instancePath}/scripts/deploy.sh`);

        // Create build script
        await sshExec(`cat > ${instancePath}/scripts/build.sh << 'BUILD_EOF'
#!/bin/bash
set -e
echo "Running build..."
${server.config.buildCommand}
echo "Build complete!"
BUILD_EOF`);
        await sshExec(`chmod +x ${instancePath}/scripts/build.sh`);

        // Create test script
        await sshExec(`cat > ${instancePath}/scripts/test.sh << 'TEST_EOF'
#!/bin/bash
set -e
echo "Running tests..."
${server.config.testCommand}
echo "Tests complete!"
TEST_EOF`);
        await sshExec(`chmod +x ${instancePath}/scripts/test.sh`);
    },

    async createStatusDashboard(server, sshExec, instancePath) {
        await sshExec(`cat > ${instancePath}/dashboard.html << 'DASH_EOF'
<!DOCTYPE html>
<html>
<head>
    <title>CI/CD Pipeline - ${server.config.gitRepo}</title>
    <style>
        body { font-family: Arial; margin: 20px; background: #1e1e1e; color: #fff; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #2d2d2d; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: #2d2d2d; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 32px; font-weight: bold; margin: 10px 0; }
        .success { color: #4caf50; }
        .failed { color: #f44336; }
        .running { color: #2196f3; }
        .builds { background: #2d2d2d; padding: 20px; border-radius: 8px; }
        .build-item { padding: 15px; border-bottom: 1px solid #444; display: flex; justify-content: space-between; }
        .build-item:last-child { border-bottom: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔄 CI/CD Pipeline</h1>
            <p>Repository: ${server.config.gitRepo} | Type: ${server.config.pipelineType}</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div>Total Builds</div>
                <div class="stat-value" id="total">0</div>
            </div>
            <div class="stat-card">
                <div class="success">Successful</div>
                <div class="stat-value success" id="success">0</div>
            </div>
            <div class="stat-card">
                <div class="failed">Failed</div>
                <div class="stat-value failed" id="failed">0</div>
            </div>
            <div class="stat-card">
                <div class="running">Running</div>
                <div class="stat-value running" id="running">0</div>
            </div>
        </div>
        
        <div class="builds">
            <h2>Recent Builds</h2>
            <div id="build-list"></div>
        </div>
    </div>
    
    <script>
        // Update dashboard periodically
        setInterval(updateDashboard, 5000);
        updateDashboard();
        
        function updateDashboard() {
            // This would fetch real data from the CI server
            console.log('Dashboard updated');
        }
    </script>
</body>
</html>
DASH_EOF`);
    },

    async start(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        
        if (server.config.pipelineType === 'jenkins') {
            await sshExec(`cd ${instancePath} && nohup node jenkins-server.js > logs/server.log 2>&1 & echo $! > server.pid`);
        } else if (server.config.enableWebhooks) {
            await sshExec(`cd ${instancePath} && nohup node webhook-server.js > logs/webhook.log 2>&1 & echo $! > webhook.pid`);
        }
    },

    async stop(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`cd ${instancePath} && [ -f server.pid ] && kill $(cat server.pid) || true`);
        await sshExec(`cd ${instancePath} && [ -f webhook.pid ] && kill $(cat webhook.pid) || true`);
    },

    async delete(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await this.stop(server, sshExec);
        await sshExec(`rm -rf ${instancePath}`);
    }
};
