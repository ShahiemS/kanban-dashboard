<script>
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';

  export let api;

  const COVER_COLORS = ['#0079bf', '#d29034', '#519839', '#b04632', '#89609e', '#cd5a91', '#00aecc', '#4bbf6b'];
  const coverColor = (id) => COVER_COLORS[id % COVER_COLORS.length];

  let boards = [];
  let newBoardTitle = '';
  let loading = true;
  let error = '';
  let editingBoardId = null;
  let editTitle = '';
  let openMenuId = null;
  let showArchived = false;

  onMount(loadBoards);

  async function loadBoards() {
    loading = true;
    error = '';
    openMenuId = null;
    const url = `${api}/api/boards?archived=${showArchived}`;
    try {
      console.debug('[BoardsList] fetching', url);
      const res = await fetch(url);
      console.debug('[BoardsList] response', res.status, res.headers.get('content-type'));
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      boards = await res.json();
      console.debug('[BoardsList] loaded boards', boards);
    } catch (err) {
      console.error('[BoardsList] failed to load boards from', url, err);
      error = `Could not load boards (${err.message}). Is the server running?`;
    } finally {
      loading = false;
    }
  }

  function toggleArchivedView() {
    showArchived = !showArchived;
    loadBoards();
  }

  async function addBoard() {
    if (!newBoardTitle.trim()) return;
    try {
      const res = await fetch(`${api}/api/boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newBoardTitle })
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const board = await res.json();
      newBoardTitle = '';
      openBoard(board.id);
    } catch (err) {
      error = 'Could not create board. Is the server running?';
    }
  }

  function openBoard(id) {
    push(`/board/${id}`);
  }

  async function patchBoard(board, patch) {
    const res = await fetch(`${api}/api/boards/${board.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res.json();
  }

  async function toggleStar(board) {
    try {
      const updated = await patchBoard(board, { starred: !board.starred });
      boards = boards.map(b => b.id === updated.id ? updated : b).sort((a, b) => {
        if (a.starred !== b.starred) return a.starred ? -1 : 1;
        return a.id - b.id;
      });
    } catch (err) {
      error = 'Could not update board. Is the server running?';
    }
  }

  async function toggleArchived(board) {
    openMenuId = null;
    try {
      await patchBoard(board, { archived: !board.archived });
      boards = boards.filter(b => b.id !== board.id);
    } catch (err) {
      error = 'Could not update board. Is the server running?';
    }
  }

  async function deleteBoard(board) {
    openMenuId = null;
    if (!confirm(`Delete "${board.title}" and all its columns and cards?`)) return;
    try {
      const res = await fetch(`${api}/api/boards/${board.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      boards = boards.filter(b => b.id !== board.id);
    } catch (err) {
      error = 'Could not delete board. Is the server running?';
    }
  }

  function startRename(board) {
    openMenuId = null;
    editingBoardId = board.id;
    editTitle = board.title;
  }

  function cancelRename() {
    editingBoardId = null;
    editTitle = '';
  }

  async function renameBoard(board) {
    if (!editTitle.trim()) return;
    try {
      const updated = await patchBoard(board, { title: editTitle });
      boards = boards.map(b => b.id === updated.id ? updated : b);
      editingBoardId = null;
    } catch (err) {
      error = 'Could not rename board. Is the server running?';
    }
  }

  function toggleMenu(boardId) {
    openMenuId = openMenuId === boardId ? null : boardId;
  }
</script>

<header class="app-header">
  <h1>{showArchived ? 'Archived Boards' : 'Boards'}</h1>

  <div class="board-controls">
    {#if !showArchived}
      <div class="control-group">
        <input bind:value={newBoardTitle} placeholder="New board title" on:keydown={(e) => e.key === 'Enter' && addBoard()} />
        <button on:click={addBoard}>Add Board</button>
      </div>
    {/if}
    <button class="archived-toggle" on:click={toggleArchivedView}>
      {showArchived ? '← Back to boards' : 'View archived boards'}
    </button>
  </div>
</header>

{#if error}
  <div class="boards-error">
    <p>{error}</p>
    <button class="secondary" on:click={loadBoards}>Retry</button>
  </div>
{:else if loading}
  <p class="boards-empty">Loading boards…</p>
{:else if boards.length === 0}
  <p class="boards-empty">
    {showArchived ? 'No archived boards.' : 'No boards yet. Create your first board above.'}
  </p>
{:else}
  <div class="boards-grid">
    {#each boards as board (board.id)}
      <div class="board-card">
        <div class="board-card-cover" style="background: {coverColor(board.id)}">
          {#if !showArchived}
            <button
              class="board-card-star"
              class:starred={board.starred}
              on:click={() => toggleStar(board)}
              aria-label={board.starred ? 'Unstar board' : 'Star board'}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill={board.starred ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          {/if}
          <div class="board-card-menu-wrapper">
            <button class="board-card-menu-btn" on:click|stopPropagation={() => toggleMenu(board.id)} aria-label="Board options">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>
            {#if openMenuId === board.id}
              <div class="card-menu-dropdown board-card-menu-dropdown">
                {#if !showArchived}
                  <button on:click={() => startRename(board)}>Rename</button>
                {/if}
                <button on:click={() => toggleArchived(board)}>{board.archived ? 'Unarchive' : 'Archive'}</button>
                <button class="danger" on:click={() => deleteBoard(board)}>Delete</button>
              </div>
            {/if}
          </div>
        </div>

        {#if editingBoardId === board.id}
          <div class="board-card-rename">
            <input
              class="board-card-rename-input"
              bind:value={editTitle}
              on:keydown={(e) => {
                if (e.key === 'Enter') renameBoard(board);
                if (e.key === 'Escape') cancelRename();
              }}
            />
            <div class="board-card-rename-actions">
              <button on:click={() => renameBoard(board)}>Save</button>
              <button class="secondary" on:click={cancelRename}>Cancel</button>
            </div>
          </div>
        {:else}
          <button class="board-card-body" on:click={() => openBoard(board.id)}>
            <span class="board-card-title">{board.title}</span>
            <svg class="board-card-arrow" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        {/if}
      </div>
    {/each}
  </div>
{/if}
