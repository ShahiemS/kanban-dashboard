<script>
  import { link } from 'svelte-spa-router';
  import { tick } from 'svelte';
  import Column from './Column.svelte';
  import WorkspaceSidebar from './WorkspaceSidebar.svelte';

  export let params = {};
  export let api;
  export let onLogout;

  $: boardId = params.id;

  let board = null;
  let columns = [];
  let cards = [];
  let newColumnTitle = '';
  let loading = true;
  let error = '';

  let editingTitle = false;
  let editTitle = '';
  let titleInput = null;

  let showAddColumn = false;
  let columnInput = null;

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

  function startEditTitle() {
    if (!board) return;
    editingTitle = true;
    editTitle = board.title;
    tick().then(() => titleInput?.focus());
  }

  function cancelEditTitle() {
    editingTitle = false;
    editTitle = '';
  }

  async function renameBoardTitle() {
    if (!editTitle.trim() || !board) return;
    try {
      const res = await fetch(`${api}/api/boards/${board.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle })
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      board = { ...board, title: editTitle };
      editingTitle = false;
      editTitle = '';
    } catch (err) {
      error = 'Could not rename board. Is the server running?';
    }
  }

  function openAddColumn() {
    showAddColumn = true;
    tick().then(() => columnInput?.focus());
  }

  function cancelAddColumn() {
    showAddColumn = false;
    newColumnTitle = '';
  }

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
      showAddColumn = false;
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

<div class="flex h-screen">
  <WorkspaceSidebar api={api} activeWorkspaceId={board?.workspace_id || null} />

  <div class="flex-1 flex flex-col min-w-0 p-6">
    <header class="app-header">
      <nav class="breadcrumb">
        <a href={`/workspace/${board?.workspace_id || ''}`} use:link class="breadcrumb-link">Boards</a>
        <span class="breadcrumb-sep">/</span>
        {#if editingTitle}
          <input
            bind:this={titleInput}
            class="min-w-[200px] bg-transparent border-b border-gray-900 p-0 text-inherit font-semibold text-[1.25rem] outline-none"
            bind:value={editTitle}
            on:keydown={(e) => {
              if (e.key === 'Enter') renameBoardTitle();
              if (e.key === 'Escape') cancelEditTitle();
            }}
          />
        {:else}
          <button
            class="bg-transparent border-none p-0 text-inherit font-semibold text-[1.25rem] cursor-pointer hover:opacity-80 hover:bg-transparent"
            on:click={startEditTitle}
          >
            {board ? board.title : '…'}
          </button>
        {/if}
      </nav>

      <div class="board-controls">
        <button class="logout" on:click={onLogout}>Log out</button>
      </div>
    </header>

    <div class="flex-1 overflow-auto">
      {#if error}
        <div class="boards-error">
          <p>{error}</p>
          <button class="secondary" on:click={() => loadBoard(boardId)}>Retry</button>
        </div>
      {:else if loading}
        <p class="boards-empty">Loading board…</p>
      {:else}
        {#if columns.length === 0}
          <p class="boards-empty mb-4">No lists yet. Add a list to get started.</p>
        {/if}

        <div class="board">
          {#each columns as column (column.id)}
            <Column {column} cards={cards.filter(c => c.column_id === column.id)} on:cardMoved={handleCardMoved} on:archiveAll={handleArchiveAll} on:columnRenamed={handleColumnRenamed} on:columnMoved={handleColumnMoved} on:columnDeleted={handleColumnDeleted} api={api} />
          {/each}

          {#if showAddColumn}
            <div class="flex flex-col justify-center w-[292px] min-w-[292px] min-h-[140px] p-0 bg-white bg-[radial-gradient(circle,#e5e5e5_1px,transparent_1px)] bg-[length:12px_12px] rounded-[10px] border border-dashed border-[#e6e6e6] transition hover:border-[#d4d4d4] hover:bg-[#fafafa]">
              <div class="flex-1 flex flex-col justify-center gap-2 p-3">
                <input
                  bind:this={columnInput}
                  class="w-full px-2 py-1.5 border border-[#e6e6e6] rounded-lg bg-white text-base font-medium text-gray-900 outline-none focus:border-gray-900"
                  bind:value={newColumnTitle}
                  placeholder="Column title"
                  on:keydown={(e) => {
                    if (e.key === 'Enter') addColumn();
                    if (e.key === 'Escape') cancelAddColumn();
                  }}
                />
                <div class="flex gap-2">
                  <button class="flex-1" on:click={addColumn}>Add</button>
                  <button class="flex-1 secondary" on:click={cancelAddColumn}>Cancel</button>
                </div>
              </div>
            </div>
          {:else}
            <button
              class="flex flex-col items-center justify-center w-[292px] min-w-[292px] min-h-[140px] p-3 bg-transparent bg-[radial-gradient(circle,#e5e5e5_1px,transparent_1px)] bg-[length:12px_12px] rounded-[10px] border border-dashed border-[#e6e6e6] cursor-pointer transition hover:border-[#d4d4d4] hover:bg-transparent text-gray-500 hover:text-gray-900"
              on:click={openAddColumn}
            >
              <span class="text-[1.75rem] font-light leading-none" aria-hidden="true">+</span>
              <span class="text-sm">Add column</span>
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>
