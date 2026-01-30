"""
BlueClue AI Classification API
Flask application providing ticket classification endpoints.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import os
from dotenv import load_dotenv

# Add src to path for imports
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / 'src'))

from classifier import TicketClassifier

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
classifier = TicketClassifier()

# Get port from environment or default to 5000
PORT = int(os.getenv('PORT', 5000))


@app.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint to verify the API is running.
    
    Returns:
        JSON response with status, message, and timestamp
    """
    return jsonify({
        'status': 'OK',
        'message': 'BlueClue AI Classification API is running',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0'
    }), 200


@app.route('/classify', methods=['POST'])
def classify_ticket():
    """
    Classify a support ticket's category and priority.
    
    Expected JSON body:
    {
        "text": "The ticket description text"
    }
    
    Returns:
        JSON response with classification results
    """
    try:
        # Validate request has JSON data
        if not request.is_json:
            return jsonify({
                'error': 'Request must be JSON',
                'message': 'Content-Type must be application/json'
            }), 400
        
        data = request.get_json()
        
        # Validate required field
        if 'text' not in data or not data['text']:
            return jsonify({
                'error': 'Missing required field',
                'message': 'Request body must include "text" field with ticket description'
            }), 400
        
        ticket_text = data['text']
        
        # Perform classification
        result = classifier.classify(ticket_text)
        
        # Add metadata to response
        response = {
            'success': True,
            'input': ticket_text,
            'classification': result,
            'timestamp': datetime.now().isoformat()
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        # Log error and return 500
        app.logger.error(f"Classification error: {str(e)}")
        return jsonify({
            'error': 'Classification failed',
            'message': str(e)
        }), 500


@app.route('/', methods=['GET'])
def root():
    """
    Root endpoint with API information.
    """
    return jsonify({
        'name': 'BlueClue AI Classification API',
        'version': '1.0.0',
        'endpoints': {
            'health': '/health',
            'classify': '/classify (POST)'
        },
        'documentation': 'See README.md for usage details'
    }), 200


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({
        'error': 'Not Found',
        'message': 'The requested endpoint does not exist'
    }), 404


@app.errorhandler(405)
def method_not_allowed(error):
    """Handle 405 errors."""
    return jsonify({
        'error': 'Method Not Allowed',
        'message': 'The HTTP method is not allowed for this endpoint'
    }), 405


if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=PORT,
        debug=True
    )
