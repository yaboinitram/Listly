import { useCallback, useEffect, useState } from 'react';
import { wishlistApi } from '../../lib/api';
import { readCurrentPage } from '../../lib/currentPage';
import { pluralize } from '../../lib/format';
import SaveCard from '../components/SaveCard';
import { ChevronIcon, GiftIcon, PlusIcon } from '../components/Icons';

export default function HomeView({ session, onOpenList, onSignOut }) {
  const [page, setPage] = useState(undefined); // undefined = loading; then a readCurrentPage() result
  const [wishlists, setWishlists] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setLoadError(null);
      setWishlists(await wishlistApi.list());
    } catch (err) {
      setLoadError(err.message);
      setWishlists((w) => w ?? []);
    }
  }, []);

  useEffect(() => {
    refresh();
    readCurrentPage()
      .then(setPage)
      .catch((err) => {
        console.error('[Listly] could not read page:', err);
        setPage({ status: 'unsupported' });
      });
  }, [refresh]);

  async function handleSave({ item, wishlistId, newListName }) {
    let list = wishlists.find((w) => w.wishlist_id === wishlistId);
    if (!list) list = await wishlistApi.create(newListName);
    await wishlistApi.addItem(list.wishlist_id, item);
    await refresh();
    return list;
  }

  async function handleCreate(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return setCreateError('Name your list.');
    try {
      await wishlistApi.create(name);
      setNewName('');
      setCreating(false);
      setCreateError(null);
      refresh();
    } catch (err) {
      setCreateError(err.message);
    }
  }

  const email = session.user?.email || '';

  return (
    <main className="shell">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="logo-mark logo-mark--small"><GiftIcon width={14} height={14} /></span>
          <span className="wordmark wordmark--small">Listly</span>
        </div>
        <details className="account">
          <summary aria-label={`Account: ${email}`}>{email.charAt(0).toUpperCase() || '?'}</summary>
          <div className="account__menu">
            <p className="small muted truncate">{email}</p>
            <button type="button" className="link-button" onClick={onSignOut}>Sign out</button>
          </div>
        </details>
      </header>

      <SaveCard
        page={page}
        wishlists={wishlists}
        onSave={handleSave}
        onOpenList={onOpenList}
      />

      <section className="lists" aria-labelledby="lists-heading">
        <div className="section-head">
          <h2 id="lists-heading">Your lists</h2>
          {!creating && (
            <button type="button" className="button button--ghost button--small" onClick={() => setCreating(true)}>
              <PlusIcon width={14} height={14} /> New list
            </button>
          )}
        </div>

        {creating && (
          <form className="inline-form" onSubmit={handleCreate}>
            <input
              className="input"
              aria-label="List name"
              placeholder="Birthday, Home, Someday…"
              maxLength={100}
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setCreating(false)}
            />
            <button type="submit" className="button button--primary button--small">Create</button>
            <button type="button" className="button button--ghost button--small" onClick={() => { setCreating(false); setCreateError(null); }}>
              Cancel
            </button>
            {createError && <p className="error small" role="alert">{createError}</p>}
          </form>
        )}

        {loadError && (
          <p className="error small" role="alert">
            {loadError} <button type="button" className="link-button" onClick={refresh}>Try again</button>
          </p>
        )}

        {wishlists === null ? (
          <ul className="rows" aria-busy="true">
            {[0, 1].map((i) => <li key={i} className="row row--skeleton" />)}
          </ul>
        ) : wishlists.length === 0 && !loadError ? (
          <p className="empty">No lists yet. Save something above and Listly will start one for you.</p>
        ) : (
          <ul className="rows">
            {wishlists.map((w) => (
              <li key={w.wishlist_id}>
                <button type="button" className="row row--button" onClick={() => onOpenList(w)}>
                  <span className="row__main">
                    <span className="row__title truncate">{w.name}</span>
                    <span className="row__sub">
                      {pluralize(w.item_count ?? 0, 'item')}
                      {w.share_id && <span className="pill">Shared</span>}
                    </span>
                  </span>
                  <ChevronIcon className="row__chevron" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
