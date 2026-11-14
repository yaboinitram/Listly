const express = require('express');
const shareService = require('../services/shareService');

/* T-102: /share, /share/ (no ID) and /share/abc/xyz (extra parts) answer in JSON, not with
Express's HTML error page, so the share page can show its "not found" message.*/
router.use((req, res) => {
  res.status(404).json({ error: 'Wishlist not found.' });
});

/* T-102: an ID with broken %-encoding (like %E0%A4%A) can't be a real link either. 
Express reports it as a URIError; any other error goes on to app.js as usual.*/
router.use((err, req, res, next) => {
  if (err instanceof URIError) return res.status(404).json({ error: 'Wishlist not found.' });
  next(err);
});

// Public: app.js mounts this router WITHOUT authenticate, so a share link works with no account.
const router = express.Router();

// T-85
router.get('/:shareId', async (req, res, next) => {
  try {
    res.json(await shareService.getSharedWishlist(req.params.shareId));
  } catch (err) { next(err); }
});

// T-91: shared wishlists are read-only. Every other method gets 405 and never reaches the database.
router.all('/:shareId', (req, res) => {
  res.set('Allow', 'GET').status(405).json({ error: 'Shared wishlists are read-only.' });
});

module.exports = router;