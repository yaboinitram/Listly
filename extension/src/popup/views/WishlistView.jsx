import { useCallback, useEffect, useState } from 'react';
import { wishlistApi } from '../../lib/api';
import { SHARE_BASE_URL } from '../../lib/config';
import { formatPrice, hostnameOf, pluralize } from '../../lib/format';
import Thumb from '../components/Thumb';
import { useToast } from '../components/Toast';
import { BackIcon, CloseIcon, LinkIcon } from '../components/Icons';

export default function WishlistView({ wishlist: initial, onBack }) {
  const [wishlist, setWishlist] = useState(initial);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(initial.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [toast, showToast] = useToast();

  const id = wishlist.wishlist_id;

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await wishlistApi.listItems(id));
    } catch (err) {
      setError(err.message);
      setItems((i) => i ?? []);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRename(e) {
    e.preventDefault();
    const name = draftName.trim();
    if (!name || name === wishlist.name) return setRenaming(false);
    try {
      await wishlistApi.rename(id, name);
      setWishlist((w) => ({ ...w, name }));
      setRenaming(false);
      showToast('List renamed');
    } catch (err) {
      showToast(err.message);
    }
  }

  async function handleShare() {
    try {
      const { share_id } = wishlist.share_id ? wishlist : await wishlistApi.share(id);
      setWishlist((w) => ({ ...w, share_id }));
      await navigator.clipboard.writeText(`${SHARE_BASE_URL}${share_id}`);
      showToast('Share link copied');
    } catch (err) {
      showToast(err.message || "Couldn't copy the link.");
    }
  }

  async function handleRemoveItem(item) {
    const previous = items;
    setItems((list) => list.filter((i) => i.item_id !== item.item_id));
    try {
      await wishlistApi.removeItem(id, item.item_id);
      showToast('Item removed');
    } catch (err) {
      setItems(previous);
      showToast(err.message);
    }
  }

  async function handleDeleteList() {
    try {
      await wishlistApi.remove(id);
      onBack({ deleted: true });
    } catch (err) {
      showToast(err.message);
    }
  }

  const count = items?.length ?? 0;

  return (
    <main className="shell">
      <header className="topbar">
        <button type="button" className="icon-button" onClick={() => onBack()} aria-label="Back to your lists">
          <BackIcon />
        </button>
        {renaming ? (
          <form className="rename" onSubmit={handleRename}>
            <input
              className="input"
              aria-label="List name"
              maxLength={100}
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setRenaming(false)}
            />
            <button type="submit" className="button button--primary button--small">Save</button>
          </form>
        ) : (
          <h1 className="list-title truncate" title="Rename list">
            <button type="button" className="list-title__button" onClick={() => { setDraftName(wishlist.name); setRenaming(true); }}>
              {wishlist.name}
            </button>
          </h1>
        )}
      </header>

      <div className="list-actions">
        <span className="muted small">{items ? pluralize(count, 'item') : ' '}</span>
        <button type="button" className="button button--ghost button--small" onClick={handleShare}>
          <LinkIcon width={14} height={14} />
          {wishlist.share_id ? 'Copy share link' : 'Share list'}
        </button>
      </div>

      {error && (
        <p className="error small" role="alert">
          {error} <button type="button" className="link-button" onClick={load}>Try again</button>
        </p>
      )}

      {items === null ? (
        <ul className="rows" aria-busy="true">
          {[0, 1, 2].map((i) => <li key={i} className="row row--skeleton row--tall" />)}
        </ul>
      ) : items.length === 0 && !error ? (
        <p className="empty">
          Nothing here yet. Open a product page and press Save to add it to this list.
        </p>
      ) : (
        <ul className="rows">
          {items.map((item) => {
            const price = formatPrice(item.price);
            return (
              <li key={item.item_id} className="row item">
                <Thumb src={item.image_url} size={48} />
                <a className="row__main item__link" href={item.source_url} target="_blank" rel="noreferrer">
                  <span className="row__title clamp-2">{item.title}</span>
                  <span className="row__sub">
                    {price && <strong className="item__price">{price}</strong>}
                    <span className="truncate">{item.retailer_name || hostnameOf(item.source_url)}</span>
                  </span>
                </a>
                <button
                  type="button"
                  className="icon-button icon-button--quiet"
                  aria-label={`Remove ${item.title}`}
                  onClick={() => handleRemoveItem(item)}
                >
                  <CloseIcon width={14} height={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="danger-zone">
        {confirmingDelete ? (
          <div className="confirm" role="alertdialog" aria-label="Delete list">
            <p className="small">
              Delete “{wishlist.name}”{count ? ` and its ${pluralize(count, 'item')}` : ''}? Anyone with the share link will lose access.
            </p>
            <div className="confirm__buttons">
              <button type="button" className="button button--danger button--small" onClick={handleDeleteList}>Delete list</button>
              <button type="button" className="button button--ghost button--small" onClick={() => setConfirmingDelete(false)}>Keep it</button>
            </div>
          </div>
        ) : (
          <button type="button" className="link-button link-button--danger" onClick={() => setConfirmingDelete(true)}>
            Delete this list
          </button>
        )}
      </footer>

      {toast}
    </main>
  );
}
