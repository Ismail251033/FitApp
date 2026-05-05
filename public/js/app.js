/**
 * FitApp - Main Application JavaScript
 * Pure Vanilla JS, no frameworks
 */

// ═══════════════════════════════════════
//  STATE
// ═══════════════════════════════════════
const State = {
  user: null,
  currentPage: 'dashboard',
  feedTab: 'following',
  selectedActivity: 'running',
  timerRunning: false,
  timerSeconds: 0,
  timerInterval: null,
  timerStartTime: null,
  currentPostId: null,
  quickLogType: null,
  placesFilter: 'all',
  deferredInstallPrompt: null,
};

// ═══════════════════════════════════════
//  INIT
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Check if logged in
  const token = localStorage.getItem('fitapp_token');
  const userData = localStorage.getItem('fitapp_user');

  if (token && userData) {
    State.user = JSON.parse(userData);
    showApp();
    initDashboard();
  } else {
    showAuth();
  }

  // PWA install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    State.deferredInstallPrompt = e;
    const banner = document.getElementById('install-banner');
    banner.classList.remove('hidden');
    banner.style.display = 'flex';
  });
});

// ═══════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════
function showAuth() {
  document.getElementById('auth-wrapper').classList.remove('hidden');
  document.getElementById('app-wrapper').classList.add('hidden');
}

function showApp() {
  document.getElementById('auth-wrapper').classList.add('hidden');
  document.getElementById('app-wrapper').classList.remove('hidden');
}

function showLogin() {
  document.getElementById('login-page').classList.remove('hidden');
  document.getElementById('register-page').classList.add('hidden');
}

function showRegister() {
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('register-page').classList.remove('hidden');
}

