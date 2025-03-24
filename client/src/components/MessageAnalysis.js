/**
 * Enhanced message analysis with varied response styles and comprehensive farm produce categories
 * @param {string} message - Message to analyze
 * @returns {object} Analysis result with sentiment, summary, and keywords
 */
const performLocalAnalysis = (message) => {
  if (!message) {
    return {
      sentiment: 'neutral',
      summary: 'No feedback provided.',
      keywords: []
    };
  }
  
  const text = message.toLowerCase();
  
  // Enhanced sentiment detection with weighted words
  const positiveWords = {
    'great': 2, 'excellent': 2, 'amazing': 2, 'love': 2, 'fantastic': 2, 'delicious': 2,
    'good': 1, 'nice': 1, 'happy': 1, 'like': 1, 'thanks': 1, 'best': 1, 'fresh': 1,
    'clean': 1, 'fine': 0.5, 'okay': 0.5, 'ok': 0.5, 'tasty': 1, 'sweet': 1, 'juicy': 1
  };
  
  const negativeWords = {
    'horrible': 2, 'terrible': 2, 'awful': 2, 'hate': 2, 'worst': 2, 'disgusting': 2,
    'bad': 1, 'poor': 1, 'disappointed': 1, 'not good': 1, 'stale': 1, 'rotten': 1,
    'dirty': 1, 'moldy': 1, 'not fresh': 1, 'overripe': 1, 'tasteless': 1, 'bland': 1,
    'not': 0.5, 'wasn\'t': 0.5, 'not as': 0.5, 'too': 0.5, 'expensive': 1, 'pricey': 1
  };
  
  let positiveScore = 0;
  let negativeScore = 0;
  
  // Calculate sentiment scores
  Object.entries(positiveWords).forEach(([word, weight]) => {
    if (text.includes(word)) positiveScore += weight;
  });
  
  Object.entries(negativeWords).forEach(([word, weight]) => {
    if (text.includes(word)) negativeScore += weight;
  });
  
  // Context-specific sentiment adjustment
  if (text.includes('not as') && 
      (text.includes('good') || text.includes('tasty') || 
       text.includes('fresh') || text.includes('expected'))) {
    negativeScore += 0.75;
  }
  
  // Determine sentiment based on scores
  let sentiment;
  if (positiveScore > negativeScore + 0.5) {
    sentiment = 'positive';
  } else if (negativeScore > positiveScore + 0.5) {
    sentiment = 'negative';
  } else {
    sentiment = 'neutral';
  }
  
  // Comprehensive farm produce categories
  const productCategories = {
    'fruits': ['fruit', 'apple', 'orange', 'banana', 'berry', 'berries', 'grapes', 'melon', 'watermelon', 'pear', 'peach', 'plum', 'cherry', 'strawberry', 'blueberry'],
    'vegetables': ['vegetable', 'vegetables', 'tomato', 'cucumber', 'lettuce', 'carrot', 'potato', 'onion', 'garlic', 'pepper', 'broccoli', 'cabbage', 'spinach', 'kale', 'greens'],
    'dairy': ['milk', 'cheese', 'yogurt', 'dairy', 'cream', 'butter', 'ice cream', 'kefir', 'whey'],
    'meat': ['meat', 'beef', 'chicken', 'pork', 'lamb', 'sausage', 'bacon', 'steak', 'poultry'],
    'eggs': ['egg', 'eggs', 'free-range', 'organic eggs'],
    'grains': ['grain', 'grains', 'wheat', 'corn', 'oats', 'rice', 'cereal', 'flour', 'bread'],
    'honey': ['honey', 'beeswax', 'comb', 'raw honey'],
    'nuts': ['nut', 'nuts', 'almond', 'walnut', 'pecan', 'cashew', 'peanut'],
    'herbs': ['herb', 'herbs', 'mint', 'basil', 'thyme', 'oregano', 'cilantro', 'parsley']
  };
  
  // Detect product category
  let detectedCategory = null;
  let detectedProduct = null;
  
  for (const [category, products] of Object.entries(productCategories)) {
    for (const product of products) {
      if (text.includes(product)) {
        detectedCategory = category;
        detectedProduct = product;
        break;
      }
    }
    if (detectedCategory) break;
  }
  
  // Default to general farm produce if no specific category detected
  if (!detectedCategory) {
    detectedCategory = 'farm produce';
    detectedProduct = 'produce';
  }
  
  // Extract quality descriptors
  const qualityDescriptors = ['fresh', 'clean', 'tasty', 'stale', 'rotten', 'quality', 
                             'flavor', 'taste', 'price', 'expensive', 'cheap', 'organic',
                             'natural', 'local', 'sustainable', 'juicy', 'crisp', 'soft',
                             'hard', 'sweet', 'sour', 'bitter', 'ripe', 'unripe'];
  
  const mentionedQualities = qualityDescriptors.filter(q => text.includes(q));
  
  // Generate diverse summary templates based on sentiment
  const positiveSummaries = [
    `Delighted shopper praises our ${detectedCategory}.`,
    `Customer expressing satisfaction with ${detectedProduct} quality.`,
    `Positive feedback received about our farm-fresh ${detectedCategory}.`,
    `Enthusiastic response to our ${detectedCategory} offerings.`,
    `${detectedCategory.charAt(0).toUpperCase() + detectedCategory.slice(1)} received a glowing review.`
  ];
  
  const neutralSummaries = [
    `Customer shared observations about our ${detectedCategory}.`,
    `Feedback provided regarding ${detectedProduct} from our farm.`,
    `Shopper commented on the ${detectedCategory} quality.`,
    `Customer notes about our farm's ${detectedCategory} products.`,
    `General remarks about ${detectedProduct} received.`
  ];
  
  const negativeSummaries = [
    `Customer reported concerns with our ${detectedCategory}.`,
    `Improvement opportunity identified for our ${detectedProduct}.`,
    `Shopper experienced issues with our ${detectedCategory}.`,
    `Quality concerns raised about our ${detectedProduct}.`,
    `Attention needed: feedback about ${detectedCategory} quality.`
  ];
  
  // Select a random summary based on sentiment
  let summaries;
  if (sentiment === 'positive') {
    summaries = positiveSummaries;
  } else if (sentiment === 'negative') {
    summaries = negativeSummaries;
  } else {
    summaries = neutralSummaries;
  }
  
  const summaryIndex = Math.floor(Math.random() * summaries.length);
  let summary = summaries[summaryIndex];
  
  // If quality descriptors were mentioned, enhance the summary
  if (mentionedQualities.length > 0) {
    const quality = mentionedQualities[0];
    const enhancedSummaries = [
      `${summary} Specifically mentioned: ${quality}.`,
      `${summary} The ${quality} aspect was highlighted.`,
      `${summary} Customer focused on ${quality}.`
    ];
    summary = enhancedSummaries[Math.floor(Math.random() * enhancedSummaries.length)];
  }
  
  // Extract keywords (improved implementation)
  const words = text.split(/\W+/).filter(w => w.length > 3);
  const stopWords = ['this', 'that', 'have', 'with', 'they', 'from', 'were', 'will', 'would', 'about', 'there', 'their', 'your', 'please', 'thank', 'would', 'could', 'should'];
  
  // Prioritize product and quality keywords
  let keywords = [];
  
  // Add the detected product as first keyword if it appears in the message
  if (detectedProduct && text.includes(detectedProduct)) {
    keywords.push(detectedProduct);
  }
  
  // Add quality-related keywords that appear in the message
  mentionedQualities.forEach(quality => {
    if (!keywords.includes(quality)) {
      keywords.push(quality);
    }
  });
  
  // Fill remaining keyword slots with other significant words
  const remainingWords = [...new Set(words.filter(w => !stopWords.includes(w) && !keywords.includes(w)))];
  keywords = [...keywords, ...remainingWords].slice(0, 5);
  
  return {
    sentiment,
    summary,
    keywords
  };
};
