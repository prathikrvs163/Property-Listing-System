const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const redis = require('redis');
const cors = require('cors');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Redis client (Upstash-compatible)
// Redis client (Upstash-compatible)
const client = redis.createClient({
  socket: {
    host: process.env.REDIS_URL.replace(/^redis:\/\//, ''),
    port: 6379,
    tls: true
  },
  password: process.env.REDIS_TOKEN
});

client.on('error', (err) => console.error('❌ Redis Client Error:', err));

(async () => {
  if (!client.isOpen) {
    await client.connect().catch(console.error);
  }
})();



// MongoDB Models
const { Schema, model, Types } = mongoose;

const User = model('User', new Schema({
  email: { type: String, unique: true },
  password: String,
}));

const Property = model('Property', new Schema({
  id: String,
  title: String,
  type: String,
  price: Number,
  state: String,
  city: String,
  location: String,
  areaSqFt: Number,
  bedrooms: Number,
  bathrooms: Number,
  amenities: [String],
  furnished: String,
  availableFrom: Date,
  listedBy: String,
  tags: [String],
  colorTheme: String,
  rating: Number,
  isVerified: Boolean,
  listingType: String,
  createdBy: { type: Types.ObjectId, ref: 'User' },
}));

const Favorite = model('Favorite', new Schema({
  userId: { type: Types.ObjectId, ref: 'User' },
  propertyId: { type: Types.ObjectId, ref: 'Property' },
}));

const Recommendation = model('Recommendation', new Schema({
  fromUserId: { type: Types.ObjectId, ref: 'User' },
  toUserId: { type: Types.ObjectId, ref: 'User' },
  propertyId: { type: Types.ObjectId, ref: 'Property' },
  message: String,
  recommendedAt: { type: Date, default: Date.now },
}));

// Middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).send('No token provided');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).send('Invalid token');
  }
};

const ownerMiddleware = async (req, res, next) => {
  const property = await Property.findById(req.params.id);
  if (!property) return res.status(404).send('Property not found');
  if (property.createdBy.toString() !== req.user._id) return res.status(403).send('Forbidden');
  next();
};

const cacheMiddleware = async (req, res, next) => {
  const key = `properties:${JSON.stringify(req.query)}`;
  try {
    const cached = await client.get(key);
    if (cached) {
      console.log('🔄 Serving from cache');
      return res.json(JSON.parse(cached));
    }
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      client.setEx(key, 3600, JSON.stringify(data));
      return originalJson(data);
    };
    next();
  } catch (err) {
    console.error('❌ Redis Cache Error:', err.message);
    next();
  }
};

// Routes

// Auth
app.post('/api/auth/register', async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);
  const user = await User.create({ email: req.body.email, password: hash });
  res.json(user);
});

app.post('/api/auth/login', async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user || !(await bcrypt.compare(req.body.password, user.password)))
    return res.status(401).send('Invalid credentials');
  const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);
  res.json({ token });
});

// Properties
app.get('/api/properties', cacheMiddleware, async (req, res) => {
  const {
    title, location, city, type, createdBy,
    priceMin, priceMax,
    bedrooms, bathrooms,
    areaMin, areaMax
  } = req.query;

  const filter = {};

  if (title) filter.title = new RegExp(title, 'i');
  if (location) filter.location = new RegExp(location, 'i');
  if (city) filter.city = new RegExp(city, 'i');
  if (type) filter.type = type;
  if (createdBy) filter.createdBy = createdBy;
  if (bedrooms) filter.bedrooms = parseInt(bedrooms);
  if (bathrooms) filter.bathrooms = parseInt(bathrooms);

  if (priceMin || priceMax) {
    filter.price = {};
    if (priceMin) filter.price.$gte = parseFloat(priceMin);
    if (priceMax) filter.price.$lte = parseFloat(priceMax);
  }

  if (areaMin || areaMax) {
    filter.areaSqFt = {};
    if (areaMin) filter.areaSqFt.$gte = parseFloat(areaMin);
    if (areaMax) filter.areaSqFt.$lte = parseFloat(areaMax);
  }

  console.log('📦 MongoDB Query Filter:', filter);
  const properties = await Property.find(filter);
  res.json(properties);
});

app.post('/api/properties', authMiddleware, async (req, res) => {
  const property = await Property.create({ ...req.body, createdBy: req.user._id });
  res.json(property);
});

app.put('/api/properties/:id', authMiddleware, ownerMiddleware, async (req, res) => {
  const updated = await Property.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
});

app.delete('/api/properties/:id', authMiddleware, ownerMiddleware, async (req, res) => {
  await Property.findByIdAndDelete(req.params.id);
  res.send('Deleted');
});

// Favorites
app.post('/api/favorites', authMiddleware, async (req, res) => {
  const favorite = await Favorite.create({ userId: req.user._id, propertyId: req.body.propertyId });
  res.json(favorite);
});

app.get('/api/favorites', authMiddleware, async (req, res) => {
  const favorites = await Favorite.find({ userId: req.user._id }).populate('propertyId');
  res.json(favorites);
});

app.delete('/api/favorites/:id', authMiddleware, async (req, res) => {
  await Favorite.findByIdAndDelete(req.params.id);
  res.send('Deleted');
});

// Recommendations
app.post('/api/recommend', authMiddleware, async (req, res) => {
  const { recipientEmail, propertyId, message } = req.body;
  const recipient = await User.findOne({ email: recipientEmail });
  if (!recipient) return res.status(404).send('Recipient not found');

  const recommendation = await Recommendation.create({
    fromUserId: req.user._id,
    toUserId: recipient._id,
    propertyId,
    message
  });

  res.json({ message: 'Property recommended successfully', recommendation });
});

app.get('/api/recommendations', authMiddleware, async (req, res) => {
  const recommendations = await Recommendation.find({ toUserId: req.user._id })
    .populate('fromUserId', 'email')
    .populate('propertyId');
  res.json(recommendations);
});

// Health check
app.get('/health', (req, res) => {
  res.send('OK');
});

app.get('/', (req, res) => {
  res.send('Property Listing Backend is Running 🚀');
});

// Start Server
mongoose.connect(process.env.MONGO_URI).then(() => {
  app.listen(3000, () => console.log('✅ Server running on port 3000'));
});

module.exports = { Property, Recommendation };
