/**
 * Auth Routes - Register, Login, Logout
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'fitapp_super_secret_2024';

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, goal } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user exists
    const existing = db.get('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
    if (existing) {
      return res.status(400).json({ error: 'Email or username already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();

    db.run(
      'INSERT INTO users (id, username, email, password, goal) VALUES (?, ?, ?, ?, ?)',
      [id, username, email, hashedPassword, goal || 'maintain']
    );

    const token = jwt.sign({ id, username, email }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      success: true,
      token,
      user: { id, username, email, goal: goal || 'maintain' }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update streak
    const today = new Date().toISOString().split('T')[0];
    const lastActive = user.last_active ? user.last_active.split('T')[0] : '';
    let streak = user.streak || 0;

    if (lastActive === today) {
      // already logged in today
    } else if (lastActive === getPreviousDay(today)) {
      streak += 1;
    } else {
      streak = 1;
    }

    db.run('UPDATE users SET streak = ?, last_active = ? WHERE id = ?', [streak, new Date().toISOString(), user.id]);

    const token = jwt.sign({ id: user.id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

    const { password: _, ...userSafe } = user;
    userSafe.streak = streak;

    res.json({ success: true, token, user: userSafe });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

function getPreviousDay(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

module.exports = router;
