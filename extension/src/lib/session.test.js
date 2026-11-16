// T-130: the session survives a browser restart, and an expired token sends the user back to login.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const SESSION = { token: 'jwt-123', user: { user_id: 'u1', email: 'a@listly.test' } };
const SESSION_KEY = 'listly.session';

// A stand-in for chrome.storage.local that keeps its data in a plain object.
function fakeChrome() {
  const data = {};
  return {
    data,
    chrome: {
      storage: {
        local: {
          get: vi.fn(async (key) => (key in data ? { [key]: data[key] } : {})),
          set: vi.fn(async (obj) => { Object.assign(data, obj); }),
          remove: vi.fn(async (key) => { delete data[key]; }),
        },
      },
    },
  };
}

beforeEach(() => { localStorage.clear(); vi.resetModules(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

describe('session storage (T-130)', () => {
  test('a saved session is still there after the extension restarts', async () => {
    const fake = fakeChrome();
    vi.stubGlobal('chrome', fake.chrome);

    const before = await import('./storage');
    await before.saveSession(SESSION);

    // A restart loads every module again; only chrome.storage keeps its data.
    vi.resetModules();
    const after = await import('./storage');
    expect(await after.getSession()).toEqual(SESSION);
  });

  test('with nothing saved, getSession returns null', async () => {
    vi.stubGlobal('chrome', fakeChrome().chrome);
    const { getSession } = await import('./storage');
    expect(await getSession()).toBeNull();
  });

  test('clearSession removes the saved session', async () => {
    const fake = fakeChrome();
    vi.stubGlobal('chrome', fake.chrome);
    const { saveSession, clearSession, getSession } = await import('./storage');

    await saveSession(SESSION);
    await clearSession();

    expect(await getSession()).toBeNull();
    expect(fake.data[SESSION_KEY]).toBeUndefined();
  });

  test('the localStorage fallback keeps the session too (popup previewed in a normal tab)', async () => {
    const before = await import('./storage');
    await before.saveSession(SESSION);

    vi.resetModules();
    const after = await import('./storage');
    expect(await after.getSession()).toEqual(SESSION);
  });
});

describe('an expired or rejected token (T-130)', () => {
  // Loads api.js fresh, with the real server routes turned on instead of the mock backend.
  async function loadApi(response) {
    vi.stubEnv('VITE_MOCK_WISHLISTS', 'false');
    const fetchMock = typeof response === 'function'
      ? vi.fn(response)
      : vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);
    const api = await import('./api');
    const storage = await import('./storage');
    return { ...api, ...storage, fetchMock };
  }

  const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

  test('requests send the saved token as a Bearer header', async () => {
    const { wishlistApi, saveSession, fetchMock } = await loadApi(reply(200, []));
    await saveSession(SESSION);

    await wishlistApi.list();

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer jwt-123');
  });

  test('a 401 clears the saved session and tells the popup to show login', async () => {
    const { wishlistApi, onUnauthorized, saveSession, getSession } =
      await loadApi(reply(401, { error: 'Invalid or expired token.' }));
    const backToLogin = vi.fn();
    onUnauthorized(backToLogin);
    await saveSession(SESSION);

    await expect(wishlistApi.list()).rejects.toMatchObject({ status: 401, message: 'Invalid or expired token.' });

    expect(await getSession()).toBeNull();
    expect(backToLogin).toHaveBeenCalledTimes(1);
  });

  test('a wrong password at login (401) does not clear a session or trigger the handler', async () => {
    const { authApi, onUnauthorized, saveSession, getSession } =
      await loadApi(reply(401, { error: 'Invalid email or password.' }));
    const backToLogin = vi.fn();
    onUnauthorized(backToLogin);
    await saveSession(SESSION);

    await expect(authApi.login('a@listly.test', 'wrong')).rejects.toMatchObject({ status: 401 });

    expect(await getSession()).toEqual(SESSION);
    expect(backToLogin).not.toHaveBeenCalled();
  });

  test('a server error (500) keeps the session', async () => {
    const { wishlistApi, onUnauthorized, saveSession, getSession } = await loadApi(reply(500, { error: 'Server error.' }));
    const backToLogin = vi.fn();
    onUnauthorized(backToLogin);
    await saveSession(SESSION);

    await expect(wishlistApi.list()).rejects.toMatchObject({ status: 500 });

    expect(await getSession()).toEqual(SESSION);
    expect(backToLogin).not.toHaveBeenCalled();
  });

  test("an unreachable server keeps the session (the user isn't logged out for being offline)", async () => {
    const { wishlistApi, onUnauthorized, saveSession, getSession } = await loadApi(async () => { throw new TypeError('Failed to fetch'); });
    const backToLogin = vi.fn();
    onUnauthorized(backToLogin);
    await saveSession(SESSION);

    await expect(wishlistApi.list()).rejects.toMatchObject({ status: 0 });

    expect(await getSession()).toEqual(SESSION);
    expect(backToLogin).not.toHaveBeenCalled();
  });
});