const express = require('express');
const wishlistService = require('../services/wishlistService');
const itemService = require('../services/itemService');
const shareService = require('../services/shareService');
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

router.patch('/:wishlistId', async (req, res, next) => {
  try {
    const { name } = req.body ?? {};
    res.json(await wishlistService.renameWishlist(req.user.user_id, req.params.wishlistId, name));
  } catch (err) { next(err); }
});

router.delete('/:wishlistId', async (req, res, next) => {
  try {
    await wishlistService.deleteWishlist(req.user.user_id, req.params.wishlistId);
    res.status(204).end();
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

// T-73
router.put('/:wishlistId/items/:itemId', async (req, res, next) => {
  try {
    const { wishlistId, itemId } = req.params;
    res.json(await itemService.updateItem(req.user.user_id, wishlistId, itemId, req.body));
  } catch (err) { next(err); }
});

// T-74
router.delete('/:wishlistId/items/:itemId', async (req, res, next) => {
  try {
    const { wishlistId, itemId } = req.params;
    await itemService.removeItem(req.user.user_id, wishlistId, itemId);
    res.status(204).end();
  } catch (err) { next(err); }
});

// T-80: 201 when a new link is made, 200 when the wishlist was already shared.
router.post('/:wishlistId/share', async (req, res, next) => {
  try {
    const { share_id, created } = await shareService.createShareLink(req.user.user_id, req.params.wishlistId);
    res.status(created ? 201 : 200).json({ share_id });
  } catch (err) { next(err); }
});

module.exports = router;