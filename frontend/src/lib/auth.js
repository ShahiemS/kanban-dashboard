// Session-token auth. The backend issues an opaque bearer token on
// login/signup; we store it locally and attach it to every API request.
const TOKEN_KEY = 'werkethiek.token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated() {
  return !!getToken();
}

let installed = false;

// Patches window.fetch once so every request made anywhere in the app
// (BoardsList, BoardView, Column, Card, ...) automatically carries the
// Authorization header, without having to touch each call site.
export function installAuthFetch() {
  if (installed) return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const token = getToken();
    if (token) {
      const headers = new Headers(init.headers || {});
      headers.set('Authorization', `Bearer ${token}`);
      init = { ...init, headers };
    }
    const res = await originalFetch(input, init);
    const url = typeof input === 'string' ? input : input.url;
    // Session expired or invalid mid-session: drop it and reload so the
    // login screen shows. Auth endpoints return 401 for bad credentials —
    // never reload on those or the error message would never render.
    if (res.status === 401 && token && !url.includes('/api/auth/')) {
      clearToken();
      window.location.reload();
    }
    return res;
  };
}
