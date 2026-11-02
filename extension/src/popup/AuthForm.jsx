import { useState } from 'react';
import { login, register } from './api.js';

export default function AuthForm({ onAuth }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = isRegister ? await register(email, password) : await login(email, password);
      onAuth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3>{isRegister ? 'Create account' : 'Sign in'}</h3>

      <p>
        <label>
          Email
          <br />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
      </p>

      <p>
        <label>
          Password
          <br />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {isRegister && <><br /><small>At least 8 characters</small></>}
      </p>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button type="submit" disabled={loading}>
        {loading ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
      </button>

      <p>
        {isRegister ? 'Already have an account? ' : 'New here? '}
        <button type="button" onClick={() => { setIsRegister(!isRegister); setError(null); }}>
          {isRegister ? 'Sign in' : 'Create account'}
        </button>
      </p>
    </form>
  );
}
