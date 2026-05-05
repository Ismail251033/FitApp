/**
 * FitApp - Main Server Entry Point
 * Node.js + Express + SQLite (sql.js)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./server/database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// API Routes
app.use('/api/auth',       require('./server/routes/auth'));
app.use('/api/users',      require('./server/routes/users'));
app.use('/api/posts',      require('./server/routes/posts'));
app.use('/api/activities', require('./server/routes/activities'));
app.use('/api/places',     require('./server/routes/places'));
app.use('/api/progress',   require('./server/routes/progress'));

// SPA fallback - send index.html for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Start server after DB init
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║        🏋️  FitApp Server Running       ║
║  URL: http://localhost:${PORT}          ║
║  DB:  database.db (SQLite)            ║
╚══════════════════════════════════════╝
    `);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});