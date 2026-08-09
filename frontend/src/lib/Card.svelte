<script>
  import { createEventDispatcher } from 'svelte';

  export let card;
  export let api;

  const dispatch = createEventDispatcher();

  function onDragStart(e) {
    e.dataTransfer.setData('cardId', card.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  async function deleteCard() {
    await fetch(`${api}/api/cards/${card.id}`, { method: 'DELETE' });
    dispatch('cardMoved', { ...card, deleted: true });
  }
</script>

<div class="card" draggable="true" on:dragstart={onDragStart} role="button" tabindex="0">
  <strong>{card.title}</strong>
  {#if card.description}
    <p>{card.description}</p>
  {/if}
  <button class="secondary" on:click|stopPropagation={deleteCard}>x</button>
</div>
