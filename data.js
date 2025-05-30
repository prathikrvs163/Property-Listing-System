const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
require('dotenv').config();

const { Property } = require('./server'); // Make sure this path matches your server export

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/propertydb', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch((err) => console.error('❌ MongoDB connection error:', err));

// Helper to parse DD-MM-YYYY to YYYY-MM-DD format
const parseDate = (str) => {
  if (!str || typeof str !== 'string') return null;
  const [day, month, year] = str.split('-');
  if (!day || !month || !year) return null;
  const formatted = `${year}-${month}-${day}`;
  const date = new Date(formatted);
  return isNaN(date.getTime()) ? null : date;
};

const results = [];

fs.createReadStream('db424fd9fb74_1748258398689.csv')
  .pipe(csv())
  .on('data', (data) => {
    // Normalize CSV fields
    results.push({
      id: data.id,
      title: data.title,
      type: data.type,
      price: parseFloat(data.price),
      state: data.state,
      city: data.city,
      location: data.location || '',
      areaSqFt: parseFloat(data.areaSqFt),
      bedrooms: parseInt(data.bedrooms),
      bathrooms: parseInt(data.bathrooms),
      amenities: data.amenities?.split('|') || [],
      furnished: data.furnished,
      availableFrom: parseDate(data.availableFrom),
      listedBy: data.listedBy,
      tags: data.tags?.split('|') || [],
      colorTheme: data.colorTheme,
      rating: parseFloat(data.rating),
      isVerified: data.isVerified?.toLowerCase() === 'true',
      listingType: data.listingType,
    });
  })
  .on('end', async () => {
    try {
      await Property.insertMany(results);
      console.log('✅ CSV import completed');
    } catch (err) {
      console.error('❌ Error importing CSV:', err);
    } finally {
      mongoose.disconnect();
    }
  });
