<script>
  import { createEventDispatcher } from 'svelte';

  export let title = '';

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }
</script>

<svelte:window on:keydown={onKeydown} />

<div class="modal-backdrop" role="presentation" on:click={close}>
  <div class="modal-panel" on:click|stopPropagation role="dialog" aria-modal="true" aria-label={title}>
    <div class="modal-header">
      <h2 class="modal-title">{title}</h2>
      <button class="modal-close" on:click={close} aria-label="Close">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
    <div class="modal-body">
      <slot />
    </div>
  </div>
</div>
