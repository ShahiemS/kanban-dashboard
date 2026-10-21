<script>
  import Router from 'svelte-spa-router';
  import { wrap } from 'svelte-spa-router/wrap';
  import WorkspaceList from './lib/WorkspaceList.svelte';
  import BoardsList from './lib/BoardsList.svelte';
  import BoardView from './lib/BoardView.svelte';
  import Login from './lib/Login.svelte';
  import ResetPassword from './lib/ResetPassword.svelte';
  import { isAuthenticated, installAuthFetch, clearToken } from './lib/auth.js';

  installAuthFetch();

  const API = import.meta.env.VITE_API_URL || '';

  let authenticated = isAuthenticated();
  let hash = location.hash;

  $: resetToken = (hash.match(/^#\/reset-password\/(.+)$/) || [])[1] || '';

  const routes = {
    '/': wrap({ component: BoardsList, props: { api: API, onLogout: logout } }),
    '/workspace/:id': wrap({ component: BoardsList, props: { api: API, onLogout: logout } }),
    '/board/:id': wrap({ component: BoardView, props: { api: API, onLogout: logout } })
  };

  function handleLoginSuccess() {
    authenticated = true;
  }

  function logout() {
    fetch(`${API}/api/auth/logout`, { method: 'POST' }).catch(() => {});
    clearToken();
    authenticated = false;
  }
</script>

<svelte:window on:hashchange={() => (hash = location.hash)} />

{#if authenticated}
  <Router {routes} />
{:else if resetToken}
  <ResetPassword api={API} token={resetToken} />
{:else}
  <Login api={API} onSuccess={handleLoginSuccess} />
{/if}
