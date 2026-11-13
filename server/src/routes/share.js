const express = require('express');
const shareService = require('../services/shareService');

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