const express = require('express');
const wishlistService = require('../services/wishlistService');

const router = express.Router();

// req.user comes from the authenticate middleware in app.js.
// Express 5 sends errors from async handlers to the error handler, so no try/catch is needed.

router.post('/', async (req, res) => {
  const { name } = req.body ?? {};
  res.status(201).json(await wishlistService.createWishlist(req.user.user_id, name));
});

router.get('/', async (req, res) => {
  res.json({ wishlists: await wishlistService.listWishlists(req.user.user_id) });
});

router.post('/:id/items', async (req, res) => {
  const item = await wishlistService.addItem(req.user.user_id, req.params.id, req.body ?? {});
  res.status(201).json(item);
});

router.get('/:id/items', async (req, res) => {
  res.json({ items: await wishlistService.listItems(req.user.user_id, req.params.id) });
});

module.exports = router;