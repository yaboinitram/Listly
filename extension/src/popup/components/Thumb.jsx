import { useState } from 'react';
import { GiftIcon } from './Icons';

/** Product image with a graceful placeholder when there's no image or it fails to load. */
export default function Thumb({ src, size = 48, alt = '' }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };

  if (!src || failed) {
    return (
      <div className="thumb thumb--empty" style={style}>
        <GiftIcon width={size * 0.4} height={size * 0.4} />
      </div>
    );
  }
  return (
    <img
      className="thumb"
      style={style}
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
