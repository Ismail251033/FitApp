/**
 * User Routes - Profile, Stats, Follow
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const auth = require('../models/auth.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer config for avatars
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../public/uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar_${req.user.id}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/users/me - Current user
router.get('/me', auth, (req, res) => {
  const user = db.get('SELECT id,username,email,bio,weight,height,goal,city,avatar,xp,level,streak,last_active,created_at FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const followers = db.all('SELECT COUNT(*) as count FROM follows WHERE following_id = ?', [req.user.id]);
  const following = db.all('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?', [req.user.id]);
  const postCount = db.get('SELECT COUNT(*) as count FROM posts WHERE user_id = ?', [req.user.id]);
  const badges = db.all('SELECT * FROM badges WHERE user_id = ?', [req.user.id]);

  res.json({
    ...user,
    followers_count: followers[0]?.count || 0,
    following_count: following[0]?.count || 0,
    posts_count: postCount?.count || 0,
    badges
  });
});

// PUT /api/users/me - Update profile
router.put('/me', auth, (req, res) => {
  const { bio, weight, height, goal, city } = req.body;
  db.run(
    'UPDATE users SET bio=?, weight=?, height=?, goal=?, city=? WHERE id=?',
    [bio || '', weight || 0, height || 0, goal || 'maintain', city || '', req.user.id]
  );
  res.json({ success: true });
});

// POST /api/users/avatar - Upload avatar
router.post('/avatar', auth, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const avatarUrl = `/uploads/${req.file.filename}`;
  db.run('UPDATE users SET avatar=? WHERE id=?', [avatarUrl, req.user.id]);
  res.json({ success: true, avatar: avatarUrl });
});

// GET /api/users/:id - Public profile
router.get('/:id', auth, (req, res) => {
  const user = db.get(
    'SELECT id,username,bio,weight,height,goal,city,avatar,xp,level,streak,created_at FROM users WHERE id = ?',
    [req.params.id]
  );
  if (!user) return res.status(404).json({ error: 'User not found' });

  const followers = db.get('SELECT COUNT(*) as count FROM follows WHERE following_id = ?', [req.params.id]);
  const following = db.get('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?', [req.params.id]);
  const postCount = db.get('SELECT COUNT(*) as count FROM posts WHERE user_id = ?', [req.params.id]);
  const isFollowing = db.get('SELECT id FROM follows WHERE follower_id=? AND following_id=?', [req.user.id, req.params.id]);
  const badges = db.all('SELECT * FROM badges WHERE user_id = ?', [req.params.id]);

  res.json({
    ...user,
    followers_count: followers?.count || 0,
    following_count: following?.count || 0,
    posts_count: postCount?.count || 0,
    is_following: !!isFollowing,
    badges
  });
});

// POST /api/users/:id/follow
router.post('/:id/follow', auth, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself' });

  const existing = db.get('SELECT id FROM follows WHERE follower_id=? AND following_id=?', [req.user.id, req.params.id]);
  if (existing) {
    db.run('DELETE FROM follows WHERE follower_id=? AND following_id=?', [req.user.id, req.params.id]);
    return res.json({ following: false });
  }

  db.run('INSERT INTO follows (id,follower_id,following_id) VALUES (?,?,?)', [uuidv4(), req.user.id, req.params.id]);
  res.json({ following: true });
});

// GET /api/users - Discover users (partner matching)
router.get('/', auth, (req, res) => {
  const { city, goal } = req.query;
  let sql = 'SELECT id,username,bio,goal,city,avatar,xp,level FROM users WHERE id != ?';
  const params = [req.user.id];

  if (city) { sql += ' AND city LIKE ?'; params.push(`%${city}%`); }
  if (goal) { sql += ' AND goal = ?'; params.push(goal); }

  sql += ' LIMIT 20';
  const users = db.all(sql, params);
  res.json(users);
});

module.exports = router;
