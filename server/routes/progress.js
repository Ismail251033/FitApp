/**
 * Progress Photos Routes
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
    cb(null, `progress_${Date.now()}_${uuidv4().slice(0,8)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/progress/:userId
router.get('/:userId', auth, (req, res) => {
  const photos = db.all(
    'SELECT * FROM progress_photos WHERE user_id=? ORDER BY created_at ASC',
    [req.params.userId]
  );
  res.json(photos);
});

// POST /api/progress
router.post('/', auth, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });

  const id = uuidv4();
  const { caption, weight } = req.body;
  const image = `/uploads/${req.file.filename}`;

  db.run(
    'INSERT INTO progress_photos (id,user_id,image,caption,weight) VALUES (?,?,?,?,?)',
    [id, req.user.id, image, caption || '', weight || 0]
  );

  // XP for progress photo
  db.run('UPDATE users SET xp = xp + 20 WHERE id = ?', [req.user.id]);

  res.json({ success: true, id, image });
});

// DELETE /api/progress/:id
router.delete('/:id', auth, (req, res) => {
  db.run('DELETE FROM progress_photos WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  res.json({ success: true });
});

module.exports = router;
