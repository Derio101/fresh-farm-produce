// server.js - Main server file with improved MongoDB connection and error handling

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const formRoutes = require('./routes/formRoutes');
const errorHandler = require('./middleware/errorHandler');
const deepseekService = require('./services/deepseekService');
const fetch = require('node-fetch'); // Add this for self-ping if not already there

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Set up Socket.IO
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());

// Enhanced MongoDB connection with retry logic
const connectDB = async (retries = 5, interval = 5000) => {
  try {
    // Parse MongoDB URI to ensure proper encoding
    let uri = process.env.MONGODB_URI;
    
    // Extract components from URI for proper handling
    const [prefix, suffix] = uri.split('@');
    const [protocol, credentials] = prefix.split('://');
    const [username, password] = credentials.split(':');
    
    // Reconstruct URI with properly encoded components
    const encodedUri = `${protocol}://${username}:${encodeURIComponent(decodeURIComponent(password))}@${suffix}`;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`MongoDB connection attempt ${attempt}/${retries}...`);
        
        const conn = await mongoose.connect(encodedUri, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 15000, // Increased timeout
          socketTimeoutMS: 45000,
        });
        
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return true;
      } catch (connectionError) {
        console.error(`MongoDB connection error (attempt ${attempt}/${retries}): ${connectionError.message}`);
        
        if (attempt === retries) {
          console.error(`All ${retries} connection attempts failed.`);
          return false;
        }
        
        // Wait before trying again
        console.log(`Retrying in ${interval/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  } catch (error) {
    console.error(`Error in MongoDB connection setup: ${error.message}`);
    return false;
  }
};

// Add connection event listeners
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to DB');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected');
});

// Check AI service availability
app.use(async (req, res, next) => {
  // Only check on routes that need AI services
  if (req.path.includes('/analyze') || req.path.includes('/ai-status')) {
    try {
      // Just log the result, don't block the request
      const status = await deepseekService.checkAvailability();
      console.log(`AI Service status: ${status.available ? 'Available' : 'Unavailable'}`);
    } catch (error) {
      console.error('Error checking AI service:', error.message);
    }
  }
  next();
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check if we can perform a simple operation on the database
    const dbStatus = mongoose.connection.readyState;
    /*
     * 0 = disconnected
     * 1 = connected
     * 2 = connecting
     * 3 = disconnecting
     */
    const statusMessages = ['Disconnected', 'Connected', 'Connecting', 'Disconnecting'];
    
    res.json({
      status: 'ok',
      server: 'running',
      mongodb: statusMessages[dbStatus] || 'Unknown',
      mongodbReadyState: dbStatus,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      server: 'running',
      mongodb: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Routes
app.use('/api', formRoutes);

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static(path.join(__dirname, '../client/build')));

  // Any route that is not api will be redirected to index.html
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'));
  });
}

// Default API route
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Welcome to Fresh Farm Produce API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Error handling middleware
app.use(errorHandler);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Enable HTTP Keep-Alive
server.keepAliveTimeout = 65000; // 65 seconds
server.headersTimeout = 66000; // 66 seconds

// Start server
const PORT = process.env.PORT || 5001;

// Connect to the database before starting the server
connectDB().then((connected) => {
  if (connected) {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      
      // Check if DeepSeek API is available on startup
      deepseekService.checkAvailability()
        .then(status => {
          if (status.available) {
            console.log(`✅ DeepSeek API available: ${status.message}`);
            console.log(`API URL: ${process.env.API_URL || deepseekService.apiUrl}`);
          } else {
            console.warn(`⚠️ DeepSeek API unavailable: ${status.message}`);
            console.warn(`API URL: ${process.env.API_URL || deepseekService.apiUrl}`);
          }
        })
        .catch(err => {
          console.error('❌ Error checking AI service:', err.message);
        });
        
      // Self-ping to prevent application from sleeping in production
      if (process.env.NODE_ENV === 'production') {
        const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes
        
        setInterval(() => {
          const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
          console.log(`Pinging application at ${appUrl}/api to keep it alive...`);
          
          fetch(appUrl + '/api')
            .then(res => res.json())
            .then(data => console.log('Ping successful:', data.message))
            .catch(err => console.error('Ping failed:', err.message));
        }, PING_INTERVAL);
      }
    });
  } else {
    console.error('Cannot start server due to database connection failure');
    // In production you might want to retry or exit
    if (process.env.NODE_ENV === 'production') {
      // Retry connection after 5 seconds
      console.log('Retrying database connection in 5 seconds...');
      setTimeout(() => connectDB().then((reconnected) => {
        if (reconnected) {
          server.listen(PORT, () => {
            console.log(`Server running on port ${PORT} after reconnection`);
          });
        } else {
          console.error('Failed to reconnect to database. Exiting process.');
          process.exit(1);
        }
      }), 5000);
    }
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // In production, we might want to exit the process
  if (process.env.NODE_ENV === 'production') {
    server.close(() => process.exit(1));
  }
});

module.exports = { app, server, io }; // Export for testing purposes
