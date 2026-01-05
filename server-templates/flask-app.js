/**
 * Python Flask Web App Template
 */

module.exports = {
    name: 'Python Flask App',
    description: 'Full-featured Flask web application with templates',
    category: 'Web',
    icon: '🐍',
    defaultPort: 5000,
    requirements: ['python', 'pip'],
    
    configOptions: [
        { name: 'appName', label: 'App Name', type: 'text', required: true },
        { name: 'debug', label: 'Debug Mode', type: 'checkbox', default: false },
        { name: 'database', label: 'Enable Database', type: 'checkbox', default: false }
    ],

    async deploy(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        
        await sshExec(`mkdir -p ${instancePath}/{logs,static,templates}`);
        
        // Requirements
        await sshExec(`cat > ${instancePath}/requirements.txt << 'EOF'
Flask==3.0.0
Flask-CORS==4.0.0
${server.config.database ? 'Flask-SQLAlchemy==3.1.1' : ''}
gunicorn==21.2.0
EOF`);

        // Create app
        await sshExec(`cat > ${instancePath}/app.py << 'EOF'
from flask import Flask, render_template, jsonify, request
${server.config.database ? 'from flask_sqlalchemy import SQLAlchemy' : ''}
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

${server.config.database ? `
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///${instancePath}/database.db'
db = SQLAlchemy(app)

class Item(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    value = db.Column(db.String(200))

with app.app_context():
    db.create_all()
` : ''}

@app.route('/')
def index():
    return render_template('index.html', app_name='${server.config.appName}')

@app.route('/api')
def api():
    return jsonify({
        'name': '${server.config.appName}',
        'status': 'running',
        'version': '1.0.0'
    })

@app.route('/api/data', methods=['GET', 'POST'])
def data():
    if request.method == 'POST':
        return jsonify({'message': 'Data received', 'data': request.json})
    return jsonify({'data': 'Sample data'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=${server.port}, debug=${server.config.debug ? 'True' : 'False'})
EOF`);

        // Create template
        await sshExec(`cat > ${instancePath}/templates/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>{{ app_name }}</title>
    <style>
        body { font-family: Arial; margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .container { text-align: center; padding: 2rem; }
        h1 { font-size: 3rem; margin-bottom: 1rem; }
        p { font-size: 1.2rem; opacity: 0.9; }
        .api-link { display: inline-block; margin-top: 2rem; padding: 1rem 2rem; background: white; color: #667eea; text-decoration: none; border-radius: 8px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 {{ app_name }}</h1>
        <p>Your Flask application is running!</p>
        <a href="/api" class="api-link">View API</a>
    </div>
</body>
</html>
EOF`);

        await sshExec(`cd ${instancePath} && pip install -r requirements.txt`);
        await sshExec(`cd ${instancePath} && nohup python app.py > logs/server.log 2>&1 & echo $! > logs/server.pid`);
        
        return { instancePath, port: server.port };
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
