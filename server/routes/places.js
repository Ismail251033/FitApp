/**
 * Places Routes - Gym, Parks, Running Spots
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const auth = require('../models/auth.middleware');

// GET /api/places
router.get('/', auth, (req, res) => {
  const { type, city } = req.query;
  let sql = `SELECT p.*, u.username FROM places p JOIN users u ON p.user_id = u.id WHERE 1=1`;
  const params = [];

  if (type) { sql += ' AND p.type = ?'; params.push(type); }
  if (city) { sql += ' AND p.city LIKE ?'; params.push(`%${city}%`); }

  sql += ' ORDER BY p.created_at DESC';
  const places = db.all(sql, params);
  res.json(places);
});

// POST /api/places
router.post('/', auth, (req, res) => {
  const { name, type, description, city, address } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Name and type required' });

  const id = uuidv4();
  db.run(
    'INSERT INTO places (id,user_id,name,type,description,city,address) VALUES (?,?,?,?,?,?,?)',
    [id, req.user.id, name, type, description || '', city || '', address || '']
  );
  res.json({ success: true, id });
});

// DELETE /api/places/:id
router.delete('/:id', auth, (req, res) => {
  db.run('DELETE FROM places WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  res.json({ success: true });
});

module.exports = router;
