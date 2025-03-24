// server/services/deepseekService.js
const axios = require('axios');

/**
 * Service to interact with the external DeepSeek API
 * Updated to precisely match the working Python implementation
 */
class DeepseekService {
  constructor() {
    // Updated to use the working ngrok URL
    this.apiUrl = process.env.API_URL || "https://ff5d-41-220-16-98.ngrok-free.app";
    this.apiKey = process.env.API_KEY || "sk-deepseek-E9VYbKFwWDoOXvqQJ7Qcl9zY";
    this.model = process.env.MODEL || "deepseek-r1:1.5b";
    this.endpoint = "/api/v1/generate";
    
    // Log the configuration on initialization
    console.log("DeepSeek Service initialized with:");
    console.log(`- API URL: ${this.apiUrl}`);
    console.log(`- API Model: ${this.model}`);
  }

  /**
   * Get full API URL for generation
   * @returns {string} Complete API URL with endpoint
   */
  getFullGenerationUrl() {
    return `${this.apiUrl}${this.endpoint}`;
  }

  /**
   * Get request headers including X-API-Key
   * Matches the Python implementation exactly
   * @returns {Object} Headers object
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey
    };
  }

  /**
   * Check if the API service is available
   * Reimplemented to match the working Python code
   * @returns {Promise<Object>} Status object with available boolean and message
   */
  async checkAvailability() {
    console.log("Checking DeepSeek API availability...");
    console.log(`API URL: ${this.apiUrl}`);
    
    try {
      // First try the health endpoint exactly as in Python
      console.log("Trying health endpoint...");
      const healthResponse = await axios.get(`${this.apiUrl}/health`);
      
      if (healthResponse.status === 200) {
        console.log("✅ Health check successful!");
        console.log("Health response:", healthResponse.data);
        
        // If health check passed, try a simple generation
        try {
          console.log("\nTrying a simple generation test...");
          const testResponse = await axios.post(
            this.getFullGenerationUrl(),
            {
              model: this.model,
              prompt: "Hello",
              max_tokens: 5,
              temperature: 0.7
            },
            {
              headers: this.getHeaders(),
              timeout: 10000
            }
          );
          
          if (testResponse.status === 200) {
            console.log("✅ Generation test successful!");
            return {
              available: true,
              message: "DeepSeek API is fully available and working.",
              modelName: this.model
            };
          } else {
            console.log("❌ Generation test returned non-200 status:", testResponse.status);
            return {
              available: false,
              message: `Generation endpoint returned status ${testResponse.status}`
            };
          }
        } catch (genError) {
          console.error("❌ Generation test failed:", genError.message);
          return {
            available: false,
            message: `Health endpoint is available, but generation failed: ${genError.message}`
          };
        }
      } else {
        console.log(`❌ Health check failed with status: ${healthResponse.status}`);
        return {
          available: false,
          message: `Health endpoint returned status ${healthResponse.status}`
        };
      }
    } catch (error) {
      console.error("❌ Error checking API availability:", error.message);
      return {
        available: false,
        message: `Cannot connect to DeepSeek API: ${error.message}`
      };
    }
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
    
    // Even if the API is not fully available, provide fallback analysis
    const fallbackAnalysis = {
      sentiment: this.detectSentiment(message),
      summary: "Analyzed with local fallback method.",
      keywords: this.extractSimpleKeywords(message),
      error: false,
      usedFallback: true
    };
    
    try {
      // First check if the service is available
      const status = await this.checkAvailability();
      if (!status.available) {
        console.log(`Using fallback analysis due to unavailable API: ${status.message}`);
        return {
          ...fallbackAnalysis,
          apiStatus: status.message
        };
      }
      
      // Prepare the prompt for the API - exactly as we would in Python
      const prompt = `Analyze the following customer message for sentiment (positive, negative, or neutral) and provide a brief summary in 2-3 sentences. Also identify up to 5 key topics or keywords from the message.
        
Customer message: "${message}"
        
Format your response as JSON:
{
  "sentiment": "positive/negative/neutral",
  "summary": "Brief summary here",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}`;
      
      // Call the DeepSeek API with the same structure as Python
      console.log("Sending analysis request to DeepSeek API...");
      const response = await axios.post(
        this.getFullGenerationUrl(),
        {
          model: this.model,
          prompt: prompt,
          max_tokens: 200,
          temperature: 0.1
        },
        {
          headers: this.getHeaders(),
          timeout: 15000
        }
      );
      
      // Process the API response
      if (response.status === 200 && response.data && response.data.text) {
        const rawOutput = response.data.text;
        console.log("Got response from DeepSeek API:", rawOutput.substring(0, 100) + "...");
        
        try {
          // Try to extract JSON from the response
          const jsonMatch = rawOutput.match(/({[\s\S]*})/);
          if (jsonMatch) {
            // Found a JSON-like structure
            const jsonStr = jsonMatch[0];
            try {
              const result = JSON.parse(this.cleanJsonString(jsonStr));
              return {
                sentiment: result.sentiment || this.detectSentiment(message),
                summary: result.summary || "A summary couldn't be extracted from the AI response.",
                keywords: result.keywords || this.extractSimpleKeywords(message),
                error: false
              };
            } catch (parseError) {
              console.error("Failed to parse JSON:", parseError.message);
            }
          }
          
          // If we couldn't extract valid JSON, use AI output for summary and fallback for the rest
          // Extract sentiment from the raw text
          let aiSentiment = "neutral";
          if (rawOutput.includes("positive")) {
            aiSentiment = "positive";
          } else if (rawOutput.includes("negative")) {
            aiSentiment = "negative";
          }
          
          return {
            sentiment: aiSentiment,
            summary: this.extractSummary(rawOutput, message),
            keywords: this.extractKeywords(rawOutput) || this.extractSimpleKeywords(message),
            error: false,
            partialAI: true
          };
        } catch (parseError) {
          console.error('Error processing AI response:', parseError);
          return fallbackAnalysis;
        }
      } else {
        console.error('Unexpected API response format');
        return fallbackAnalysis;
      }
    } catch (error) {
      console.error('API error:', error.message);
      return fallbackAnalysis;
    }
  }

