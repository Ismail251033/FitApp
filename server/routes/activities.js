/**
 * Activity Routes - Workouts, Steps, Calories
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const auth = require('../models/auth.middleware');

// Goal targets
const GOAL_TARGETS = {
  'lose_weight':   { steps: 10000, calories_burn: 500, calories_intake: 1500 },
  'gain_muscle':   { steps: 7500,  calories_burn: 300, calories_intake: 2800 },
  'maintain':      { steps: 8000,  calories_burn: 300, calories_intake: 2000 }
};

// GET /api/activities - My activities
router.get('/', auth, (req, res) => {
  const activities = db.all(
    'SELECT * FROM activities WHERE user_id=? ORDER BY created_at DESC LIMIT 30',
    [req.user.id]
  );
  res.json(activities);
});

// GET /api/activities/stats - Daily stats
router.get('/stats', auth, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const todayActivities = db.all(
    "SELECT * FROM activities WHERE user_id=? AND date(created_at)=date(?)",
    [req.user.id, today]
  );

  const totalSteps = todayActivities.reduce((s, a) => s + (a.steps || 0), 0);
  const totalCalories = todayActivities.reduce((s, a) => s + (a.calories || 0), 0);
  const totalDuration = todayActivities.reduce((s, a) => s + (a.duration || 0), 0);

  const user = db.get('SELECT goal, weight FROM users WHERE id=?', [req.user.id]);
  const goal = user?.goal?.replace(' ', '_') || 'maintain';
  const targets = GOAL_TARGETS[goal] || GOAL_TARGETS['maintain'];

  // Weekly activity
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekly = db.all(
    "SELECT date(created_at) as day, SUM(steps) as steps, SUM(calories) as calories FROM activities WHERE user_id=? AND created_at >= ? GROUP BY day ORDER BY day ASC",
    [req.user.id, weekAgo.toISOString()]
  );

  res.json({
    today: { steps: totalSteps, calories: totalCalories, duration: totalDuration },
    targets,
    weekly
  });
});

// POST /api/activities - Log activity
router.post('/', auth, (req, res) => {
  const { type, duration, steps, calories, notes } = req.body;

  if (!type) return res.status(400).json({ error: 'Activity type required' });

  let calculatedCalories = calories || 0;

  // Auto-calculate calories if not provided
  if (!calories && duration) {
    const user = db.get('SELECT weight FROM users WHERE id=?', [req.user.id]);
    const weight = user?.weight || 70;
    const metValues = {
      running: 9.8, cycling: 7.5, swimming: 8.0, walking: 3.5,
      gym: 5.0, yoga: 2.5, hiit: 10.0, other: 4.0
    };
    const met = metValues[type] || 4.0;
    calculatedCalories = Math.round((met * weight * (duration / 60)));
  }

  const id = uuidv4();
  db.run(
    'INSERT INTO activities (id,user_id,type,duration,steps,calories,notes) VALUES (?,?,?,?,?,?,?)',
    [id, req.user.id, type, duration || 0, steps || 0, calculatedCalories, notes || '']
  );

  // Award XP
  const xpGain = Math.max(5, Math.floor(calculatedCalories / 10));
  db.run('UPDATE users SET xp = xp + ? WHERE id = ?', [xpGain, req.user.id]);

  // Check badges
  checkActivityBadges(req.user.id);

  res.json({ success: true, id, calories: calculatedCalories, xp_gained: xpGain });
});

// DELETE /api/activities/:id
router.delete('/:id', auth, (req, res) => {
  db.run('DELETE FROM activities WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  res.json({ success: true });
});

function checkActivityBadges(userId) {
  const count = db.get('SELECT COUNT(*) as count FROM activities WHERE user_id=?', [userId]);
  const total = count?.count || 0;

  const milestones = [
    { count: 1, type: 'first_workout' },
    { count: 10, type: 'ten_workouts' },
    { count: 50, type: 'fifty_workouts' },
    { count: 100, type: 'hundred_workouts' }
  ];

  for (const m of milestones) {
    if (total >= m.count) {
      const existing = db.get('SELECT id FROM badges WHERE user_id=? AND badge_type=?', [userId, m.type]);
      if (!existing) {
        db.run('INSERT INTO badges (id,user_id,badge_type) VALUES (?,?,?)', [uuidv4(), userId, m.type]);
      }
    }
  }
}

module.exports = router;
