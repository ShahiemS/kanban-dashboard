<script>
  import { link } from 'svelte-spa-router';
  import Column from './Column.svelte';

  export let params = {};
  export let api;

  $: boardId = params.id;

  let board = null;
  let columns = [];
  let cards = [];
  let newColumnTitle = '';
  let loading = true;
  let error = '';

  async function loadBoard(id) {
    if (!id) return;
    loading = true;
    error = '';
    try {
      console.debug('[BoardView] fetching board', id, 'api base:', api);
      const [boardRes, colsRes, cardsRes] = await Promise.all([
        fetch(`${api}/api/boards/${id}`),
        fetch(`${api}/api/columns?board_id=${id}`),
        fetch(`${api}/api/cards?board_id=${id}`)
      ]);
      console.debug('[BoardView] responses', boardRes.status, colsRes.status, cardsRes.status);
      if (!boardRes.ok) throw new Error(`Board request failed (${boardRes.status})`);
      if (!colsRes.ok) throw new Error(`Columns request failed (${colsRes.status})`);
      if (!cardsRes.ok) throw new Error(`Cards request failed (${cardsRes.status})`);
      board = await boardRes.json();
      columns = await colsRes.json();
      cards = await cardsRes.json();
    } catch (err) {
      console.error('[BoardView] failed to load board', id, err);
      error = `Could not load this board (${err.message}). Is the server running?`;
    } finally {
      loading = false;
    }
  }

  $: loadBoard(boardId);

  async function addColumn() {
    if (!newColumnTitle.trim() || !boardId) return;
    try {
      const res = await fetch(`${api}/api/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newColumnTitle, position: columns.length, board_id: boardId })
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const col = await res.json();
      columns = [...columns, col];
      newColumnTitle = '';
    } catch (err) {
      error = 'Could not add column. Is the server running?';
    }
  }

  function handleCardMoved(event) {
    const updatedCard = event.detail;
    if (updatedCard.deleted) {
      cards = cards.filter(c => c.id !== updatedCard.id);
    } else if (cards.find(c => c.id === updatedCard.id)) {
      cards = cards.map(c => c.id === updatedCard.id ? updatedCard : c);
    } else {
      cards = [...cards, updatedCard];
    }
  }

  function handleArchiveAll(event) {
    const { column_id } = event.detail;
    cards = cards.filter(c => c.column_id !== column_id);
  }

  function handleColumnRenamed(event) {
    const updated = event.detail;
    columns = columns.map(c => c.id === updated.id ? updated : c);
  }

  function handleColumnMoved(event) {
    const { from, to } = event.detail;
    const fromIdx = columns.findIndex(c => c.id === from);
    const toIdx = columns.findIndex(c => c.id === to);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    const reordered = [...columns];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    columns = reordered;
    fetch(`${api}/api/columns/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: columns.map(c => c.id) })
    });
  }

  function handleColumnDeleted(event) {
    const { column_id } = event.detail;
    columns = columns.filter(c => c.id !== column_id);
    cards = cards.filter(c => c.column_id !== column_id);
  }
</script>

<header class="app-header">
  <nav class="breadcrumb">
    <a href="/" use:link class="breadcrumb-link">Boards</a>
    <span class="breadcrumb-sep">/</span>
    <span class="breadcrumb-current">{board ? board.title : '\u2026'}</span>
  </nav>

  <div class="board-controls">
    <div class="control-group">
      <input bind:value={newColumnTitle} placeholder="New column title" on:keydown={(e) => e.key === 'Enter' && addColumn()} />
      <button on:click={addColumn}>Add Column</button>
    </div>
  </div>
</header>

{#if error}
  <div class="boards-error">
    <p>{error}</p>
    <button class="secondary" on:click={() => loadBoard(boardId)}>Retry</button>
  </div>
{:else if loading}
  <p class="boards-empty">Loading board…</p>
{:else}
  <div class="board">
    {#each columns as column (column.id)}
      <Column {column} cards={cards.filter(c => c.column_id === column.id)} on:cardMoved={handleCardMoved} on:archiveAll={handleArchiveAll} on:columnRenamed={handleColumnRenamed} on:columnMoved={handleColumnMoved} on:columnDeleted={handleColumnDeleted} api={api} />
    {/each}
  </div>
{/if}
