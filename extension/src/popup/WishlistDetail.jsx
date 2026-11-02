/* global chrome */
import { useEffect, useState } from 'react';
import { getItems, addItem, removeItem, deleteWishlist } from './api.js';

export default function WishlistDetail({ wishlist, onBack }) {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState(null);

  async function load() {
    try {
      setItems(await getItems(wishlist.wishlist_id));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wishlist.wishlist_id]);

  // Fill the form from the tab the user is looking at.
  // Works with the "activeTab" permission you already have.
  async function useCurrentPage() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    setTitle(tab.title || '');
    setUrl(tab.url || '');
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim() || !url.trim()) {
      setError('Title and URL are required.');
      return;
    }
    setError(null);
    try {
      await addItem(wishlist.wishlist_id, {
        title: title.trim(),
        price: price ? Number(price) : null,
        source_url: url.trim(),
      });
      setTitle('');
      setPrice('');
      setUrl('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(itemId) {
    await removeItem(wishlist.wishlist_id, itemId);
    load();
  }

  async function handleDeleteList() {
    if (!confirm(`Delete "${wishlist.name}"?`)) return;
    await deleteWishlist(wishlist.wishlist_id);
    onBack();
  }

  return (
    <div>
      <button onClick={onBack}>← Back</button>
      <h3>{wishlist.name}</h3>

      <form onSubmit={handleAdd}>
        <p>
          <button type="button" onClick={useCurrentPage}>Use current page</button>
        </p>
        <p>
          <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </p>
        <p>
          <input placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
        </p>
        <p>
          <input placeholder="URL" value={url} onChange={(e) => setUrl(e.target.value)} />
        </p>
        <button type="submit">Add item</button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {items.length === 0 ? (
        <p>No items yet.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.item_id}>
              <a href={item.source_url} target="_blank" rel="noreferrer">{item.title}</a>
              {item.price != null && ` - $${item.price}`}{' '}
              <button onClick={() => handleRemove(item.item_id)}>Remove</button>
            </li>
          ))}
        </ul>
      )}

      <hr />
      <button onClick={handleDeleteList}>Delete this list</button>
    </div>
  );
}
