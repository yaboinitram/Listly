const express = require('express');
const wishlistService = require('../services/wishlistService');
const itemService = require('../services/itemService');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body ?? {};
    res.status(201).json(await wishlistService.createWishlist(req.user.user_id, name));
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    res.json(await wishlistService.listWishlists(req.user.user_id));
  } catch (err) { next(err); }
});

router.post('/:wishlistId/items', async (req, res, next) => {
  try {
    const item = await itemService.addItem(req.user.user_id, req.params.wishlistId, req.body);
    res.status(201).json(item);
  } catch (err) { next(err); }
});

router.get('/:wishlistId/items', async (req, res, next) => {
  try {
    res.json(await itemService.listItems(req.user.user_id, req.params.wishlistId));
  } catch (err) { next(err); }
});

module.exports = router;