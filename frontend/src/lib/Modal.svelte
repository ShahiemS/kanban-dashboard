<script>
  import { createEventDispatcher } from 'svelte';
  import { X } from 'phosphor-svelte';

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
        <X size={18} />
      </button>
    </div>
    <div class="modal-body">
      <slot />
    </div>
  </div>
</div>