  /**
   * Extract a summary from AI text
   */
  extractSummary(text, originalMessage) {
    // Look for summary-related text
    const summaryPatterns = [
      /summary:?\s*([^\.]*\..*?\.)/i,
      /brief summary:?\s*([^\.]*\..*?\.)/i,
      /in summary,?\s*([^\.]*\..*?\.)/i,
      /to summarize,?\s*([^\.]*\..*?\.)/i
    ];
    
    for (const pattern of summaryPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // If we can't find a clear summary, take a couple of sentences after certain keywords
    if (text.includes("message")) {
      const afterMessage = text.split("message")[1];
      // Take up to 200 characters
      return afterMessage.trim().substring(0, 200) + "...";
    }
    
    // Last resort, use a simple generated summary
    return `Message relates to ${this.extractSimpleKeywords(originalMessage).join(", ")}.`;
  }
  
  /**
   * Extract keywords from AI text
   */
  extractKeywords(text) {
    // Look for keywords in various formats
    const keywordPatterns = [
      /keywords:?\s*\[(.*?)\]/i,
      /key topics:?\s*\[(.*?)\]/i,
      /keywords:?\s*([\w\s,]+)/i,
      /key topics:?\s*([\w\s,]+)/i
    ];
    
    for (const pattern of keywordPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        // Clean and split the keywords
        return match[1]
          .replace(/"/g, '')
          .replace(/'/g, '')
          .split(',')
          .map(k => k.trim())
          .filter(k => k.length > 0);
      }
    }
    
    // If we find a list with numbers or bullets, extract those items
    const listMatches = text.match(/\d+\.\s*([\w\s]+)/g) || text.match(/•\s*([\w\s]+)/g);
    if (listMatches && listMatches.length > 0) {
      return listMatches
        .map(item => item.replace(/\d+\.\s*|•\s*/, '').trim())
        .filter(item => item.length > 0);
    }
    
    return null;
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