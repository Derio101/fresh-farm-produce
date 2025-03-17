from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import requests
import json
import re
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuration
API_KEY = os.getenv('OPENAI_API_KEY') or os.getenv('ANTHROPIC_API_KEY')
API_PROVIDER = os.getenv('API_PROVIDER', 'openai').lower()  # 'openai' or 'anthropic' or other providers
API_MODEL = os.getenv('API_MODEL', 'gpt-3.5-turbo')  # Default model
API_TIMEOUT = int(os.getenv('API_TIMEOUT', '15'))  # Default timeout in seconds

# API endpoints for different providers
API_ENDPOINTS = {
    'openai': 'https://api.openai.com/v1/chat/completions',
    'anthropic': 'https://api.anthropic.com/v1/messages',
    # Add other API providers here as needed
}

@app.route('/api/status', methods=['GET'])
def status():
    """Check if the API is running and configured"""
    if not API_KEY:
        return jsonify({
            'status': 'error', 
            'message': 'API key not configured. Please set the API key in environment variables.'
        }), 400
    
    if API_PROVIDER not in API_ENDPOINTS:
        return jsonify({
            'status': 'error', 
            'message': f'Unknown API provider: {API_PROVIDER}. Supported providers: {", ".join(API_ENDPOINTS.keys())}'
        }), 400
    
    # Everything is OK
    return jsonify({
        'status': 'ok',
        'message': f'AI API is running and configured for {API_PROVIDER}',
        'model': API_MODEL,
        'provider': API_PROVIDER
    })

@app.route('/api/analyze', methods=['POST'])
def analyze_message():
    """Analyze a message for sentiment, keywords, and generate a summary"""
    data = request.json
    
    if not data or 'message' not in data:
        return jsonify({
            'error': True,
            'message': 'No message provided'
        }), 400
    
    message = data['message']
    options = data.get('options', {
        'includeKeywords': True,
        'includeSentiment': True,
        'includeSummary': True
    })
    
    try:
        if API_PROVIDER == 'openai':
            result = analyze_with_openai(message, options)
        elif API_PROVIDER == 'anthropic':
            result = analyze_with_anthropic(message, options)
        else:
            return jsonify({
                'error': True,
                'message': f'Unsupported API provider: {API_PROVIDER}'
            }), 400
        
        return jsonify(result)
    
    except Exception as e:
        print(f"Error analyzing message: {str(e)}")
        return jsonify({
            'error': True,
            'message': f'Error analyzing message: {str(e)}'
        }), 500

def analyze_with_openai(message, options):
    """Analyze message using OpenAI API"""
    prompt = create_analysis_prompt(message, options)
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {API_KEY}'
    }
    
    payload = {
        'model': API_MODEL,
        'messages': [{'role': 'user', 'content': prompt}],
        'temperature': 0.1  # Low temperature for more consistent responses
    }
    
    response = requests.post(
        API_ENDPOINTS['openai'],
        headers=headers,
        data=json.dumps(payload),
        timeout=API_TIMEOUT
    )
    
    if response.status_code != 200:
        raise Exception(f"API Error: {response.status_code} - {response.text}")
    
    result = response.json()
    ai_response = result['choices'][0]['message']['content'].strip()
    
    return parse_ai_response(ai_response)

def analyze_with_anthropic(message, options):
    """Analyze message using Anthropic API"""
    prompt = create_analysis_prompt(message, options)
    
    headers = {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
    }
    
    payload = {
        'model': API_MODEL,
        'max_tokens': 500,
        'messages': [{'role': 'user', 'content': prompt}],
        'temperature': 0.1  # Low temperature for more consistent responses
    }
    
    response = requests.post(
        API_ENDPOINTS['anthropic'],
        headers=headers,
        data=json.dumps(payload),
        timeout=API_TIMEOUT
    )
    
    if response.status_code != 200:
        raise Exception(f"API Error: {response.status_code} - {response.text}")
    
    result = response.json()
    ai_response = result['content'][0]['text'].strip()
    
    return parse_ai_response(ai_response)

def create_analysis_prompt(message, options):
    """Create the appropriate prompt for the AI model"""
    tasks = []
    if options.get('includeSentiment', True):
        tasks.append("sentiment (positive, negative, or neutral)")
    
    if options.get('includeSummary', True):
        tasks.append("brief summary in 2-3 sentences")
    
    if options.get('includeKeywords', True):
        tasks.append("up to 5 key topics or keywords")
    
    if options.get('includeSuggestion', False):
        tasks.append("suggested response")
    
    task_str = ", ".join(tasks)
    
    prompt = f"""Analyze the following customer message for {task_str}.
    
    Customer message: "{message}"
    
    Format your response as JSON:
    {{
      "sentiment": "positive/negative/neutral",
      "summary": "Brief summary here",
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }}
    
    Only respond with the JSON object, nothing else."""
    
    return prompt

def parse_ai_response(response_text):
    """Parse the JSON response from the AI model"""
    try:
        # Try to find JSON in the response using regex
        json_match = re.search(r'(\{[\s\S]*\})', response_text)
        if json_match:
            json_str = json_match.group(1)
            # Clean the string by removing any potential markdown code block markers
            json_str = re.sub(r'```json|```', '', json_str).strip()
            # Parse the JSON
            result = json.loads(json_str)
            return {
                'sentiment': result.get('sentiment', 'neutral'),
                'summary': result.get('summary', ''),
                'keywords': result.get('keywords', []),
                'suggestion': result.get('suggestion', ''),
                'error': False
            }
        else:
            # Fallback parsing if no JSON is found
            sentiment = 'neutral'
            if re.search(r'positive', response_text, re.IGNORECASE):
                sentiment = 'positive'
            elif re.search(r'negative', response_text, re.IGNORECASE):
                sentiment = 'negative'
            
            return {
                'sentiment': sentiment,
                'summary': response_text[:200] + '...' if len(response_text) > 200 else response_text,
                'keywords': [],
                'error': False,
                'raw_response': response_text
            }
    except Exception as e:
        print(f"Error parsing AI response: {str(e)}")
        print(f"Raw response: {response_text}")
        return {
            'error': True,
            'message': f"Error parsing AI response: {str(e)}",
            'raw_response': response_text
        }

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '0.0.0.0')
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    print(f"Starting AI API server on {host}:{port}")
    print(f"API Provider: {API_PROVIDER}, Model: {API_MODEL}")
    
    app.run(host=host, port=port, debug=debug)