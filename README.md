# 🏋️ FitApp — Fitness Social PWA

A complete fitness social web app with workout tracking, social feed, progress photos, partner matching, and fitness places discovery. Built with pure HTML/CSS/JS + Node.js + Express + SQLite.

---

## 📁 Project Structure

```
fitapp/
├── server.js                    ← Entry point
├── package.json
├── database.db                  ← Auto-created on first run
│
├── server/
│   ├── database/
│   │   └── db.js                ← SQLite (sql.js) setup & helpers
│   ├── models/
│   │   └── auth.middleware.js   ← JWT authentication middleware
│   └── routes/
│       ├── auth.js              ← Register / Login
│       ├── users.js             ← Profile, Follow, Discover
│       ├── posts.js             ← Feed, Create, Like, Comment
│       ├── activities.js        ← Workout tracking, Steps, Calories
│       ├── places.js            ← Fitness places
│       └── progress.js          ← Progress photos
│
└── public/                      ← Frontend (static)
    ├── index.html               ← Single Page Application shell
    ├── manifest.json            ← PWA manifest
    ├── service-worker.js        ← Offline support
    ├── css/
    │   └── app.css              ← Full design system (dark mode)
    ├── js/
    │   ├── api.js               ← API client (fetch wrapper)
    │   └── app.js               ← All UI logic (vanilla JS)
    ├── icons/                   ← PWA icons (72–512px)
    └── uploads/                 ← User-uploaded images (auto-created)
```

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Start the server
```bash
npm start
# Server runs at http://localhost:3000
```

### 3. Open in browser
```
http://localhost:3000
```

That's it! The SQLite database (`database.db`) is created automatically on first run.

---

## ✅ Features

| Feature | Description |
|---|---|
| 🔐 Auth | Register / Login with JWT tokens, password hashing |
| 👤 Profile | Avatar, bio, weight, height, goal, city |
| 🏋️ Workout Timer | Start/pause timer, auto-calculate calories |
| 📊 Stats | Daily steps, calories, duration, streak tracking |
| 📈 Weekly Chart | Visual bar chart of weekly activity |
| 🎯 Goals | Lose weight / Gain muscle / Maintain targets |
| 📱 Social Feed | Posts with photos, likes, comments |
| 📸 Progress Photos | Upload transformation photos with timeline |
| 📍 Places | Add gyms, parks, running tracks, beaches |
| 🤝 Partner Match | Find users by city and fitness goal |
| 🏅 Badges | Earn badges for workout milestones |
| ⭐ XP System | Gain XP and level up for every activity |
| 🔄 Follow System | Follow/unfollow other users |
| 📲 PWA | Install as app, offline support |

---

## 📲 PWA Installation

### On Desktop (Chrome/Edge):
1. Open `http://localhost:3000` in Chrome or Edge
2. Look for the **Install** button in the address bar (or a banner at the bottom)
3. Click **Install App**

### On Mobile (Android):
1. Open the URL in Chrome
2. Tap the **"Install App"** banner that appears
3. Or tap menu → **"Add to Home Screen"**

### On iOS (Safari):
1. Open in Safari
2. Tap the **Share** button → **"Add to Home Screen"**

---

## 🌐 API Endpoints

### Auth
```
POST /api/auth/register   { username, email, password, goal }
POST /api/auth/login      { email, password }
```

### Users
```
GET  /api/users/me
PUT  /api/users/me        { bio, weight, height, goal, city }
POST /api/users/avatar    (multipart: avatar file)
GET  /api/users/:id
POST /api/users/:id/follow
GET  /api/users?city=&goal=
```

### Posts
```
GET  /api/posts           (following feed)
GET  /api/posts/explore   (all posts)
GET  /api/posts/user/:id
POST /api/posts           (multipart: content, image?)
POST /api/posts/:id/like
GET  /api/posts/:id/comments
POST /api/posts/:id/comments  { content }
DELETE /api/posts/:id
```

### Activities
```
GET  /api/activities
GET  /api/activities/stats
POST /api/activities      { type, duration?, steps?, calories?, notes? }
DELETE /api/activities/:id
```

### Places
```
GET  /api/places?type=&city=
POST /api/places          { name, type, description, city, address }
DELETE /api/places/:id
```

### Progress Photos
```
GET  /api/progress/:userId
POST /api/progress        (multipart: photo, caption?, weight?)
DELETE /api/progress/:id
```

---

## 📦 Mobile App (Capacitor)

To wrap as a native mobile app (APK/IPA):

```bash
# 1. Install Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios

# 2. Initialize
npx cap init FitApp com.fitapp.app --web-dir public

# 3. Update capacitor.config.json - set server URL to your backend

# 4. Add platforms
npx cap add android
npx cap add ios

# 5. Build
npx cap sync

# 6. Open in Android Studio / Xcode
npx cap open android
npx cap open ios
```

> **Note:** For mobile deployment, host the Node.js backend on a cloud server (Railway, Render, DigitalOcean) and update the API base URL in `public/js/api.js`.

---

## 🔐 Environment Variables

Create a `.env` file (optional):
```env
PORT=3000
JWT_SECRET=your_super_secret_key_change_this
```

---

## 🗄️ Database Tables

| Table | Description |
|---|---|
| users | User accounts, profile, XP, level, streak |
| posts | Social posts with optional images |
| comments | Post comments |
| likes | Post likes (one per user per post) |
| activities | Workout sessions and manual logs |
| follows | Follow relationships |
| places | Gym/park/track locations |
| progress_photos | Transformation photos timeline |
| badges | Achievement badges |

---

## 🎨 Design

- **Theme:** Dark mode only
- **Colors:** Neon green accent (`#63d392`) + purple (`#7b8cff`)
- **Fonts:** Bebas Neue (headings) + DM Sans (body) + Space Mono (stats)
- **Layout:** Mobile-first, card-based, max-width 480px
- **Animations:** Smooth fade-ins, slide-up modals, shimmer skeletons

---

## 📋 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js, Express.js |
| Database | SQLite via sql.js (pure JS, no native bindings) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| File uploads | Multer |
| PWA | Web App Manifest + Service Worker |
