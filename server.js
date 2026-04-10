const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// Middleware
app.use(cors({
  origin: ALLOWED_ORIGIN,
  credentials: true
}));
app.use(express.json());

// Only serve static files if NOT on Render (frontend is on Netlify)
if (!process.env.RENDER_EXTERNAL_URL) {
  app.use(express.static(path.join(__dirname, 'public')));
}

// Simple file-based database (replace with real DB in production)
const DB_PATH = path.join(__dirname, 'db.json');

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    return { users: [], messages: [], notes: [] };
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// Auth middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// ==================== AUTH ROUTES ====================

// Sign up
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const db = loadDB();

    if (db.users.find(u => u.username === username)) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: Date.now().toString(),
      username,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };

    db.users.push(user);
    saveDB(db);

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: user.id, username: user.username }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// Sign in
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const db = loadDB();
    const user = db.users.find(u => u.username === username);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      message: 'Signed in successfully',
      token,
      user: { id: user.id, username: user.username }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during signin' });
  }
});

// ==================== MESSAGE ROUTES ====================

// Send message
app.post('/api/messages', authenticateToken, (req, res) => {
  try {
    const { content, recipientId } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Message content required' });
    }

    const db = loadDB();
    const message = {
      id: Date.now().toString(),
      senderId: req.user.id,
      recipientId: recipientId || null,
      content,
      createdAt: new Date().toISOString()
    };

    db.messages.push(message);
    saveDB(db);

    res.status(201).json({ message: 'Message sent', data: message });
  } catch (error) {
    res.status(500).json({ error: 'Server error sending message' });
  }
});

// Get my messages
app.get('/api/messages', authenticateToken, (req, res) => {
  try {
    const db = loadDB();
    const messages = db.messages.filter(
      m => m.senderId === req.user.id || m.recipientId === req.user.id
    );

    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching messages' });
  }
});

// Get users list
app.get('/api/users', authenticateToken, (req, res) => {
  try {
    const db = loadDB();
    const users = db.users
      .filter(u => u.id !== req.user.id)
      .map(u => ({ id: u.id, username: u.username }));

    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching users' });
  }
});

// ==================== NOTE ROUTES ====================

// Create note
app.post('/api/notes', authenticateToken, (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content required' });
    }

    const db = loadDB();
    const note = {
      id: Date.now().toString(),
      userId: req.user.id,
      title,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.notes.push(note);
    saveDB(db);

    res.status(201).json({ message: 'Note created', data: note });
  } catch (error) {
    res.status(500).json({ error: 'Server error creating note' });
  }
});

// Get my notes
app.get('/api/notes', authenticateToken, (req, res) => {
  try {
    const db = loadDB();
    const notes = db.notes.filter(n => n.userId === req.user.id);

    res.json({ notes });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching notes' });
  }
});

// Update note
app.put('/api/notes/:id', authenticateToken, (req, res) => {
  try {
    const { title, content } = req.body;
    const db = loadDB();
    const noteIndex = db.notes.findIndex(
      n => n.id === req.params.id && n.userId === req.user.id
    );

    if (noteIndex === -1) {
      return res.status(404).json({ error: 'Note not found' });
    }

    if (title) db.notes[noteIndex].title = title;
    if (content) db.notes[noteIndex].content = content;
    db.notes[noteIndex].updatedAt = new Date().toISOString();

    saveDB(db);

    res.json({ message: 'Note updated', data: db.notes[noteIndex] });
  } catch (error) {
    res.status(500).json({ error: 'Server error updating note' });
  }
});

// Delete note
app.delete('/api/notes/:id', authenticateToken, (req, res) => {
  try {
    const db = loadDB();
    const noteIndex = db.notes.findIndex(
      n => n.id === req.params.id && n.userId === req.user.id
    );

    if (noteIndex === -1) {
      return res.status(404).json({ error: 'Note not found' });
    }

    db.notes.splice(noteIndex, 1);
    saveDB(db);

    res.json({ message: 'Note deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting note' });
  }
});

// ==================== MONITORING ROUTE ====================

// Uptime Robot monitoring endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ==================== WEB INTERFACE ====================

// Serve main page (only when running locally, not on Render)
if (!process.env.RENDER_EXTERNAL_URL) {
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`Texting API running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
