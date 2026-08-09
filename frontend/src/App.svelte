<script>
  import { onMount } from 'svelte';
  import Column from './lib/Column.svelte';
  import './app.css';

  const API = import.meta.env.VITE_API_URL || '';
  let columns = [];
  let cards = [];
  let newColumnTitle = '';

  onMount(async () => {
    const [colsRes, cardsRes] = await Promise.all([
      fetch(`${API}/api/columns`),
      fetch(`${API}/api/cards`)
    ]);
    columns = await colsRes.json();
    cards = await cardsRes.json();
  });

  async function addColumn() {
    if (!newColumnTitle.trim()) return;
    const res = await fetch(`${API}/api/columns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newColumnTitle, position: columns.length })
    });
    const col = await res.json();
    columns = [...columns, col];
    newColumnTitle = '';
  }

  function handleCardMoved(updatedCard) {
    if (updatedCard.deleted) {
      cards = cards.filter(c => c.id !== updatedCard.id);
    } else {
      cards = cards.map(c => c.id === updatedCard.id ? updatedCard : c);
    }
  }
</script>

<h1>Kanban Board</h1>

<div class="add-column">
  <input bind:value={newColumnTitle} placeholder="New column title" />
  <button on:click={addColumn}>Add Column</button>
</div>

<div class="board">
  {#each columns as column (column.id)}
    <Column {column} cards={cards.filter(c => c.column_id === column.id)} on:cardMoved={handleCardMoved} api={API} />
  {/each}
</div>
