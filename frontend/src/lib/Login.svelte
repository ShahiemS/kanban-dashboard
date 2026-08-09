<script>
  import { setStoredPassword } from './auth.js';

  export let api;
  export let onSuccess;

  let password = '';
  let error = '';
  let loading = false;

  async function submit() {
    if (!password.trim() || loading) return;
    loading = true;
    error = '';
    try {
      const res = await fetch(`${api}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!res.ok) throw new Error('Invalid password');
      setStoredPassword(password);
      onSuccess();
    } catch (err) {
      error = 'Incorrect password. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<div class="login-screen">
  <form class="login-card" on:submit|preventDefault={submit}>
    <h1>Kanban Dashboard</h1>
    <p class="login-subtitle">This is a demo. Enter the password to continue.</p>
    <input
      type="password"
      bind:value={password}
      placeholder="Password"
      autocomplete="current-password"
    />
    {#if error}
      <p class="login-error">{error}</p>
    {/if}
    <button type="submit" disabled={loading}>{loading ? 'Checking…' : 'Enter'}</button>
  </form>
</div>
