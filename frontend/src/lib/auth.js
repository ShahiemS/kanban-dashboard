// Lightweight shared-password gate for this demo. Not a real authentication
// system - just enough to keep the dashboard from being wide open publicly.
const STORAGE_KEY = 'kanban_demo_password';

export function getStoredPassword() {
  return sessionStorage.getItem(STORAGE_KEY) || '';
}

export function setStoredPassword(password) {
  sessionStorage.setItem(STORAGE_KEY, password);
}

export function clearStoredPassword() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function isAuthenticated() {
  return !!getStoredPassword();
}

let installed = false;

// Patches window.fetch once so every request made anywhere in the app
// (BoardsList, BoardView, Column, Card, ...) automatically carries the
// demo password header, without having to touch each call site.
export function installAuthFetch() {
  if (installed) return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const password = getStoredPassword();
    if (password) {
      const headers = new Headers(init.headers || {});
      headers.set('x-demo-password', password);
      init = { ...init, headers };
    }
    return originalFetch(input, init);
  };
}
