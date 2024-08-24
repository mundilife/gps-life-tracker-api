const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('./userModel');
const app = express();

app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('MongoDB connection error:', err));

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
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    user.lastLogin = new Date();
    await user.save();
    
    res.json({ apiKey: user.apiKey });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Protected route for saving location data
app.post('/api/location', authenticateApiKey, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const location = new Location({
      userId: req.user._id,
      latitude,
      longitude,
      timestamp: Date.now()
    });
    await location.save();
    res.status(201).json({ message: 'Location saved successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error saving location' });
  }
});

// Protected route for fetching location data
app.get('/api/locations', authenticateApiKey, async (req, res) => {
  try {
    const locations = await Location.find({ userId: req.user._id }).sort({ timestamp: -1 }).limit(100);
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching locations' });
  }
});

module.exports = app;