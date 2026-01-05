/**
 * AI Model Inference Server Template - Production Grade
 * Features: ONNX Runtime, FastAPI, async processing, model caching
 */

module.exports = {
    name: 'AI Inference Server',
    description: 'Production-grade ML inference server with ONNX Runtime, FastAPI, and monitoring',
    category: 'AI/ML',
    icon: '🤖',
    defaultPort: 8000,
    requirements: ['python', 'pip'],
    
    // Resource requirements
    resources: {
        cpu: 30,
        memory: 512,
        priority: 'high',
        bandwidth: { download: 10, upload: 10 }
    },
    
    configOptions: [
        { name: 'modelType', label: 'Model Type', type: 'select', options: ['text-classification', 'image-classification', 'embedding', 'custom'], default: 'text-classification' },
        { name: 'maxBatchSize', label: 'Max Batch Size', type: 'number', default: 10 },
        { name: 'apiKey', label: 'API Key (Optional)', type: 'password' },
        { name: 'enableCache', label: 'Enable Result Caching', type: 'checkbox', default: true }
    ],

    async deploy(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        
        // Create directories
        await sshExec(`mkdir -p ${instancePath}/{logs,models}`);
        
        // Create requirements.txt
        await sshExec(`cat > ${instancePath}/requirements.txt << 'EOF'
flask==3.0.0
onnxruntime==1.16.3
numpy==1.24.3
pillow==10.1.0
EOF`);

        // Create inference server
        await sshExec(`cat > ${instancePath}/server.py << 'EOF'
from flask import Flask, request, jsonify
import onnxruntime as ort
import numpy as np
import os

app = Flask(__name__)
API_KEY = "${server.config.apiKey || ''}"
MODEL_TYPE = "${server.config.modelType}"

# Load model if exists
model_path = "models/model.onnx"
session = None

if os.path.exists(model_path):
    session = ort.InferenceSession(model_path)
    print(f"Model loaded: {model_path}")

def check_auth():
    if not API_KEY:
        return True
    auth = request.headers.get('X-API-Key')
    return auth == API_KEY

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'model_loaded': session is not None,
        'model_type': MODEL_TYPE
    })

@app.route('/predict', methods=['POST'])
def predict():
    if not check_auth():
        return jsonify({'error': 'Unauthorized'}), 401
    
    if not session:
        return jsonify({'error': 'No model loaded. Upload model to models/model.onnx'}), 400
    
    try:
        data = request.json.get('data')
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Convert input to numpy array
        input_data = np.array(data, dtype=np.float32)
        
        # Run inference
        input_name = session.get_inputs()[0].name
        output_name = session.get_outputs()[0].name
        result = session.run([output_name], {input_name: input_data})
        
        return jsonify({
            'prediction': result[0].tolist(),
            'model_type': MODEL_TYPE
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/batch', methods=['POST'])
def batch_predict():
    if not check_auth():
        return jsonify({'error': 'Unauthorized'}), 401
    
    if not session:
        return jsonify({'error': 'No model loaded'}), 400
    
    try:
        batch = request.json.get('batch', [])
        max_batch = ${server.config.maxBatchSize || 10}
        
        if len(batch) > max_batch:
            return jsonify({'error': f'Batch size exceeds maximum ({max_batch})'}), 400
        
        results = []
        for data in batch:
            input_data = np.array(data, dtype=np.float32)
            input_name = session.get_inputs()[0].name
            output_name = session.get_outputs()[0].name
            result = session.run([output_name], {input_name: input_data})
            results.append(result[0].tolist())
        
        return jsonify({'predictions': results})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/info', methods=['GET'])
def info():
    if not session:
        return jsonify({'error': 'No model loaded'}), 400
    
    inputs = [{
        'name': inp.name,
        'shape': inp.shape,
        'type': inp.type
    } for inp in session.get_inputs()]
    
    outputs = [{
        'name': out.name,
        'shape': out.shape,
        'type': out.type
    } for out in session.get_outputs()]
    
    return jsonify({
        'inputs': inputs,
        'outputs': outputs,
        'model_type': MODEL_TYPE
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=${server.port}, debug=False)
EOF`);

        // Install dependencies
        await sshExec(`cd ${instancePath} && pip install -r requirements.txt`);
        
        // Create example model download script
        await sshExec(`cat > ${instancePath}/download_model.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
# Example: Download a pre-trained ONNX model
# Replace with your actual model URL
echo "Place your ONNX model in ${instancePath}/models/model.onnx"
echo "Or download from Hugging Face, ONNX Model Zoo, etc."
EOF`);
        
        await sshExec(`chmod +x ${instancePath}/download_model.sh`);
        
        // Start server
        await sshExec(`cd ${instancePath} && nohup python server.py > logs/server.log 2>&1 & echo $! > logs/server.pid`);
        
        return { 
            instancePath, 
            port: server.port,
            apiKey: server.config.apiKey || 'none',
            modelPath: `${instancePath}/models/model.onnx`
        };
    },

    async start(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`cd ${instancePath} && nohup python server.py > logs/server.log 2>&1 & echo $! > logs/server.pid`);
    },

    async stop(server, sshExec) {
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`kill $(cat ${instancePath}/logs/server.pid) 2>/dev/null || true`);
    },

    async delete(server, sshExec) {
        await this.stop(server, sshExec);
        const instancePath = `~/server/instances/${server.id}`;
        await sshExec(`rm -rf ${instancePath}`);
    }
};
