<script>
  import Router from 'svelte-spa-router';
  import { wrap } from 'svelte-spa-router/wrap';
  import BoardsList from './lib/BoardsList.svelte';
  import BoardView from './lib/BoardView.svelte';
  import Login from './lib/Login.svelte';
  import { isAuthenticated, installAuthFetch, clearStoredPassword } from './lib/auth.js';

  installAuthFetch();

  const API = import.meta.env.VITE_API_URL || '';

  let authenticated = isAuthenticated();

  const routes = {
    '/': wrap({ component: BoardsList, props: { api: API } }),
    '/board/:id': wrap({ component: BoardView, props: { api: API } })
  };

  function handleLoginSuccess() {
    authenticated = true;
  }

  function logout() {
    clearStoredPassword();
    authenticated = false;
  }
</script>

{#if authenticated}
  <button class="logout-btn" on:click={logout}>Log out</button>
  <Router {routes} />
{:else}
  <Login api={API} onSuccess={handleLoginSuccess} />
{/if}
