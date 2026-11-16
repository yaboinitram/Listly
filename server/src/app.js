const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pool = require('./db');
const authRoutes = require('./routes/auth');

const app = express();
const authenticate = require('./middleware/authenticate');
const wishlistRoutes = require('./routes/wishlists');
const shareRoutes = require('./routes/share');

// The public share page lives in the repo's web/ folder.
const WEB_DIR = path.join(__dirname, '..', '..', 'web');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        // The share page shows product photos from the stores' own servers, so allow images from
        // any web address. Scripts and styles stay limited to this server.
        'img-src': ["'self'", 'data:', 'https:', 'http:'],
      },
    },
  })
);
app.use(cors());
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/wishlists', authenticate, wishlistRoutes);//T-32: every owner-scope router goes behind authenticate
app.use('/share', shareRoutes); // T-85: public, no authenticate. The share ID is the permission.

// The share page a link opens: http://localhost:3000/s/<share_id>. Public, like /share.
// The page reads the list from GET /share/<share_id> in the browser.
app.use('/s/assets', express.static(path.join(WEB_DIR, 'assets')));
app.get('/s/:shareId', (req, res) => {
  res.sendFile(path.join(WEB_DIR, 'share.html'));
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'unreachable' });
  }
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status === 500) {
    // Log only the code and message. Printing the whole error can include err.sql,
    // which holds the INSERT values (email and password hash).
    console.error('Unhandled error:', err.code || 'NO_CODE', err.message);
  }
  res.status(status).json({ error: status === 500 ? 'Internal server error.' : err.message });
});

module.exports = app;