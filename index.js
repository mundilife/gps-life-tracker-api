const express = require('express');
const mongoose = require('mongoose');
const app = express();

app.use(express.json());

const MONGODB_URI = 'mongodb+srv://stephan:NtwurvwfH2pk9q6d@lifecraft.bebmeqj.mongodb.net/?retryWrites=true&w=majority&appName=LifeCraft';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('MongoDB connection error:', err));

const locationSchema = new mongoose.Schema({
  userId: String,
  timestamp: Number,
  latitude: Number,
  longitude: Number
});

const Location = mongoose.model('Location', locationSchema);

app.post('/api/location', async (req, res) => {
  try {
    const locations = Array.isArray(req.body) ? req.body : [req.body];
    const savedLocations = await Location.insertMany(locations);
    res.status(201).json({ message: 'Locations saved successfully', count: savedLocations.length });
  } catch (error) {
    res.status(500).json({ message: 'Error saving locations', error: error.message });
  }
});

app.get('/api/locations', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ message: 'UserId is required' });
    }
    const locations = await Location.find({ userId }).sort({ timestamp: -1 }).limit(100);
    res.json(locations);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching locations', error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;