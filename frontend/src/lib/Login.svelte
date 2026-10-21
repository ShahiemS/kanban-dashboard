<script>
  import { setToken } from './auth.js';

  export let api;
  export let onSuccess;

  let mode = 'login'; // 'login' | 'signup' | 'forgot'
  let name = '';
  let email = '';
  let password = '';
  let error = '';
  let notice = '';
  let loading = false;

  $: isSignup = mode === 'signup';
  $: isForgot = mode === 'forgot';

  function switchMode(next) {
    mode = next;
    error = '';
    notice = '';
  }

  async function submit() {
    if (!email.trim() || (!isForgot && !password) || loading) return;
    loading = true;
    error = '';
    notice = '';
    try {
      if (isForgot) {
        const res = await fetch(`${api}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() })
        });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        notice = `If an account exists for ${email.trim()}, we've sent a reset link. Check your inbox.`;
        return;
      }
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
      {#if isForgot}
        Enter your email and we'll send you a reset link.
      {:else if isSignup}
        Create an account to get started.
      {:else}
        Log in to your account to continue.
      {/if}
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
    {#if !isForgot}
      <input
        type="password"
        bind:value={password}
        placeholder="Password"
        autocomplete={isSignup ? 'new-password' : 'current-password'}
        required
      />
    {/if}

    {#if error}
      <p class="login-error">{error}</p>
    {/if}
    {#if notice}
      <p class="login-notice">{notice}</p>
    {/if}

    <button type="submit" disabled={loading}>
      {#if loading}
        {isForgot ? 'Sending…' : isSignup ? 'Creating account…' : 'Logging in…'}
      {:else}
        {isForgot ? 'Send reset link' : isSignup ? 'Sign up' : 'Log in'}
      {/if}
    </button>

    {#if !isForgot}
      <button type="button" class="auth-switch" on:click={() => switchMode('forgot')}>
        Forgot your password?
      </button>
    {/if}
    <button type="button" class="auth-switch" on:click={() => switchMode(isSignup ? 'login' : isForgot ? 'login' : 'signup')}>
      {#if isSignup}
        Already have an account? Log in
      {:else if isForgot}
        Back to log in
      {:else}
        Don't have an account? Sign up
      {/if}
    </button>
  </form>
</div>
