// server/services/deepseekService.js
const axios = require('axios');

/**
 * Service to interact with the external DeepSeek API
 */
class DeepseekService {
  constructor() {
    // Use the provided API details
    this.apiUrl = process.env.API_URL || "https://e1e3-41-220-16-98.ngrok-free.app";
    this.apiKey = process.env.API_KEY || "sk-deepseek-E9VYbKFwWDoOXvqQJ7Qcl9zY";
    this.endpoint = process.env.ENDPOINT || "/api/v1/generate";
  }

  /**
   * Get full API URL
   * @returns {string} Complete API URL with endpoint
   */
  getFullApiUrl() {
    return `${this.apiUrl}${this.endpoint}`;
  }

  /**
   * Check if the API service is available
   * @returns {Promise<Object>} Status object with available boolean and message
   */
  async checkAvailability() {
    try {
      // Make a simple request to check if the API is responsive
      const response = await axios.post(
        this.getFullApiUrl(),
        {
          model: "deepseek-llm",
          prompt: "Hi",
          max_tokens: 1,
          stream: false
        },
        {
          headers: this.getHeaders(),
          timeout: 5000 // 5 second timeout for status check
        }
      );
      
      // If we can connect and get a response, the service is available
      if (response.status === 200) {
        return {
          available: true,
          message: `Connected to DeepSeek API. Service is available.`,
          modelName: "deepseek-llm"
        };
      } else {
        return {
          available: false,
          message: `API responded with status code: ${response.status}`
        };
      }
    } catch (error) {
      return {
        available: false,
        message: `Cannot connect to DeepSeek API: ${error.message}. Please check the API configuration.`
      };
    }
  }

  /**
   * Get request headers including authorization
   * @returns {Object} Headers object
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };
  }

  /**
   * Analyze the sentiment and generate a summary for a given message
   * @param {string} message - The message to analyze
   * @returns {Promise<Object>} Analysis result with sentiment, summary, and keywords
   */
  async analyzeMessage(message) {
    if (!message) {
      return {
        error: true,
        message: 'No message provided for analysis'
      };
    }
    
    try {
      // First check if the service is available
      const status = await this.checkAvailability();
      if (!status.available) {
        return {
          error: true,
          message: status.message
        };
      }
      
      // Prepare the prompt for the API
      const prompt = `Analyze the following customer message for sentiment (positive, negative, or neutral) and provide a brief summary in 2-3 sentences. Also identify up to 5 key topics or keywords from the message.
        
Customer message: "${message}"
        
Format your response as JSON:
{
  "sentiment": "positive/negative/neutral",
  "summary": "Brief summary here",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}`;
      
      // Call the DeepSeek API
      const response = await axios.post(
        this.getFullApiUrl(),
        {
          model: "deepseek-llm",
          prompt: prompt,
          max_tokens: 1000,
          temperature: 0.1,  // Lower temperature for more consistent responses
          stream: false
        },
        {
          headers: this.getHeaders(),
          timeout: 15000 // 15 second timeout
        }
      );
      
      // Process the API response
      if (response.data && response.data.output) {
        const rawOutput = response.data.output;
        
        try {
          // Extract JSON object from the text response
          const jsonMatch = rawOutput.match(/({[\s\S]*})/);
          const jsonStr = jsonMatch ? jsonMatch[0] : rawOutput;
          const result = JSON.parse(this.cleanJsonString(jsonStr));
          
          return {
            sentiment: result.sentiment || this.detectSentiment(message),
            summary: result.summary || "We couldn't process this message automatically. A team member will review it.",
            keywords: result.keywords || this.extractSimpleKeywords(message),
            error: false
          };
        } catch (parseError) {
          console.error('Error parsing API response:', parseError);
          console.error('Raw output:', rawOutput);
          
          // Return a fallback response if parsing fails
          return {
            sentiment: this.detectSentiment(message),
            summary: "We couldn't parse the AI response properly. A team member will review your message.",
            keywords: this.extractSimpleKeywords(message),
            error: false,
            parseError: parseError.message
          };
        }
      } else {
        throw new Error('Unexpected API response format');
      }
    } catch (error) {
      console.error('API error:', error.message);
      
      // Return a fallback response in case of errors
      return {
        error: true,
        message: `Error calling DeepSeek API: ${error.message}`,
        sentiment: this.detectSentiment(message),
        summary: "We couldn't process this message automatically. A team member will review it.",
        keywords: this.extractSimpleKeywords(message)
      };
    }
  }

  /**
   * Clean and fix the JSON string for parsing
   * @param {string} jsonString - Potentially malformed JSON string
   * @returns {string} Cleaned JSON string
   */
  cleanJsonString(jsonString) {
    try {
      // First, try if it's already valid JSON
      JSON.parse(jsonString);
      return jsonString;
    } catch (e) {
      // If not valid, try to clean it
      
      // Replace single quotes with double quotes
      let cleaned = jsonString.replace(/'/g, '"');
      
      // Fix any trailing commas in arrays or objects which are invalid in JSON
      cleaned = cleaned.replace(/,\s*}/g, '}').replace(/,\s*\]/g, ']');
      
      // Try to extract just the JSON object if there's extra text
      const objectMatch = cleaned.match(/{[\s\S]*}/);
      if (objectMatch) {
        cleaned = objectMatch[0];
      }
      
      // Sometimes the model puts escaped quotes within strings that are already quoted
      // This regex looks complex but it replaces \"phrase\" with "phrase" inside JSON strings
      cleaned = cleaned.replace(/"([^"]*?)\\+"([^"]*?)\\+"([^"]*?)"/g, '"$1$2$3"');
      
      // Remove any potential line breaks in the middle of strings
      cleaned = cleaned.replace(/(".*?(?<!\\)")(\n)(".*?(?<!\\)")/g, '$1,$3');
      
      return cleaned;
    }
  }

  /**
   * Fallback sentiment detection
   * @param {string} text - Text to analyze
   * @returns {string} sentiment (positive, negative, or neutral)
   */
  detectSentiment(text) {
    const positiveWords = ['great', 'good', 'excellent', 'happy', 'interested', 'love', 'like', 'best', 'thanks', 'thank', 'appreciate'];
    const negativeWords = ['bad', 'poor', 'terrible', 'unhappy', 'disappointed', 'hate', 'worst', 'issue', 'problem', 'concern'];
    
    const lowerText = text.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;
    
    positiveWords.forEach(word => {
      if (lowerText.includes(word)) positiveCount++;
    });
    
    negativeWords.forEach(word => {
      if (lowerText.includes(word)) negativeCount++;
    });
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Extract simple keywords for fallback
   * @param {string} text - Text to analyze
   * @returns {Array} Array of keywords
   */
  extractSimpleKeywords(text) {
    const words = text.toLowerCase().split(/\W+/);
    const stopWords = ['i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 
      'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 
      'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 
      'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 
      'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 
      'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 
      'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 
      'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 
      'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 
      'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 
      'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 
      'will', 'just', 'don', 'should', 'now'];
    
    // Filter out short words and stop words
    const filteredWords = words.filter(word => 
      word.length > 3 && !stopWords.includes(word)
    );
    
    // Count word frequencies
    const wordCounts = {};
    filteredWords.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
    
    // Sort by frequency and get top 5 keywords
    const sortedWords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);
    
    return sortedWords;
  }
}

module.exports = new DeepseekService();