// testdb.js (create this in your server directory)
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/freshFarmDB')
  .then(() => {
    console.log('Successfully connected to MongoDB!');
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
  });