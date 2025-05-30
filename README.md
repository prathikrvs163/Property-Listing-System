# 🏠 Property Listing System Backend

A fully functional, scalable backend system for managing property listings, built using **Node.js**, **Express**, **MongoDB**, **Redis (Upstash)**, and deployed to **Render**.

This backend supports:

* Property management (CRUD)
* Advanced filtering and search
* User authentication
* Favorites functionality
* Recommendation system
* Redis caching for optimization
* CSV import for bulk data

---

## 📦 Tech Stack

* **Node.js + Express** - Backend framework
* **MongoDB Atlas** - NoSQL Database
* **Mongoose** - MongoDB ORM
* **JWT (jsonwebtoken)** - Authentication
* **Bcrypt** - Password hashing
* **Redis (Upstash)** - Caching layer
* **CSV Parser** - Import bulk data
* **Render** - Hosting platform

---

## 🛠️ Features

### ✅ User Authentication

* Register a new user with email and password
* Login to get JWT token for secured endpoints

### ✅ Property Management

* Create, Read, Update, Delete properties
* Only the creator (via `createdBy`) can update/delete

### ✅ Advanced Filtering/Search

Supports filtering on:

* `title`, `location`, `city`, `type`, `createdBy`
* `priceMin`, `priceMax`
* `bedrooms`, `bathrooms`
* `areaMin`, `areaMax`

### ✅ Redis Caching

* Integrated Redis via **Upstash** (cloud Redis)
* Caches GET `/api/properties` queries for faster response
* Automatically bypasses cache on POST/PUT/DELETE

### ✅ Favorites

* Users can mark properties as favorites
* View and remove favorites

### ✅ Recommendations

* A user can recommend a property to another user via email
* Recipient can view all received recommendations

### ✅ Health Check

* `/health` and `/` for uptime checks and simple status

---

## 📂 Project Structure

```
├── server.js         # Main backend logic and routes
├── data.js           # Script to import CSV data into MongoDB
├── .env              # Contains sensitive configs (Mongo URI, JWT secret, Redis URL)
├── db424fd9*.csv     # Provided dataset
├── sample.txt        # Sample Mongo import CLI
├── package.json      # Project dependencies and scripts
```

---

## 🗄️ MongoDB Setup

* MongoDB cluster was created on **MongoDB Atlas**
* `.env` file includes:

```dotenv
MONGO_URI=***
JWT_SECRET=***
```

* Models created: `User`, `Property`, `Favorite`, `Recommendation`

---

## 📊 CSV Import

CSV data (with over 10+ fields) is imported into MongoDB via:

1. `data.js` script:

   * Uses `csv-parser` to parse and insert into MongoDB
   * Normalizes and formats data (e.g., date conversion)
2. Alternative method using `mongoimport` CLI

---

## ⚡ Redis Setup & Deployment Notes

### Initial Attempt:

* Docker Redis used locally (e.g. `redis:latest`) – worked locally
* But failed on Render because:

  * Render **does not support** Docker containers for services like Redis unless configured separately
  * Redis on localhost (127.0.0.1:6379) was inaccessible in cloud

### Final Solution:

* Switched to **Upstash Redis** (Serverless Cloud Redis)
* `.env` updated:

```dotenv
REDIS_URL=***
REDIS_TOKEN=ATpEAAIj...  # Secure token
```

* Connection handled securely using:

```js
const client = redis.createClient({
  socket: {
    host: process.env.REDIS_URL.replace(/^redis:\/\//, ''),
    port: 6379,
    tls: true
  },
  password: process.env.REDIS_TOKEN
});
```

---

## 🚀 Deployment on Render

* Deployed as a Node.js web service
* Render automatically detects `server.js`
* Environment variables added via Render Dashboard
* Port 3000 exposed and detected
* Redis runs fully through Upstash – no local container needed

---

## 📬 API Endpoints

### 🧑 Auth

```
POST /api/auth/register    # { email, password }
POST /api/auth/login       # { email, password }
```

### 🏘️ Properties

```
GET    /api/properties      # Search, filter (uses cache)
POST   /api/properties      # Add new (auth required)
PUT    /api/properties/:id  # Update (auth + owner)
DELETE /api/properties/:id  # Delete (auth + owner)
```

### ⭐ Favorites

```
POST   /api/favorites        # Add property to favorites
GET    /api/favorites        # View user's favorites
DELETE /api/favorites/:id    # Remove favorite
```

### 📤 Recommendations

```
POST /api/recommend         # Recommend property to user via email
GET  /api/recommendations   # View recommendations received
```

---

## 🔐 .env Sample

```
MONGO_URI=your_mongo_uri
JWT_SECRET=your_jwt_secret
REDIS_URL=redis://your_upstash_url
REDIS_TOKEN=your_upstash_token
```

---

## 📎 Final Notes

* All backend logic written in `server.js`
* MongoDB models defined inline using Mongoose
* Project tested and deployed successfully
* Caching, security, and scalability handled

---

## 🙌 Acknowledgments

Thanks to the original dataset provided and the Render + Upstash platforms for seamless deployment.

> Built with ❤️ by \[Prathik Rachakonda]
