const { MongoClient } = require('mongodb');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { locations } = req.body;

  if (!locations || !Array.isArray(locations)) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db('LifeTracker');
    const collection = database.collection('locationData');

    const result = await collection.insertMany(locations);

    res.status(200).json({ message: `${result.insertedCount} locations inserted` });
  } catch (error) {
    console.error('Error uploading locations:', error);
    res.status(500).json({ error: 'Error uploading locations' });
  } finally {
    await client.close();
  }
};