/**
 * FitApp API Client
 * Centralized fetch wrapper for all backend API calls
 */

const API = {
  baseUrl: '/api',

  // Get stored auth token
  token() {
    return localStorage.getItem('fitapp_token');
  },

  // Build headers
  headers(isFormData = false) {
    const h = { Authorization: `Bearer ${this.token()}` };
    if (!isFormData) h['Content-Type'] = 'application/json';
    return h;
  },

  // Generic request
  async request(method, path, data = null, isFormData = false) {
    const opts = {
      method,
      headers: this.headers(isFormData)
    };

    if (data) {
      opts.body = isFormData ? data : JSON.stringify(data);
    }

    try {
      const res = await fetch(this.baseUrl + path, opts);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || `Request failed: ${res.status}`);
      }

      return json;
    } catch (err) {
      throw err;
    }
  },

  get:    (path)          => API.request('GET',    path),
  post:   (path, data)    => API.request('POST',   path, data),
  put:    (path, data)    => API.request('PUT',    path, data),
  delete: (path)          => API.request('DELETE', path),
  upload: (path, formData) => API.request('POST',  path, formData, true),

  // ── Auth ──
  auth: {
    login:    (email, password)            => API.post('/auth/login', { email, password }),
    register: (username, email, password, goal) => API.post('/auth/register', { username, email, password, goal }),
  },

  // ── Users ──
  users: {
    me:            ()       => API.get('/users/me'),
    update:        (data)   => API.put('/users/me', data),
    uploadAvatar:  (fd)     => API.upload('/users/avatar', fd),
    profile:       (id)     => API.get(`/users/${id}`),
    follow:        (id)     => API.post(`/users/${id}/follow`),
    discover:      (params) => {
      const qs = new URLSearchParams(params).toString();
      return API.get(`/users?${qs}`);
    },
  },

  // ── Posts ──
  posts: {
    feed:     ()       => API.get('/posts'),
    explore:  ()       => API.get('/posts/explore'),
    byUser:   (id)     => API.get(`/posts/user/${id}`),
    create:   (fd)     => API.upload('/posts', fd),
    like:     (id)     => API.post(`/posts/${id}/like`),
    delete:   (id)     => API.delete(`/posts/${id}`),
    comments: (id)     => API.get(`/posts/${id}/comments`),
    comment:  (id, content) => API.post(`/posts/${id}/comments`, { content }),
  },

  // ── Activities ──
  activities: {
    list:   ()     => API.get('/activities'),
    stats:  ()     => API.get('/activities/stats'),
    log:    (data) => API.post('/activities', data),
    delete: (id)   => API.delete(`/activities/${id}`),
  },

  // ── Places ──
  places: {
    list:   (params) => {
      const qs = new URLSearchParams(params).toString();
      return API.get(`/places?${qs}`);
    },
    add:    (data) => API.post('/places', data),
    delete: (id)   => API.delete(`/places/${id}`),
  },

  // ── Progress ──
  progress: {
    list:   (userId) => API.get(`/progress/${userId}`),
    upload: (fd)     => API.upload('/progress', fd),
    delete: (id)     => API.delete(`/progress/${id}`),
  }
};
