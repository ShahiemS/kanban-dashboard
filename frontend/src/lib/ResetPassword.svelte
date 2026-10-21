<script>
  export let api;
  export let token = '';

  let password = '';
  let confirm = '';
  let error = '';
  let done = false;
  let loading = false;

  async function submit() {
    if (!password || loading) return;
    error = '';
    if (password.length < 6) {
      error = 'Password must be at least 6 characters.';
      return;
    }
    if (password !== confirm) {
      error = 'Passwords do not match.';
      return;
    }
    loading = true;
    try {
      const res = await fetch(`${api}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      done = true;
    } catch (err) {
      error = err.message || 'Something went wrong. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<div class="login-screen">
  <form class="login-card" on:submit|preventDefault={submit}>
    <img src="/favicon.svg" alt="Werkethiek.nl" class="w-16 h-16 mx-auto mb-4" />
    <h1>Werkethiek.nl</h1>

    {#if done}
      <p class="login-subtitle">Your password has been updated.</p>
      <a href="#/" class="login-link-btn">Log in with your new password</a>
    {:else}
      <p class="login-subtitle">Choose a new password for your account.</p>
      <input
        type="password"
        bind:value={password}
        placeholder="New password"
        autocomplete="new-password"
        required
      />
      <input
        type="password"
        bind:value={confirm}
        placeholder="Repeat new password"
        autocomplete="new-password"
        required
      />
      {#if error}
        <p class="login-error">{error}</p>
      {/if}
      <button type="submit" disabled={loading}>
        {loading ? 'Saving…' : 'Set new password'}
      </button>
      <a href="#/" class="auth-switch">Back to log in</a>
    {/if}
  </form>
</div>
