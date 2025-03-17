// server.js - Main server file

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

// Connect to MongoDB with retry logic
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/freshFarmDB', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000 // Timeout after 5s instead of 30s
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    return false;
  }
};

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
  res.json({ message: 'Welcome to Fresh Farm Produce API' });
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