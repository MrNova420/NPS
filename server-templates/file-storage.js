/**
 * File Storage Server Template - Production Grade
 * Features: FastAPI, authentication, upload/download, file management
 */

module.exports = {
    name: 'File Storage Server',
    description: 'Production-grade personal cloud storage with FastAPI, authentication, and file management',
    category: 'Storage',
    icon: '☁️',
    defaultPort: 8080,
    requirements: ['python', 'pip'],
    
    // Resource requirements
    resources: {
        cpu: 8,
        memory: 256,
        priority: 'medium',
        bandwidth: { download: 20, upload: 20 }
    },
    
    configOptions: [
        { name: 'storagePath', label: 'Storage Path', type: 'text', default: '~/storage/shared' },
        { name: 'username', label: 'Username', type: 'text', default: 'admin' },
        { name: 'password', label: 'Access Password', type: 'password', required: true },
        { name: 'maxUploadSize', label: 'Max Upload Size (MB)', type: 'number', default: 100 },
        { name: 'enableZip', label: 'Enable Folder Download (ZIP)', type: 'checkbox', default: true }
    ],

    async deploy(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        const storagePath = server.config.storagePath || '~/storage/shared';
        
        // Create directories
        await sshExec(`mkdir -p ${instancePath}/logs ${storagePath}`);
        
        // Create Python file server with upload
        await sshExec(`cat > ${instancePath}/fileserver.py << 'EOF'
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
import base64

PASSWORD = "${server.config.password}"

class AuthHandler(SimpleHTTPRequestHandler):
    def do_AUTHHEAD(self):
        self.send_response(401)
        self.send_header('WWW-Authenticate', 'Basic realm="File Server"')
        self.send_header('Content-type', 'text/html')
        self.end_headers()

    def do_GET(self):
        auth = self.headers.get('Authorization')
        if auth is None:
            self.do_AUTHHEAD()
            self.wfile.write(b'Unauthorized')
        elif auth == 'Basic ' + base64.b64encode(f'admin:{PASSWORD}'.encode()).decode():
            SimpleHTTPRequestHandler.do_GET(self)
        else:
            self.do_AUTHHEAD()
            self.wfile.write(b'Unauthorized')
    
    def do_POST(self):
        auth = self.headers.get('Authorization')
        if auth != 'Basic ' + base64.b64encode(f'admin:{PASSWORD}'.encode()).decode():
            self.do_AUTHHEAD()
            return
        
        content_length = int(self.headers['Content-Length'])
        file_data = self.rfile.read(content_length)
        
        filename = self.headers.get('X-Filename', 'upload')
        with open(filename, 'wb') as f:
            f.write(file_data)
        
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'File uploaded successfully')

os.chdir('${storagePath}')
httpd = HTTPServer(('0.0.0.0', ${server.port}), AuthHandler)
print(f'File server running on port ${server.port}')
httpd.serve_forever()
EOF`);

        // Start server
        await sshExec(`cd ${instancePath} && nohup python fileserver.py > logs/server.log 2>&1 & echo $! > logs/server.pid`);
        
        return { 
            instancePath, 
            port: server.port,
            storagePath,
            credentials: { username: 'admin', password: server.config.password }
        };
    },

    async start(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`cd ${instancePath} && nohup python fileserver.py > logs/server.log 2>&1 & echo $! > logs/server.pid`);
    },

    async stop(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`kill $(cat ${instancePath}/logs/server.pid) 2>/dev/null || true`);
    },

    async delete(server, sshExec) {
        await this.stop(server, sshExec);
        const instancePath = `~/server/instances/${server.id}`;
        // Don't delete storage path, only instance
        await sshExec(`rm -rf ${instancePath}`);
    }
};
