/**
 * Posts Routes - Feed, Create, Like, Comment
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const auth = require('../models/auth.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../public/uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `post_${Date.now()}_${uuidv4().slice(0,8)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/posts - Feed (posts from followed users + own)
router.get('/', auth, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  const posts = db.all(`
    SELECT p.*, u.username, u.avatar,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
      (SELECT id FROM likes WHERE post_id = p.id AND user_id = ?) as user_liked
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.user_id = ? OR p.user_id IN (
      SELECT following_id FROM follows WHERE follower_id = ?
    )
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `, [req.user.id, req.user.id, req.user.id, limit, offset]);

  res.json(posts);
});

// GET /api/posts/explore - All posts
router.get('/explore', auth, (req, res) => {
  const posts = db.all(`
    SELECT p.*, u.username, u.avatar,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
      (SELECT id FROM likes WHERE post_id = p.id AND user_id = ?) as user_liked
    FROM posts p
    JOIN users u ON p.user_id = u.id
    ORDER BY p.created_at DESC
    LIMIT 20
  `, [req.user.id]);

  res.json(posts);
});

// GET /api/posts/user/:id - User posts
router.get('/user/:id', auth, (req, res) => {
  const posts = db.all(`
    SELECT p.*, u.username, u.avatar,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
      (SELECT id FROM likes WHERE post_id = p.id AND user_id = ?) as user_liked
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.user_id = ?
    ORDER BY p.created_at DESC
  `, [req.user.id, req.params.id]);

  res.json(posts);
});

// POST /api/posts - Create post
router.post('/', auth, upload.single('image'), (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });

  const id = uuidv4();
  const image = req.file ? `/uploads/${req.file.filename}` : '';

  db.run('INSERT INTO posts (id,user_id,content,image) VALUES (?,?,?,?)', [id, req.user.id, content, image]);

  // Award XP
  db.run('UPDATE users SET xp = xp + 10 WHERE id = ?', [req.user.id]);
  checkLevelUp(req.user.id);

  res.json({ success: true, id });
});

// POST /api/posts/:id/like
router.post('/:id/like', auth, (req, res) => {
  const existing = db.get('SELECT id FROM likes WHERE post_id=? AND user_id=?', [req.params.id, req.user.id]);
  if (existing) {
    db.run('DELETE FROM likes WHERE post_id=? AND user_id=?', [req.params.id, req.user.id]);
    return res.json({ liked: false });
  }
  db.run('INSERT INTO likes (id,post_id,user_id) VALUES (?,?,?)', [uuidv4(), req.params.id, req.user.id]);
  res.json({ liked: true });
});

// GET /api/posts/:id/comments
router.get('/:id/comments', auth, (req, res) => {
  const comments = db.all(`
    SELECT c.*, u.username, u.avatar
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `, [req.params.id]);
  res.json(comments);
});

// POST /api/posts/:id/comments
router.post('/:id/comments', auth, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });

  const id = uuidv4();
  db.run('INSERT INTO comments (id,post_id,user_id,content) VALUES (?,?,?,?)', [id, req.params.id, req.user.id, content]);
  res.json({ success: true, id });
});

// DELETE /api/posts/:id
router.delete('/:id', auth, (req, res) => {
  const post = db.get('SELECT * FROM posts WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  if (!post) return res.status(403).json({ error: 'Not authorized' });

  db.run('DELETE FROM posts WHERE id=?', [req.params.id]);
  db.run('DELETE FROM likes WHERE post_id=?', [req.params.id]);
  db.run('DELETE FROM comments WHERE post_id=?', [req.params.id]);
  res.json({ success: true });
});

function checkLevelUp(userId) {
  const user = db.get('SELECT xp, level FROM users WHERE id=?', [userId]);
  if (!user) return;
  const newLevel = Math.floor(user.xp / 100) + 1;
  if (newLevel > user.level) {
    db.run('UPDATE users SET level=? WHERE id=?', [newLevel, userId]);
  }
}

module.exports = router;
