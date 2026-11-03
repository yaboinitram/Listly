import { useEffect, useState } from 'react';
import { getWishlists, createWishlist } from './api.js';

export default function Wishlists({ onOpen }) {
  const [wishlists, setWishlists] = useState([]);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState(null);

  async function load() {
    try {
      setWishlists(await getWishlists());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await createWishlist(newName.trim());
      setNewName('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h3>My wishlists</h3>

      <form onSubmit={handleCreate}>
        <input
          placeholder="New list name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />{' '}
        <button type="submit">Create</button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {wishlists.length === 0 ? (
        <p>No wishlists yet.</p>
      ) : (
        <ul>
          {wishlists.map((w) => (
            <li key={w.wishlist_id}>
              <button onClick={() => onOpen(w)}>{w.name}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
