<script>
  import { setToken } from './auth.js';

  export let api;
  export let onSuccess;

  let mode = 'login'; // 'login' | 'signup'
  let name = '';
  let email = '';
  let password = '';
  let error = '';
  let loading = false;

  $: isSignup = mode === 'signup';

  function switchMode() {
    mode = isSignup ? 'login' : 'signup';
    error = '';
  }

  async function submit() {
    if (!email.trim() || !password || loading) return;
    loading = true;
    error = '';
    try {
      const res = await fetch(`${api}/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isSignup
            ? { name: name.trim(), email: email.trim(), password }
            : { email: email.trim(), password }
        )
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setToken(data.token);
      if (data.user?.name) {
        localStorage.setItem('kanban.user.name', data.user.name);
      }
      onSuccess();
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
    <p class="login-subtitle">
      {isSignup ? 'Create an account to get started.' : 'Log in to your account to continue.'}
    </p>

    {#if isSignup}
      <input
        type="text"
        bind:value={name}
        placeholder="Name"
        autocomplete="name"
      />
    {/if}
    <input
      type="email"
      bind:value={email}
      placeholder="Email"
      autocomplete="email"
      required
    />
    <input
      type="password"
      bind:value={password}
      placeholder="Password"
      autocomplete={isSignup ? 'new-password' : 'current-password'}
      required
    />

    {#if error}
      <p class="login-error">{error}</p>
    {/if}

    <button type="submit" disabled={loading}>
      {loading ? (isSignup ? 'Creating account…' : 'Logging in…') : (isSignup ? 'Sign up' : 'Log in')}
    </button>

    <button type="button" class="auth-switch" on:click={switchMode}>
      {isSignup ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
    </button>
  </form>
</div>
