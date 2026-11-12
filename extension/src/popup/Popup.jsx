import { useEffect, useState } from 'react';
import { onUnauthorized } from '../lib/api';
import { clearSession, getSession, saveSession } from '../lib/storage';
import AuthView from './views/AuthView';
import HomeView from './views/HomeView';
import WishlistView from './views/WishlistView';

export default function Popup() {
  const [session, setSession] = useState(undefined); // undefined = still loading from storage
  const [route, setRoute] = useState({ name: 'home' });

  useEffect(() => {
    getSession().then(setSession);
    onUnauthorized(() => {
      setSession(null);
      setRoute({ name: 'home' });
    });
  }, []);

  async function handleSignedIn(newSession) {
    await saveSession(newSession);
    setSession(newSession);
    setRoute({ name: 'home' });
  }

  async function handleSignOut() {
    await clearSession();
    setSession(null);
  }

  if (session === undefined) return <main className="shell" aria-busy="true" />;
  if (!session) return <AuthView onSignedIn={handleSignedIn} />;

  if (route.name === 'wishlist') {
    return (
      <WishlistView
        key={route.wishlist.wishlist_id}
        wishlist={route.wishlist}
        onBack={() => setRoute({ name: 'home' })}
      />
    );
  }

  return (
    <HomeView
      session={session}
      onOpenList={(wishlist) => setRoute({ name: 'wishlist', wishlist })}
      onSignOut={handleSignOut}
    />
  );
}
