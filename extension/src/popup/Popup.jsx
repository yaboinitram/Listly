/* global chrome */
import { useEffect, useState } from 'react';
import AuthForm from './AuthForm.jsx';
import Wishlists from './Wishlists.jsx';
import WishlistDetail from './WishlistDetail.jsx';

export default function Popup() {
  const [user, setUser] = useState(undefined); // undefined = still checking storage
  const [openList, setOpenList] = useState(null); // the wishlist being viewed, if any

  // Check for a saved login each time the popup opens
  useEffect(() => {
    chrome.storage.local.get('user').then((result) => setUser(result.user ?? null));
  }, []);

  async function handleAuth(data) {
    // data is { token, user } from the server
    await chrome.storage.local.set({ token: data.token, user: data.user });
    setUser(data.user);
  }

  async function handleLogout() {
    await chrome.storage.local.remove(['token', 'user']);
    setUser(null);
    setOpenList(null);
  }

  if (user === undefined) return null;

  return (
    <div style={{ width: 320, padding: 16, fontFamily: 'sans-serif' }}>
      {!user ? (
        <AuthForm onAuth={handleAuth} />
      ) : (
        <>
          <p>
            Signed in as {user.email} <button onClick={handleLogout}>Sign out</button>
          </p>
          <hr />
          {openList ? (
            <WishlistDetail wishlist={openList} onBack={() => setOpenList(null)} />
          ) : (
            <Wishlists onOpen={setOpenList} />
          )}
        </>
      )}
    </div>
  );
}
