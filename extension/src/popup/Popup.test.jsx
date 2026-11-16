// T-130: what the popup shows when it opens, and after a token is rejected.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// vi.mock is hoisted above the imports, so the shared pieces are created with vi.hoisted.
const hooks = vi.hoisted(() => ({ onUnauthorized: null }));

vi.mock('../lib/storage', () => ({
  getSession: vi.fn(),
  saveSession: vi.fn().mockResolvedValue(undefined),
  clearSession: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../lib/api', () => ({
  onUnauthorized: (fn) => { hooks.onUnauthorized = fn; },
}));

// Small stand-ins for the three screens, so this file tests only Popup's own decisions.
const SESSION = { token: 'jwt-123', user: { user_id: 'u1', email: 'a@listly.test' } };
vi.mock('./views/AuthView', () => ({
  default: ({ onSignedIn }) => (
    <div>
      <p>Sign in screen</p>
      <button onClick={() => onSignedIn({ token: 'jwt-123', user: { user_id: 'u1', email: 'a@listly.test' } })}>Submit login</button>
    </div>
  ),
}));
vi.mock('./views/HomeView', () => ({
  default: ({ session, onSignOut }) => (
    <div>
      <p>Home for {session.user.email}</p>
      <button onClick={onSignOut}>Sign out</button>
    </div>
  ),
}));
vi.mock('./views/WishlistView', () => ({ default: () => <p>A wishlist</p> }));

import { clearSession, getSession, saveSession } from '../lib/storage';
import Popup from './Popup';

beforeEach(() => { hooks.onUnauthorized = null; vi.clearAllMocks(); });
afterEach(() => cleanup());

describe('Popup session handling (T-130)', () => {
  test('a saved session opens straight to the home screen, with no login', async () => {
    getSession.mockResolvedValue(SESSION);
    render(<Popup />);

    expect(await screen.findByText('Home for a@listly.test')).toBeTruthy();
    expect(screen.queryByText('Sign in screen')).toBeNull();
  });

  test('no saved session opens the login screen', async () => {
    getSession.mockResolvedValue(null);
    render(<Popup />);

    expect(await screen.findByText('Sign in screen')).toBeTruthy();
  });

  test('signing in saves the session and shows the home screen', async () => {
    getSession.mockResolvedValue(null);
    render(<Popup />);

    await userEvent.click(await screen.findByText('Submit login'));

    expect(saveSession).toHaveBeenCalledWith(SESSION);
    expect(await screen.findByText('Home for a@listly.test')).toBeTruthy();
  });

  test('when the server rejects the token, the popup returns to the login screen', async () => {
    getSession.mockResolvedValue(SESSION);
    render(<Popup />);
    await screen.findByText('Home for a@listly.test');

    await act(async () => { hooks.onUnauthorized(); });

    expect(await screen.findByText('Sign in screen')).toBeTruthy();
    expect(screen.queryByText('Home for a@listly.test')).toBeNull();
  });

  test('signing out clears the saved session and shows the login screen', async () => {
    getSession.mockResolvedValue(SESSION);
    render(<Popup />);

    await userEvent.click(await screen.findByText('Sign out'));

    expect(clearSession).toHaveBeenCalled();
    expect(await screen.findByText('Sign in screen')).toBeTruthy();
  });
});