async function authLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) return toast('Please fill in all fields', 'error');

  try {
    const res = await API.auth.login(email, password);
    localStorage.setItem('fitapp_token', res.token);
    localStorage.setItem('fitapp_user', JSON.stringify(res.user));
    State.user = res.user;
    showApp();
    initDashboard();
    toast('Welcome back! 💪', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function authRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const goal     = document.getElementById('reg-goal').value;

  if (!username || !email || !password) return toast('Please fill in all fields', 'error');

  try {
    const res = await API.auth.register(username, email, password, goal);
    localStorage.setItem('fitapp_token', res.token);
    localStorage.setItem('fitapp_user', JSON.stringify(res.user));
    State.user = res.user;
    showApp();
    initDashboard();
    toast('Account created! Let\'s go! 🚀', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

function logout() {
  localStorage.removeItem('fitapp_token');
  localStorage.removeItem('fitapp_user');
  State.user = null;
  if (State.timerInterval) clearInterval(State.timerInterval);
  showAuth();
}

// ═══════════════════════════════════════
//  PAGE NAVIGATION
// ═══════════════════════════════════════
function goPage(page) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Remove active from all nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show selected
  document.getElementById(`page-${page}`)?.classList.add('active');
  document.getElementById(`nav-${page}`)?.classList.add('active');

  State.currentPage = page;

  // Load page data
  switch(page) {
    case 'dashboard': initDashboard(); break;
    case 'feed':      loadFeed(); break;
    case 'workout':   loadActivities(); break;
    case 'places':    loadPlaces(); break;
    case 'profile':   loadProfile(State.user.id); break;
  }
}

// ═══════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════
async function initDashboard() {
  try {
    const [me, stats] = await Promise.all([
      API.users.me(),
      API.activities.stats()
    ]);

    State.user = me;
    localStorage.setItem('fitapp_user', JSON.stringify(me));

    // Greet
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';
    document.querySelector('[style*="Good morning"]').textContent = greet;
    document.getElementById('dash-username').textContent = me.username;

    // Avatar
    document.getElementById('dash-avatar-wrap').innerHTML = avatarHtml(me, 'avatar-md', true);

    // XP / Level
    const xpInLevel = me.xp % 100;
    document.getElementById('dash-level').textContent = `LVL ${me.level}`;
    document.getElementById('dash-xp').textContent = `${me.xp} XP`;
    document.getElementById('dash-xp-bar').style.width = `${xpInLevel}%`;

    // Stats
    document.getElementById('dash-steps').textContent    = stats.today.steps.toLocaleString();
    document.getElementById('dash-calories').textContent  = stats.today.calories.toLocaleString();
    document.getElementById('dash-streak').textContent   = me.streak;
    document.getElementById('dash-duration').textContent = stats.today.duration;

    const stepsPercent = Math.min(100, (stats.today.steps / stats.targets.steps) * 100);
    const calPercent   = Math.min(100, (stats.today.calories / stats.targets.calories_burn) * 100);
    document.getElementById('dash-steps-bar').style.width = `${stepsPercent}%`;
    document.getElementById('dash-cal-bar').style.width   = `${calPercent}%`;

    // Weekly chart
    renderWeeklyChart(stats.weekly);

    // Badges
    renderBadges(me.badges, 'dash-badges');

  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

function renderWeeklyChart(weekly) {
  const days = ['M','T','W','T','F','S','S'];
  const chart = document.getElementById('weekly-chart');
  const daysEl = document.getElementById('chart-days');

  if (!weekly || weekly.length === 0) {
    chart.innerHTML = '<span style="color:var(--text-muted);font-size:12px;">No data this week</span>';
    return;
  }

  const maxSteps = Math.max(...weekly.map(d => d.steps || 0), 1);
  const today = new Date().toISOString().split('T')[0];

  chart.innerHTML = weekly.map((d, i) => {
    const pct = Math.max(5, ((d.steps || 0) / maxSteps) * 100);
    const isToday = d.day === today;
    const dayName = new Date(d.day + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' }).slice(0,1);
    return `<div class="mini-bar ${isToday ? 'today' : ''}" style="height:${pct}%" title="${d.day}: ${d.steps} steps">
      <div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);font-size:9px;color:var(--text-muted)">${dayName}</div>
    </div>`;
  }).join('');

  daysEl.innerHTML = '';
}

function renderBadges(badges, containerId) {
  const container = document.getElementById(containerId);
  if (!badges || badges.length === 0) {
    container.innerHTML = '<span class="text-small text-muted">Complete workouts to earn badges!</span>';
    return;
  }

  const badgeMap = {
    first_workout:    { icon: '🏅', label: 'First Workout' },
    ten_workouts:     { icon: '🔥', label: '10 Workouts' },
    fifty_workouts:   { icon: '💪', label: '50 Workouts' },
    hundred_workouts: { icon: '🏆', label: '100 Workouts' },
  };

  container.innerHTML = badges.map(b => {
    const info = badgeMap[b.badge_type] || { icon: '⭐', label: b.badge_type };
    return `<div class="badge-chip">${info.icon} ${info.label}</div>`;
  }).join('');
}

// ═══════════════════════════════════════
//  FEED
// ═══════════════════════════════════════
async function loadFeed() {
  const container = document.getElementById('feed-container');
  container.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading posts...</p></div>';

  try {
    const posts = State.feedTab === 'following'
      ? await API.posts.feed()
      : await API.posts.explore();

    renderPosts(posts, container);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.message}</p></div>`;
  }
}

function switchFeedTab(tab, el) {
  State.feedTab = tab;
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  loadFeed();
}

function renderPosts(posts, container) {
  if (!posts || posts.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📭</div>
      <p>${State.feedTab === 'following' ? 'Follow people to see their posts here!' : 'No posts yet. Be the first!'}</p>
    </div>`;
    return;
  }

  container.innerHTML = posts.map(post => postCardHtml(post)).join('');
}

function postCardHtml(post) {
  const isOwn = post.user_id === State.user.id;
  const liked = !!post.user_liked;
  const timeStr = timeAgo(post.created_at);

  return `
    <div class="post-card" id="post-${post.id}">
      <div class="post-header">
        ${avatarHtml({id: post.user_id, avatar: post.avatar, username: post.username}, 'avatar-sm', false, `loadProfile('${post.user_id}')`)}
        <div class="post-meta" onclick="loadProfile('${post.user_id}')" style="cursor:pointer">
          <div class="post-username">${escHtml(post.username)}</div>
          <div class="post-time">${timeStr}</div>
        </div>
        ${isOwn ? `<button class="btn btn-ghost btn-icon" style="color:var(--text-muted)" onclick="deletePost('${post.id}')">
          <svg viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>` : ''}
      </div>
      ${post.image ? `<img src="${post.image}" class="post-image" alt="Post image" loading="lazy">` : ''}
      ${post.content ? `<div class="post-content">${escHtml(post.content)}</div>` : ''}
      <div class="post-actions">
        <button class="post-action-btn ${liked ? 'liked' : ''}" onclick="toggleLike('${post.id}', this)">
          <svg viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span id="likes-${post.id}">${post.like_count || 0}</span>
        </button>
        <button class="post-action-btn" onclick="openComments('${post.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>${post.comment_count || 0}</span>
        </button>
      </div>
    </div>
  `;
}

async function toggleLike(postId, btn) {
  try {
    const res = await API.posts.like(postId);
    const countEl = document.getElementById(`likes-${postId}`);
    const current = parseInt(countEl.textContent) || 0;

    if (res.liked) {
      btn.classList.add('liked');
      btn.querySelector('svg').setAttribute('fill', 'currentColor');
      countEl.textContent = current + 1;
    } else {
      btn.classList.remove('liked');
      btn.querySelector('svg').setAttribute('fill', 'none');
      countEl.textContent = Math.max(0, current - 1);
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function openComments(postId) {
  State.currentPostId = postId;
  openModal('modal-comments');

  const list = document.getElementById('comments-list');
  list.innerHTML = '<div class="text-muted text-small" style="padding:12px 0">Loading...</div>';

  try {
    const comments = await API.posts.comments(postId);
    if (!comments.length) {
      list.innerHTML = '<div class="empty-state" style="padding:20px 0"><p>No comments yet. Be the first!</p></div>';
      return;
    }
    list.innerHTML = comments.map(c => `
      <div class="user-item">
        ${avatarHtml({avatar: c.avatar, username: c.username}, 'avatar-sm')}
        <div>
          <div class="font-bold" style="font-size:13px">${escHtml(c.username)}</div>
          <div style="font-size:13px;color:var(--text-secondary)">${escHtml(c.content)}</div>
          <div class="text-muted text-small">${timeAgo(c.created_at)}</div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = `<p class="text-small" style="color:var(--danger)">${err.message}</p>`;
  }
}

async function submitComment() {
  const input = document.getElementById('comment-input');
  const content = input.value.trim();
  if (!content) return;

  try {
    await API.posts.comment(State.currentPostId, content);
    input.value = '';
    openComments(State.currentPostId);
    toast('Comment posted!', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deletePost(postId) {
  if (!confirm('Delete this post?')) return;
  try {
    await API.posts.delete(postId);
    document.getElementById(`post-${postId}`)?.remove();
    toast('Post deleted', 'info');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// Create Post
function openCreatePost() { openModal('modal-create-post'); }

async function submitPost() {
  const content = document.getElementById('post-content').value.trim();
  const imageFile = document.getElementById('post-image').files[0];

  if (!content) return toast('Please write something!', 'error');

  const fd = new FormData();
  fd.append('content', content);
  if (imageFile) fd.append('image', imageFile);

  try {
    await API.posts.create(fd);
    closeModal('modal-create-post');
    document.getElementById('post-content').value = '';
    document.getElementById('post-image').value = '';
    loadFeed();
    toast('Post published! 🎉', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ═══════════════════════════════════════
//  WORKOUT / TIMER
// ═══════════════════════════════════════
function selectActivity(type, chip) {
  State.selectedActivity = type;
  document.querySelectorAll('#activity-type-chips .chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  document.getElementById('timer-activity-label').textContent = `Activity: ${type.charAt(0).toUpperCase() + type.slice(1)}`;
}

function toggleTimer() {
  if (State.timerRunning) {
    // Pause
    clearInterval(State.timerInterval);
    State.timerRunning = false;
    document.getElementById('timer-btn').textContent = '▶ Resume';

    // Auto-save
    saveTimerActivity();
  } else {
    // Start
    State.timerRunning = true;
    State.timerStartTime = Date.now() - (State.timerSeconds * 1000);
    document.getElementById('timer-btn').textContent = '⏸ Pause';
    State.timerInterval = setInterval(updateTimerDisplay, 1000);
  }
}

function updateTimerDisplay() {
  State.timerSeconds = Math.floor((Date.now() - State.timerStartTime) / 1000);
  const h = Math.floor(State.timerSeconds / 3600);
  const m = Math.floor((State.timerSeconds % 3600) / 60);
  const s = State.timerSeconds % 60;
  document.getElementById('workout-timer').textContent =
    `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function resetTimer() {
  clearInterval(State.timerInterval);
  State.timerRunning = false;
  State.timerSeconds = 0;
  State.timerStartTime = null;
  document.getElementById('workout-timer').textContent = '00:00:00';
  document.getElementById('timer-btn').textContent = '▶ Start';
}

async function saveTimerActivity() {
  if (State.timerSeconds < 10) return;
  const duration = Math.floor(State.timerSeconds / 60);
  if (duration === 0) return;

  try {
    const res = await API.activities.log({
      type: State.selectedActivity,
      duration
    });
    toast(`Saved! +${res.xp_gained} XP 🔥`, 'success');
    loadActivities();
  } catch (err) {
    console.error(err);
  }
}

async function saveManualActivity() {
  const steps    = parseInt(document.getElementById('manual-steps').value) || 0;
  const duration = parseInt(document.getElementById('manual-duration').value) || 0;
  const notes    = document.getElementById('manual-notes').value.trim();

  if (!steps && !duration) return toast('Enter steps or duration', 'error');

  try {
    const res = await API.activities.log({
      type: State.selectedActivity,
      steps,
      duration,
      notes
    });

    document.getElementById('manual-steps').value = '';
    document.getElementById('manual-duration').value = '';
    document.getElementById('manual-notes').value = '';

    toast(`Activity logged! +${res.xp_gained} XP`, 'success');
    loadActivities();
    initDashboard();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function loadActivities() {
  try {
    const activities = await API.activities.list();
    const container = document.getElementById('activity-list');

    if (!activities.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">🏃</div><p>No activities yet. Start moving!</p></div>';
      return;
    }

    const icons = { running:'🏃', gym:'🏋️', cycling:'🚴', swimming:'🏊', walking:'🚶', yoga:'🧘', hiit:'⚡', other:'💪' };

    container.innerHTML = activities.map(a => `
      <div class="activity-item">
        <div class="activity-icon">${icons[a.type] || '💪'}</div>
        <div class="activity-info">
          <div class="activity-type">${a.type}</div>
          <div class="activity-meta">${a.notes || timeAgo(a.created_at)}</div>
        </div>
        <div class="activity-stats">
          ${a.duration ? `${a.duration}min<br>` : ''}
          ${a.steps ? `${a.steps.toLocaleString()} steps<br>` : ''}
          ${a.calories ? `${a.calories} kcal` : ''}
        </div>
        <button class="btn btn-ghost btn-icon" onclick="deleteActivity('${a.id}')" style="color:var(--text-muted)">
          <svg viewBox="0 0 24 24" width="14" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

async function deleteActivity(id) {
  try {
    await API.activities.delete(id);
    loadActivities();
    toast('Activity removed', 'info');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// Quick Log (from dashboard)
function quickLog(type) {
  State.quickLogType = type;
  document.getElementById('quick-log-title').textContent = `Log ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  openModal('modal-quick-log');
}

async function saveQuickLog() {
  const duration = parseInt(document.getElementById('quick-duration').value) || 0;
  const steps    = parseInt(document.getElementById('quick-steps').value) || 0;

  if (!duration && !steps) return toast('Enter duration or steps', 'error');

  try {
    const res = await API.activities.log({ type: State.quickLogType, duration, steps });
    closeModal('modal-quick-log');
    document.getElementById('quick-duration').value = '';
    document.getElementById('quick-steps').value = '';
    toast(`Logged! +${res.xp_gained} XP 🔥`, 'success');
    initDashboard();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ═══════════════════════════════════════
//  PLACES
// ═══════════════════════════════════════
async function loadPlaces(type = null) {
  const container = document.getElementById('places-list');
  container.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading...</p></div>';

  try {
    const params = {};
    if (type && type !== 'all') params.type = type;
    const places = await API.places.list(params);

    if (!places.length) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📍</div>
        <p>No places found. Add the first one!</p>
      </div>`;
      return;
    }

    const typeIcons = { gym:'🏋️', park:'🌳', track:'🏃', beach:'🏖', studio:'🧘', other:'📍' };

    container.innerHTML = places.map(p => `
      <div class="place-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span class="place-type-badge place-type-${p.type}">${typeIcons[p.type] || '📍'} ${p.type}</span>
          ${p.user_id === State.user.id ? `<button class="btn btn-ghost btn-icon" style="color:var(--text-muted)" onclick="deletePlace('${p.id}')">
            <svg viewBox="0 0 24 24" width="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>` : ''}
        </div>
        <div style="font-weight:700;font-size:15px;margin-bottom:4px">${escHtml(p.name)}</div>
        ${p.city ? `<div class="text-muted text-small" style="margin-bottom:6px">📍 ${escHtml(p.city)}${p.address ? ' · ' + escHtml(p.address) : ''}</div>` : ''}
        ${p.description ? `<div style="font-size:13px;color:var(--text-secondary);line-height:1.5">${escHtml(p.description)}</div>` : ''}
        <div class="text-muted text-small" style="margin-top:8px">Added by ${escHtml(p.username)}</div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.message}</p></div>`;
  }
}

function filterPlaces(type, chip) {
  State.placesFilter = type;
  document.querySelectorAll('#place-filter-chips .chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  loadPlaces(type);
}

function openAddPlace() { openModal('modal-add-place'); }

async function submitPlace() {
  const name    = document.getElementById('place-name').value.trim();
  const type    = document.getElementById('place-type').value;
  const city    = document.getElementById('place-city').value.trim();
  const address = document.getElementById('place-address').value.trim();
  const desc    = document.getElementById('place-desc').value.trim();

  if (!name) return toast('Place name required', 'error');

  try {
    await API.places.add({ name, type, city, address, description: desc });
    closeModal('modal-add-place');
    ['place-name','place-city','place-address','place-desc'].forEach(id => document.getElementById(id).value = '');
    loadPlaces();
    toast('Place added! 📍', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deletePlace(id) {
  try {
    await API.places.delete(id);
    loadPlaces(State.placesFilter === 'all' ? null : State.placesFilter);
    toast('Place removed', 'info');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ═══════════════════════════════════════
//  PROFILE
// ═══════════════════════════════════════
async function loadProfile(userId) {
  // Switch to profile page if not already there
  if (State.currentPage !== 'profile') {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-profile').classList.add('active');
    document.getElementById('nav-profile').classList.add('active');
    State.currentPage = 'profile';
  }

  const container = document.getElementById('profile-content');
  container.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading...</p></div>';

  try {
    const isMe = userId === State.user.id;
    const [profile, posts, progress] = await Promise.all([
      API.users.profile(userId),
      API.posts.byUser(userId),
      API.progress.list(userId)
    ]);

    const goalLabels = { lose_weight:'🔥 Lose Weight', gain_muscle:'💪 Gain Muscle', maintain:'⚖️ Maintain' };

    container.innerHTML = `
      <div class="page-header" style="padding-top:16px">
        ${isMe ? '' : `<button class="btn btn-ghost" onclick="goPage('feed')" style="margin-right:auto">← Back</button>`}
        ${isMe ? `<span style="flex:1"></span><button class="btn btn-secondary" onclick="openEditProfile()">✏️ Edit</button>` : ''}
      </div>

      <div class="profile-cover"></div>
      <div class="profile-header">
        <div class="profile-avatar-wrap" style="margin-top:-44px;display:block">
          ${avatarHtml(profile, 'avatar-xl')}
          ${isMe ? `<label style="position:absolute;bottom:0;right:0;background:var(--accent);border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;" title="Change photo">
            📷
            <input type="file" accept="image/*" onchange="uploadAvatar(this)" style="display:none">
          </label>` : ''}
        </div>

        <div style="margin-top:12px">
          <div style="font-size:22px;font-weight:700">${escHtml(profile.username)}</div>
          ${profile.bio ? `<div style="color:var(--text-secondary);font-size:14px;margin-top:4px">${escHtml(profile.bio)}</div>` : ''}
          <div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap">
            ${profile.goal ? `<span style="font-size:12px;color:var(--text-muted)">${goalLabels[profile.goal] || profile.goal}</span>` : ''}
            ${profile.city ? `<span style="font-size:12px;color:var(--text-muted)">📍 ${escHtml(profile.city)}</span>` : ''}
            ${profile.weight ? `<span style="font-size:12px;color:var(--text-muted)">⚖️ ${profile.weight}kg</span>` : ''}
            ${profile.height ? `<span style="font-size:12px;color:var(--text-muted)">📏 ${profile.height}cm</span>` : ''}
          </div>
        </div>

        <div class="profile-stats-row">
          <div class="profile-stat"><div class="profile-stat-value">${profile.posts_count}</div><div class="profile-stat-label">Posts</div></div>
          <div class="profile-stat"><div class="profile-stat-value">${profile.followers_count}</div><div class="profile-stat-label">Followers</div></div>
          <div class="profile-stat"><div class="profile-stat-value">${profile.following_count}</div><div class="profile-stat-label">Following</div></div>
          <div class="profile-stat"><div class="profile-stat-value" style="color:var(--gold)">${profile.level}</div><div class="profile-stat-label">Level</div></div>
        </div>

        ${!isMe ? `<button class="btn ${profile.is_following ? 'btn-secondary' : 'btn-primary'} btn-full mb-12" id="follow-btn" onclick="toggleFollow('${profile.id}')">
          ${profile.is_following ? '✓ Following' : '+ Follow'}
        </button>` : ''}

        ${isMe ? `<div style="display:flex;gap:8px;margin-bottom:12px">
          <button class="btn btn-secondary" style="flex:1" onclick="openModal('modal-progress')">📸 Progress Photo</button>
          <button class="btn btn-secondary" style="flex:1" onclick="openModal('modal-partners')">🤝 Find Partner</button>
          <button class="btn btn-danger" style="flex:1" onclick="logout()">🚪 Logout</button>
        </div>` : ''}

        ${profile.badges?.length ? `<div class="badges-row" id="profile-badges"></div>` : ''}
      </div>

      <!-- Tabs -->
      <div class="tabs mb-12" id="profile-tabs">
        <div class="tab active" onclick="showProfileTab('posts', this)">Posts</div>
        <div class="tab" onclick="showProfileTab('progress', this)">Progress</div>
      </div>

      <!-- Posts tab -->
      <div id="profile-posts">
        ${posts.length ? posts.map(p => postCardHtml(p)).join('') : '<div class="empty-state"><div class="empty-icon">📝</div><p>No posts yet</p></div>'}
      </div>

      <!-- Progress tab -->
      <div id="profile-progress" class="hidden">
        ${progress.length ? `<div class="progress-grid">${progress.map(ph => `
          <div class="progress-photo">
            <img src="${ph.image}" alt="Progress" loading="lazy">
            <div class="progress-photo-info">
              <div style="font-weight:600">${ph.weight ? ph.weight + 'kg' : ''}</div>
              <div style="color:var(--text-muted)">${timeAgo(ph.created_at)}</div>
            </div>
          </div>
        `).join('')}</div>` : '<div class="empty-state"><div class="empty-icon">📸</div><p>No progress photos yet</p></div>'}
      </div>
    `;

    // Render badges
    if (profile.badges?.length) {
      renderBadges(profile.badges, 'profile-badges');
    }

  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.message}</p></div>`;
  }
}

function showProfileTab(tab, el) {
  document.querySelectorAll('#profile-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('profile-posts').classList.toggle('hidden', tab !== 'posts');
  document.getElementById('profile-progress').classList.toggle('hidden', tab !== 'progress');
}

async function toggleFollow(userId) {
  try {
    const res = await API.users.follow(userId);
    const btn = document.getElementById('follow-btn');
    if (res.following) {
      btn.textContent = '✓ Following';
      btn.className = 'btn btn-secondary btn-full mb-12';
    } else {
      btn.textContent = '+ Follow';
      btn.className = 'btn btn-primary btn-full mb-12';
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

function openEditProfile() {
  const user = State.user;
  document.getElementById('edit-bio').value    = user.bio || '';
  document.getElementById('edit-weight').value = user.weight || '';
  document.getElementById('edit-height').value = user.height || '';
  document.getElementById('edit-city').value   = user.city || '';
  document.getElementById('edit-goal').value   = user.goal || 'maintain';
  openModal('modal-edit-profile');
}

async function saveProfile() {
  const data = {
    bio:    document.getElementById('edit-bio').value.trim(),
    weight: parseFloat(document.getElementById('edit-weight').value) || 0,
    height: parseFloat(document.getElementById('edit-height').value) || 0,
    city:   document.getElementById('edit-city').value.trim(),
    goal:   document.getElementById('edit-goal').value,
  };

  const avatarFile = document.getElementById('edit-avatar').files[0];

  try {
    await API.users.update(data);

    if (avatarFile) {
      const fd = new FormData();
      fd.append('avatar', avatarFile);
      await API.users.uploadAvatar(fd);
    }

    // Refresh user data
    const me = await API.users.me();
    State.user = me;
    localStorage.setItem('fitapp_user', JSON.stringify(me));

    closeModal('modal-edit-profile');
    loadProfile(State.user.id);
    toast('Profile updated! ✅', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function uploadAvatar(input) {
  if (!input.files[0]) return;
  const fd = new FormData();
  fd.append('avatar', input.files[0]);

  try {
    await API.users.uploadAvatar(fd);
    const me = await API.users.me();
    State.user = me;
    localStorage.setItem('fitapp_user', JSON.stringify(me));
    loadProfile(State.user.id);
    toast('Photo updated!', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function uploadProgressPhoto() {
  const photoFile = document.getElementById('progress-photo-input').files[0];
  if (!photoFile) return toast('Select a photo', 'error');

  const fd = new FormData();
  fd.append('photo', photoFile);
  fd.append('caption', document.getElementById('progress-caption').value);
  fd.append('weight',  document.getElementById('progress-weight').value);

  try {
    await API.progress.upload(fd);
    closeModal('modal-progress');
    loadProfile(State.user.id);
    toast('Progress photo uploaded! 📸', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// Partner Matching
async function searchPartners() {
  const city = document.getElementById('partner-city').value.trim();
  const goal = document.getElementById('partner-goal').value;

  try {
    const users = await API.users.discover({ city, goal });
    const container = document.getElementById('partners-list');

    if (!users.length) {
      container.innerHTML = '<div class="empty-state" style="padding:20px 0"><p>No partners found. Try different filters.</p></div>';
      return;
    }

    const goalLabels = { lose_weight:'🔥 Lose Weight', gain_muscle:'💪 Gain Muscle', maintain:'⚖️ Maintain' };

    container.innerHTML = users.map(u => `
      <div class="user-item">
        ${avatarHtml(u, 'avatar-sm', false, `closeModal('modal-partners');loadProfile('${u.id}')`)}
        <div class="user-item-info">
          <div class="user-item-name">${escHtml(u.username)}</div>
          <div class="user-item-meta">${goalLabels[u.goal] || u.goal}${u.city ? ' · ' + u.city : ''}</div>
        </div>
        <button class="btn btn-primary" style="padding:6px 12px;font-size:12px" onclick="toggleFollow('${u.id}');this.textContent='Following';this.className='btn btn-secondary'">Follow</button>
      </div>
    `).join('');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ═══════════════════════════════════════
//  MODAL HELPERS
// ═══════════════════════════════════════
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Close modal on backdrop click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// ═══════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════
function toast(message, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span> ${escHtml(message)}`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ═══════════════════════════════════════
//  PWA
// ═══════════════════════════════════════
async function installApp() {
  if (!State.deferredInstallPrompt) return;
  State.deferredInstallPrompt.prompt();
  const { outcome } = await State.deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    toast('App installed! 🎉', 'success');
    dismissInstall();
  }
  State.deferredInstallPrompt = null;
}

function dismissInstall() {
  document.getElementById('install-banner').classList.add('hidden');
}

// ═══════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════
function avatarHtml(user, sizeClass = 'avatar-md', clickable = false, onclickFn = '') {
  const onclick = clickable ? `onclick="goPage('profile')"` : onclickFn ? `onclick="${onclickFn}" style="cursor:pointer"` : '';
  if (user.avatar) {
    return `<img src="${user.avatar}" class="avatar ${sizeClass}" ${onclick} alt="${escHtml(user.username || '')}">`;
  }
  const initial = (user.username || '?').charAt(0).toUpperCase();
  const sizes = { 'avatar-sm': 32, 'avatar-md': 48, 'avatar-lg': 72, 'avatar-xl': 88 };
  const size = sizes[sizeClass] || 48;
  return `<div class="avatar-placeholder ${sizeClass}" style="width:${size}px;height:${size}px;font-size:${size*0.4}px;" ${onclick}>${initial}</div>`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return date.toLocaleDateString();
}

// ═══════════════════════════════════════
//  SERVICE WORKER REGISTRATION
// ═══════════════════════════════════════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('[SW] Registered:', reg.scope))
      .catch(err => console.warn('[SW] Registration failed:', err));
  });
}
