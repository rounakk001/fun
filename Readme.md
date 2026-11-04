# 🎥 Yeonix

> A production-inspired video sharing platform backend built with **Node.js**, **Express.js**, and **MongoDB**, featuring secure authentication, cloud-based media management, and scalable REST APIs.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Cloudinary](https://img.shields.io/badge/Cloudinary-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white)

---

## 📌 Overview

Yeonix is a YouTube-inspired backend application designed using modern backend engineering practices.

The project demonstrates how production-grade backend systems handle:

- Authentication & Authorization
- Secure Media Uploads
- Cloud Storage
- Database Relationships
- Modular MVC Architecture
- RESTful API Design

Rather than being just a CRUD application, Yeonix focuses on scalable backend architecture and clean code organization.

---

# 🚀 Features

- User Registration & Login
- JWT Authentication
- Refresh Token Rotation
- Secure Password Hashing (bcrypt)
- HTTP-only Cookie Authentication
- Video Uploads
- Thumbnail Uploads
- Cloudinary Integration
- Playlists
- Likes & Dislikes
- Comments
- Channel Subscriptions
- Watch History
- MongoDB Aggregation Pipelines
- Protected Routes
- Centralized Error Handling

---

# 🏗 Tech Stack

### Backend

- Node.js
- Express.js

### Database

- MongoDB
- Mongoose

### Authentication

- JWT
- bcrypt
- Cookies

### Media

- Multer
- Cloudinary

### Utilities

- dotenv
- cookie-parser
- cors

---

# 📂 Project Structure

```
src
│
├── controllers/
├── models/
├── routes/
├── middlewares/
├── utils/
├── db/
├── constants.js
├── app.js
└── index.js
```

---

# 🔄 Request Lifecycle

```
Client
   │
   ▼
Routes
   │
   ▼
Middleware
(Authentication / Validation)
   │
   ▼
Controller
(Business Logic)
   │
   ▼
Mongoose Model
   │
   ▼
MongoDB
   │
   ▼
Response
```

---

# ☁️ Media Upload Flow

```
Client
   │
   ▼
Multer
   │
   ▼
Cloudinary
   │
   ▼
Cloud URL
   │
   ▼
MongoDB
```

---

# 🔐 Authentication Flow

```
Register
      │
      ▼
Hash Password
      │
      ▼
Store User
      │
      ▼
Login
      │
      ▼
Generate Access Token
Generate Refresh Token
      │
      ▼
HTTP-only Cookies
      │
      ▼
Protected Routes
```

---

# ⚡ API Modules

- Authentication
- Users
- Videos
- Playlists
- Likes
- Comments
- Subscriptions
- Dashboard
- Watch History

---

# 🛠 Installation

Clone the repository

```bash
git clone https://github.com/<username>/yeonix.git
```

Navigate into the project

```bash
cd yeonix
```

Install dependencies

```bash
npm install
```

Create a `.env` file

```env
PORT=

MONGODB_URI=

ACCESS_TOKEN_SECRET=
ACCESS_TOKEN_EXPIRY=

REFRESH_TOKEN_SECRET=
REFRESH_TOKEN_EXPIRY=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

CORS_ORIGIN=
```

Start the development server

```bash
npm run dev
```

---

# 📈 Backend Concepts Demonstrated

- REST API Design
- MVC Architecture
- JWT Authentication
- Refresh Token Strategy
- Cookie-based Authentication
- MongoDB Aggregation Pipeline
- Mongoose Population
- Schema Middleware
- File Upload Handling
- Cloud Storage Integration
- Error Handling Middleware
- Async Request Handling

---

# 📚 Future Enhancements

- Video Streaming
- Search Engine
- Notifications
- Recommendation Engine
- Live Streaming
- Redis Caching
- Docker Support
- CI/CD Pipeline
- Unit & Integration Testing

---

# 👨‍💻 Author

**Ishitva Narayan Mishra**

- GitHub: https://github.com/ishitvamishra
- LinkedIn: https://linkedin.com/in/ishitva-mishra

---

## ⭐ If you found this project helpful, consider giving it a star!
