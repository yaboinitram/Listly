import { useEffect, useMemo, useState } from 'react';
import Thumb from './Thumb';
import { CheckIcon } from './Icons';
import { hostnameOf } from '../../lib/format';
import { validateItemForm } from '../../lib/validateItem';
import { getLastWishlistId, setLastWishlistId } from '../../lib/storage';

const NEW_LIST = '__new__';

/** One line under the product explaining anything the user should know about what was read. */
function PageNotice({ page }) {
  if (page.isSample) {
    return (
      <p className="notice small">
        Preview mode: this is sample data. To read real pages, open Listly from the toolbar icon while you're on a store page.
      </p>
    );
  }
  if (page.status === 'blocked') {
    return (
      <p className="notice small" title={page.reason}>
        Chrome didn't let Listly read this page, so fill in the price yourself. If this happens on every site, reload Listly in chrome://extensions.
      </p>
    );
  }
  if (page.price == null) {
    return <p className="hint small">No price found on this page. Type it in if you want one saved.</p>;
  }
  if (page.priceIsGuess) {
    return <p className="hint small">The price is a best guess from the page. Check it before saving.</p>;
  }
  if (!page.looksLikeProduct) {
    return <p className="hint small">This doesn't look like a product page. You can still save it.</p>;
  }
  return null;
}

/**
 * The "gift tag": shows what Listly found on the current page and saves it to a list.
 * props:
 *   page       – result of readCurrentPage(), or null / undefined (loading)
 *   wishlists  – array of wishlists (may be empty)
 *   onSave     – async ({ item, wishlistId, newListName }) => savedWishlist
 *   onOpenList – (wishlist) => void
 */
export default function SaveCard({ page, wishlists: maybeWishlists, onSave, onOpenList }) {
  const listsLoaded = maybeWishlists != null;
  const wishlists = useMemo(() => maybeWishlists ?? [], [maybeWishlists]);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [listId, setListId] = useState('');
  const [newListName, setNewListName] = useState('My wishlist');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedTo, setSavedTo] = useState(null);

  // Prefill from the page once it's read.
  useEffect(() => {
    if (!page) return;
    setTitle(page.title || '');
    setPrice(page.price != null ? Number(page.price).toFixed(2) : '');
  }, [page]);

  // Default the list picker to the last list used, else the first list.
  useEffect(() => {
    if (!listsLoaded) return;
    let cancelled = false;
    getLastWishlistId().then((lastId) => {
      if (cancelled) return;
      setListId((current) => {
        if (current && (current === NEW_LIST || wishlists.some((w) => w.wishlist_id === current))) return current;
        if (wishlists.some((w) => w.wishlist_id === lastId)) return lastId;
        return wishlists[0]?.wishlist_id || NEW_LIST;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [wishlists, listsLoaded]);

  if (page === undefined) {
    return (
      <section className="tag tag--loading" aria-busy="true">
        <div className="tag__hole" />
        <p className="muted">Reading this page…</p>
      </section>
    );
  }

  if (page.status === 'unsupported') {
    return (
      <section className="tag tag--idle">
        <div className="tag__hole" />
        <p className="tag__headline">Open a product page to save it</p>
      </section>
    );
  }

  if (savedTo) {
    return (
      <section className="tag tag--saved">
        <div className="tag__hole" />
        <div className="saved">
          <span className="saved__check"><CheckIcon width={18} height={18} /></span>
          <div>
            <p className="tag__headline">Saved to {savedTo.name}</p>
            <button type="button" className="link-button" onClick={() => onOpenList(savedTo)}>
              View list
            </button>
          </div>
        </div>
      </section>
    );
  }

  const creatingList = listId === NEW_LIST;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const checked = validateItemForm({ title, price });
    if (!checked.ok) return setError(checked.error);
    if (creatingList && !newListName.trim()) return setError('Name your new list.');

    setSaving(true);
    try {
      const list = await onSave({
        item: {
          title: checked.item.title,
          price: checked.item.price,
          image_url: page.image_url,
          source_url: page.source_url,
        },
        wishlistId: creatingList ? null : listId,
        newListName: creatingList ? newListName.trim() : null,
      });
      await setLastWishlistId(list.wishlist_id);
      setListId(list.wishlist_id);
      setSavedTo(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="tag" onSubmit={handleSubmit} noValidate>
      <div className="tag__hole" />

      <div className="tag__product">
        <Thumb src={page.image_url} size={64} />
        <div className="tag__fields">
          <label className="sr-only" htmlFor="save-title">Item name</label>
          <textarea
            id="save-title"
            className="input input--title"
            rows={2}
            maxLength={255}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="tag__meta">
            <label className="price-field">
              <span className="sr-only">Price</span>
              <span aria-hidden="true">$</span>
              <input
                className="input input--price"
                inputMode="decimal"
                placeholder="Price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
            <span className="muted small truncate">{hostnameOf(page.source_url)}</span>
          </div>
        </div>
      </div>

      <PageNotice page={page} />


      <div className="tag__actions">
        <label className="sr-only" htmlFor="save-list">Save to list</label>
        {wishlists.length > 0 ? (
          <select id="save-list" className="input select" value={listId} onChange={(e) => setListId(e.target.value)}>
            {wishlists.map((w) => (
              <option key={w.wishlist_id} value={w.wishlist_id}>{w.name}</option>
            ))}
            <option value={NEW_LIST}>New list…</option>
          </select>
        ) : null}
        {creatingList && (
          <input
            className="input"
            aria-label="New list name"
            maxLength={100}
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            autoFocus={wishlists.length > 0}
          />
        )}
        <button type="submit" className="button button--primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {error && <p className="error small" role="alert">{error}</p>}
    </form>
  );
}
