/**
 * Python Flask Web App Template - Production Grade
 * Features: Gunicorn WSGI server, SQLAlchemy ORM, CORS, error handling
 */

module.exports = {
    name: 'Python Flask App',
    description: 'Production-grade Flask web application with Gunicorn, database support, and monitoring',
    category: 'Web',
    icon: '🐍',
    defaultPort: 5000,
    requirements: ['python', 'pip'],
    
    // Resource requirements
    resources: {
        cpu: 8,
        memory: 256,
        priority: 'medium',
        bandwidth: { download: 5, upload: 5 }
    },
    
    configOptions: [
        { name: 'appName', label: 'App Name', type: 'text', required: true },
        { name: 'debug', label: 'Debug Mode', type: 'checkbox', default: false },
        { name: 'database', label: 'Enable Database', type: 'checkbox', default: false },
        { name: 'workers', label: 'Gunicorn Workers', type: 'number', default: 2 }
    ],

    async deploy(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        const workers = server.config.workers || 2;
        
        await sshExec(`mkdir -p ${instancePath}/{logs,static,templates,instance}`);
        
        // Production requirements with versions
        await sshExec(`cat > ${instancePath}/requirements.txt << 'EOF'
Flask==3.0.0
Flask-CORS==4.0.0
${server.config.database ? 'Flask-SQLAlchemy==3.1.1\nFlask-Migrate==4.0.5' : ''}
gunicorn==21.2.0
python-dotenv==1.0.0
EOF`);

        // Create production-grade Flask app
        await sshExec(`cat > ${instancePath}/app.py << 'EOF'
from flask import Flask, render_template, jsonify, request
${server.config.database ? 'from flask_sqlalchemy import SQLAlchemy\nfrom flask_migrate import Migrate' : ''}
from flask_cors import CORS
import os
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configuration
app.config['SECRET_KEY'] = os.urandom(24).hex()
app.config['JSON_SORT_KEYS'] = False

${server.config.database ? `
# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///${instancePath}/instance/database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
migrate = Migrate(app, db)

# Example model
class Item(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    value = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'value': self.value,
            'created_at': self.created_at.isoformat()
        }

# Create tables
with app.app_context():
    db.create_all()
` : ''}

# Logging configuration
if not app.debug:
    if not os.path.exists('logs'):
        os.mkdir('logs')
    file_handler = RotatingFileHandler('logs/app.log', maxBytes=10240000, backupCount=10)
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)
    app.logger.info('${server.config.appName} startup')

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    app.logger.error(f'Server Error: {error}')
    return jsonify({'error': 'Internal server error'}), 500

@app.errorhandler(Exception)
def handle_exception(e):
    app.logger.error(f'Unhandled exception: {str(e)}')
    return jsonify({'error': 'An unexpected error occurred'}), 500

# Routes
@app.route('/')
def index():
    return render_template('index.html', app_name='${server.config.appName}')

@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'app': '${server.config.appName}',
        'timestamp': datetime.utcnow().isoformat()
    })

@app.route('/api')
def api():
    return jsonify({
        'name': '${server.config.appName}',
        'status': 'running',
        'version': '1.0.0',
        'endpoints': {
            'GET /': 'Web interface',
            'GET /health': 'Health check',
            'GET /api': 'API information',
            'GET /api/data': 'Get all items',
            'POST /api/data': 'Create new item',
            'GET /api/data/<id>': 'Get specific item',
            'PUT /api/data/<id>': 'Update item',
            'DELETE /api/data/<id>': 'Delete item'
        }
    })

${server.config.database ? `
@app.route('/api/data', methods=['GET', 'POST'])
def data():
    if request.method == 'POST':
        try:
            data = request.get_json()
            if not data or 'name' not in data:
                return jsonify({'error': 'Name is required'}), 400
            
            item = Item(name=data['name'], value=data.get('value', ''))
            db.session.add(item)
            db.session.commit()
            
            return jsonify({'message': 'Item created', 'item': item.to_dict()}), 201
        except Exception as e:
            db.session.rollback()
            app.logger.error(f'Error creating item: {str(e)}')
            return jsonify({'error': 'Failed to create item'}), 500
    
    # GET
    try:
        items = Item.query.all()
        return jsonify({
            'data': [item.to_dict() for item in items],
            'count': len(items)
        })
    except Exception as e:
        app.logger.error(f'Error fetching items: {str(e)}')
        return jsonify({'error': 'Failed to fetch items'}), 500

@app.route('/api/data/<int:item_id>', methods=['GET', 'PUT', 'DELETE'])
def data_item(item_id):
    try:
        item = Item.query.get_or_404(item_id)
        
        if request.method == 'GET':
            return jsonify(item.to_dict())
        
        elif request.method == 'PUT':
            data = request.get_json()
            if 'name' in data:
                item.name = data['name']
            if 'value' in data:
                item.value = data['value']
            db.session.commit()
            return jsonify({'message': 'Item updated', 'item': item.to_dict()})
        
        elif request.method == 'DELETE':
            db.session.delete(item)
            db.session.commit()
            return jsonify({'message': 'Item deleted'}), 204
            
    except Exception as e:
        db.session.rollback()
        app.logger.error(f'Error with item {item_id}: {str(e)}')
        return jsonify({'error': 'Operation failed'}), 500
` : `
@app.route('/api/data', methods=['GET', 'POST'])
def data():
    if request.method == 'POST':
        return jsonify({'message': 'Data received', 'data': request.json})
    return jsonify({'data': 'Sample data', 'note': 'Enable database for persistence'})
`}

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=${server.port}, debug=${server.config.debug ? 'True' : 'False'})
EOF`);

        // Create modern template
        await sshExec(`cat > ${instancePath}/templates/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>{{ app_name }}</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container { text-align: center; padding: 2rem; max-width: 800px; }
        h1 { font-size: 3.5rem; margin-bottom: 1rem; font-weight: 700; }
        p { font-size: 1.3rem; opacity: 0.9; margin-bottom: 2rem; }
        .links { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
        .link { 
            display: inline-block;
            padding: 1rem 2rem;
            background: white;
            color: #667eea;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .link:hover { 
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        }
        .status {
            margin-top: 3rem;
            padding: 1rem;
            background: rgba(255,255,255,0.1);
            border-radius: 8px;
            backdrop-filter: blur(10px);
        }
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            background: #4ade80;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 {{ app_name }}</h1>
        <p>Your Flask application is running!</p>
        <div class="links">
            <a href="/api" class="link">📡 API Documentation</a>
            <a href="/health" class="link">💚 Health Check</a>
            <a href="/api/data" class="link">📊 Data Endpoint</a>
        </div>
        <div class="status">
            <span class="status-indicator"></span>
            <strong>Server Status:</strong> Online
        </div>
    </div>
</body>
</html>
EOF`);

        // Create Gunicorn config
        await sshExec(`cat > ${instancePath}/gunicorn.conf.py << 'EOF'
# Gunicorn configuration
bind = "0.0.0.0:${server.port}"
workers = ${workers}
worker_class = "sync"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50
timeout = 30
keepalive = 2

# Logging
accesslog = "${instancePath}/logs/access.log"
errorlog = "${instancePath}/logs/error.log"
loglevel = "info"
access_log_format = '%%(h)s %%(l)s %%(u)s %%(t)s "%%(r)s" %%(s)s %%(b)s "%%(f)s" "%%(a)s"'

# Process naming
proc_name = "${server.config.appName}"

# Server mechanics
daemon = False
pidfile = "${instancePath}/logs/gunicorn.pid"
umask = 0
user = None
group = None
tmp_upload_dir = None

# SSL (if needed)
# keyfile = None
# certfile = None
EOF`);

        // Install dependencies
        console.log('Installing Flask dependencies...');
        await sshExec(`cd ${instancePath} && pip install -r requirements.txt`);
        
        // Initialize database if enabled
        if (server.config.database) {
            await sshExec(`cd ${instancePath} && python -c "from app import app, db; app.app_context().push(); db.create_all()"`);
        }
        
        // Start with Gunicorn
        await sshExec(`cd ${instancePath} && nohup gunicorn -c gunicorn.conf.py app:app > logs/gunicorn.log 2>&1 & echo $! > logs/server.pid`);
        
        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Get PID
        const { stdout: pidOut } = await sshExec(`cat ${instancePath}/logs/server.pid`);
        const pid = parseInt(pidOut.trim());
        
        return { 
            instancePath, 
            port: server.port,
            workers,
            database: server.config.database,
            pid,
            endpoints: {
                health: \`http://localhost:\${server.port}/health\`,
                api: \`http://localhost:\${server.port}/api\`,
                web: \`http://localhost:\${server.port}/\`
            }
        };
    },

    async start(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`cd ${instancePath} && nohup python app.py > logs/server.log 2>&1 & echo $! > logs/server.pid`);
    },

    async stop(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`kill $(cat ${instancePath}/logs/server.pid) 2>/dev/null || true`);
    },

    async delete(server, sshExec) {
        await this.stop(server, sshExec);
        await sshExec(`rm -rf ~/server/instances/${server.id}`);
    }
};
