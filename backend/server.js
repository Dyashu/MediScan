const express = require('express');
const path = require("path");
const connectDB = require('./config/db');
require('dotenv').config();
const cors = require("cors");

const app = express();

// Port
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

app.use(cors({
  origin: "*",   // allow all devices on LAN
  methods: "GET,POST,PUT,DELETE",
  allowedHeaders: "Content-Type,Authorization"
}));

// Connect DB
connectDB();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/scans', require('./routes/scans'));
app.use('/api/annotations', require('./routes/annotations'));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/annotations", express.static(path.join(__dirname, "annotations")));

// Base route
app.get('/', (req, res) => {
  res.send('API is running');
});

// Start server on all interfaces
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
