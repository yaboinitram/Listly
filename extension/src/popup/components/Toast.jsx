import { useCallback, useEffect, useRef, useState } from 'react';

/** Small status message at the bottom of the popup. */
export function useToast() {
  const [message, setMessage] = useState(null);
  const timer = useRef();

  const show = useCallback((text) => {
    clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(null), 2200);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const node = (
    <div className={`toast${message ? ' toast--visible' : ''}`} role="status" aria-live="polite">
      {message}
    </div>
  );
  return [node, show];
}
