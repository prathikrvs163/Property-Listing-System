const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');

const Property = require('./server').Property; // Make sure this path matches your model export

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/propertydb', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const results = [];

fs.createReadStream('db424fd9fb74_1748258398689.csv')
  .pipe(csv())
  .on('data', (data) => results.push(data))
  .on('end', async () => {
    try {
      await Property.insertMany(results);
      console.log('CSV import completed');
      mongoose.disconnect();
    } catch (err) {
      console.error('Error importing CSV:', err);
    }
  });