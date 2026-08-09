<script>
  import { createEventDispatcher } from 'svelte';
  import Card from './Card.svelte';

  export let column;
  export let cards;
  export let api;

  const dispatch = createEventDispatcher();

  let newTitle = '';
  let newDesc = '';
  let showAdd = false;
  let dragOver = false;

  async function addCard() {
    if (!newTitle.trim()) return;
    const res = await fetch(`${api}/api/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle,
        description: newDesc,
        column_id: column.id,
        position: cards.length
      })
    });
    const card = await res.json();
    dispatch('cardMoved', card);
    newTitle = '';
    newDesc = '';
    showAdd = false;
  }

  function onDragOver(e) {
    e.preventDefault();
    dragOver = true;
  }

  function onDragLeave() {
    dragOver = false;
  }

  async function onDrop(e) {
    e.preventDefault();
    dragOver = false;
    const cardId = e.dataTransfer.getData('cardId');
    const targetCardId = e.dataTransfer.getData('targetCardId');
    if (!cardId || targetCardId) return;
    const res = await fetch(`${api}/api/cards/${cardId}/move`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ column_id: column.id, position: cards.length })
    });
    const updated = await res.json();
    dispatch('cardMoved', updated);
  }
</script>

<div
  class="column"
  class:drag-over={dragOver}
  on:dragover={onDragOver}
  on:dragleave={onDragLeave}
  on:drop={onDrop}
  role="list"
>
  <h2>{column.title}</h2>

  <div class="cards">
    {#each cards as card (card.id)}
      <Card {card} {api} on:cardMoved />
    {/each}
  </div>

  {#if showAdd}
    <div class="add-card">
      <input bind:value={newTitle} placeholder="Card title" />
      <textarea bind:value={newDesc} placeholder="Description" />
      <button on:click={addCard}>Add</button>
      <button class="secondary" on:click={() => showAdd = false}>Cancel</button>
    </div>
  {:else}
    <button class="secondary" on:click={() => showAdd = true}>+ Add card</button>
  {/if}
</div>
