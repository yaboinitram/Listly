import { useState } from 'react';
import { authApi } from '../../lib/api';

export default function AuthView({ onSignedIn }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const isRegister = mode === 'register';

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (isRegister && password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    setBusy(true);
    try {
      const session = isRegister
        ? await authApi.register(email, password)
        : await authApi.login(email, password);
      await onSignedIn(session);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError(null);
  }

  return (
    <main className="shell auth">
      <div className="auth__brand">
        <img src="/icons/icon-128.png" alt="" width={40} height={40} style={{ display: 'block', flex: 'none' }} />
        <h1 className="wordmark">Listly</h1>
      </div>
      <p className="auth__intro">
        Save things you want from any store, keep them in a list, and share a link!
      </p>

      <div className="segmented" role="tablist" aria-label="Account">
        <button
          type="button"
          role="tab"
          aria-selected={!isRegister}
          className={!isRegister ? 'is-active' : ''}
          onClick={() => switchMode('login')}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isRegister}
          className={isRegister ? 'is-active' : ''}
          onClick={() => switchMode('register')}
        >
          Create account
        </button>
      </div>

      <form className="stack" onSubmit={handleSubmit} noValidate>
        <label className="field">
          <span>Email</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            className="input"
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            required
            minLength={isRegister ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {isRegister && <small className="muted">At least 8 characters.</small>}
        </label>

        {error && <p className="error small" role="alert">{error}</p>}

        <button type="submit" className="button button--primary button--block" disabled={busy}>
          {busy ? 'One moment…' : isRegister ? 'Create account' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
