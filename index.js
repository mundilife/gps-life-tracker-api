const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('./userModel');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = express();

console.log('Application starting...');

app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI;

console.log('Attempting to connect to MongoDB...');
console.log('MongoDB URI:', MONGODB_URI ? MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@') : 'MONGODB_URI is undefined');

mongoose.set('strictQuery', false);

const connectToMongoDB = async () => {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined. Please set it in your environment variables or .env file.');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB successfully');
    const db = mongoose.connection;
    console.log('Database name:', db.name);
    console.log('Host:', db.host);
    console.log('Port:', db.port);
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

connectToMongoDB();

app.get('/', (req, res) => {
  console.log('Root route accessed');
  res.json({ message: 'Welcome to the GPS Life Tracker API' });
});

app.get('/api/test-db', async (req, res) => {
  console.log('Test DB route accessed');
  try {
    if (mongoose.connection.readyState === 1) {
      res.json({ message: 'MongoDB connection successful' });
    } else {
      throw new Error('MongoDB not connected');
    }
  } catch (error) {
    res.status(500).json({ error: 'MongoDB connection failed', details: error.message });
  }
});

app.get('/api/test', (req, res) => {
  console.log('Test route accessed');
  res.json({ message: 'Server is running' });
});

// Middleware for API key authentication
const authenticateApiKey = async (req, res, next) => {
  const apiKey = req.header('X-API-Key');
  if (!apiKey) {
    return res.status(401).json({ error: 'No API key provided' });
  }
  
  const user = await User.findOne({ apiKey });
  if (!user) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  req.user = user;
  next();
};

// User registration
app.post('/api/register', async (req, res) => {
  const start = Date.now();
  console.log('Registration request received');
  try {
    const { email, password } = req.body;
    
    console.log(`Registration attempt for email: ${email}`);

    if (!email || !password) {
      console.log('Registration failed: Email or password missing');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    console.log('Checking for existing user');
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('Registration failed: User already exists');
      return res.status(400).json({ error: 'User already exists' });
    }
    
    console.log('Hashing password');
    const passwordHash = await bcrypt.hash(password, 10);
    
    console.log('Generating API key');
    const apiKey = crypto.randomBytes(32).toString('hex');
    
    console.log('Creating new user');
    const newUser = new User({
      email,
      passwordHash,
      apiKey,
      lastLogin: new Date()
    });
    
    console.log('Saving new user to database');
    await newUser.save();
    
    const end = Date.now();
    console.log(`User registered successfully. Total time: ${end - start}ms`);
    res.status(201).json({ apiKey });
  } catch (error) {
    const end = Date.now();
    console.error(`Registration error: ${error}. Total time: ${end - start}ms`);
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

// User login
app.post('/api/login', async (req, res) => {
  console.log('Login request received');
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      console.log('Login failed: Invalid credentials');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    user.lastLogin = new Date();
    await user.save();
    
    console.log('User logged in successfully');
    res.json({ apiKey: user.apiKey });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Protected route for saving location data
app.post('/api/location', authenticateApiKey, async (req, res) => {
  console.log('Location save request received');
  try {
    const { latitude, longitude } = req.body;
    const location = new Location({
      userId: req.user._id,
      latitude,
      longitude,
      timestamp: Date.now()
    });
    await location.save();
    console.log('Location saved successfully');
    res.status(201).json({ message: 'Location saved successfully' });
  } catch (error) {
    console.error('Error saving location:', error);
    res.status(500).json({ error: 'Error saving location' });
  }
});

// Protected route for fetching location data
app.get('/api/locations', authenticateApiKey, async (req, res) => {
  console.log('Location fetch request received');
  try {
    const locations = await Location.find({ userId: req.user._id }).sort({ timestamp: -1 }).limit(100);
    console.log(`Fetched ${locations.length} locations`);
    res.json(locations);
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Error fetching locations' });
  }
});

// Handle all routes
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is busy. Trying port ${PORT + 1}`);
    server.listen(PORT + 1);
  } else {
    console.error('Server error:', err);
  }
});

module.exports = app;