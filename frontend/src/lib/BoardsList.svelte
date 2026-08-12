<script>
  import { tick, onMount } from 'svelte';
  import { link, push } from 'svelte-spa-router';
  import { Star, DotsThree } from 'phosphor-svelte';
  import WorkspaceSidebar from './WorkspaceSidebar.svelte';
  import Loading from './Loading.svelte';
  import { workspaces } from './workspaceStore.js';

  export let api;
  export let onLogout;
  export let params = {};

  $: workspaceId = params.id;

  let boards = [];
  let newBoardTitle = '';
  let loading = true;
  let error = '';
  let editingBoardId = null;
  let editTitle = '';
  let openMenuId = null;
  let showArchived = false;
  let addingBoard = false;
  let newBoardInput = null;
  let selectedTemplate = 'blank';
  const templates = {
    blank: [],
    kanban: ['To do', 'In progress', 'Done'],
    sport: ['Warm-up', 'Skill drills', 'Tactical', 'Conditioning', 'Cool-down']
  };
  let workspace = null;
  let editingWorkspace = false;
  let editWorkspaceTitle = '';
  let workspaceTitleInput = null;
  let contextMenu = null;
  let userName = 'User';
  let avatarSeed = 'User';
  let greeting = 'Hello';

  onMount(() => {
    if (typeof localStorage !== 'undefined') {
      const savedName = localStorage.getItem('kanban.user.name');
      if (savedName) userName = savedName;
      const savedAvatar = localStorage.getItem('kanban.user.avatarSeed');
      if (savedAvatar) avatarSeed = savedAvatar;
    }
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) greeting = 'Good morning';
    else if (hour >= 12 && hour < 18) greeting = 'Good afternoon';
    else if (hour >= 18 && hour < 23) greeting = 'Good evening';
    else greeting = 'Good night';
  });

  $: if (workspaceId) loadBoards();

  async function loadBoards() {
    loading = true;
    error = '';
    openMenuId = null;
    try {
      const [workspaceRes, boardsRes] = await Promise.all([
        fetch(`${api}/api/workspaces/${workspaceId}`),
        fetch(`${api}/api/boards?workspace_id=${workspaceId}&archived=${showArchived}`)
      ]);
      console.debug('[BoardsList] workspace response', workspaceRes.status);
      console.debug('[BoardsList] boards response', boardsRes.status);
      if (!workspaceRes.ok) throw new Error(`Workspace request failed (${workspaceRes.status})`);
      if (!boardsRes.ok) throw new Error(`Boards request failed (${boardsRes.status})`);
      workspace = await workspaceRes.json();
      boards = await boardsRes.json();
      console.debug('[BoardsList] loaded workspace', workspace, 'boards', boards);
    } catch (err) {
      console.error('[BoardsList] failed to load boards', err);
      error = `Could not load boards (${err.message}). Is the server running?`;
      workspace = null;
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
        body: JSON.stringify({ title: newBoardTitle, workspace_id: workspaceId, columns: templates[selectedTemplate] })
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const board = await res.json();
      newBoardTitle = '';
      selectedTemplate = 'blank';
      addingBoard = false;
      openBoard(board.id);
    } catch (err) {
      error = 'Could not create board. Is the server running?';
    }
  }

  function openBoard(id) {
    push(`/board/${id}`);
  }

  function openAddBoard() {
    addingBoard = true;
    tick().then(() => newBoardInput?.focus());
  }

  function cancelAddBoard() {
    addingBoard = false;
    newBoardTitle = '';
    selectedTemplate = 'blank';
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

  function openBoardContextMenu(e, board) {
    e.preventDefault();
    contextMenu = { board, x: e.clientX, y: e.clientY };
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  function startEditWorkspace() {
    if (!workspace) return;
    editingWorkspace = true;
    editWorkspaceTitle = workspace.title;
    tick().then(() => workspaceTitleInput?.focus());
  }

  function cancelEditWorkspace() {
    editingWorkspace = false;
    editWorkspaceTitle = '';
  }

  async function saveWorkspaceTitle() {
    if (!editWorkspaceTitle.trim() || !workspace) return;
    try {
      const res = await fetch(`${api}/api/workspaces/${workspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editWorkspaceTitle })
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const updated = await res.json();
      workspace = { ...workspace, title: updated.title };
      workspaces.update(list => list.map(w => w.id === updated.id ? updated : w));
      editingWorkspace = false;
    } catch (err) {
      error = 'Could not rename workspace. Is the server running?';
    }
  }
</script>

<svelte:window
  on:click={closeContextMenu}
  on:keydown={(e) => {
    if (e.key === 'Escape') closeContextMenu();
  }}
/>

<div class="flex h-screen">
  <WorkspaceSidebar api={api} activeWorkspaceId={workspaceId ? parseInt(workspaceId, 10) : null} onLogout={onLogout} on:profileChanged={(e) => { userName = e.detail.userName; avatarSeed = e.detail.avatarSeed; }} />

  <div class="flex-1 flex flex-col min-w-0 p-6">
    <header class="app-header">
      {#if editingWorkspace && workspace}
        <div class="flex items-center gap-2">
          <input
            bind:this={workspaceTitleInput}
            class="min-w-[200px] px-2 py-1 text-xl font-semibold text-gray-900 bg-transparent border-none outline-none"
            bind:value={editWorkspaceTitle}
            on:keydown={(e) => {
              if (e.key === 'Enter') saveWorkspaceTitle();
              if (e.key === 'Escape') cancelEditWorkspace();
            }}
          />
          <button on:click={saveWorkspaceTitle}>Save</button>
          <button class="secondary" on:click={cancelEditWorkspace}>Cancel</button>
        </div>
      {:else}
        {#if workspace}
          <nav class="breadcrumb">
            <a use:link href="/" class="breadcrumb-link">Workspaces</a>
            <span class="breadcrumb-sep">/</span>
            <button
              class="bg-transparent border-none p-0 text-inherit font-semibold text-[1.25rem] cursor-pointer hover:opacity-80 hover:bg-transparent"
              on:click={startEditWorkspace}
            >
              {showArchived ? 'Archived' : workspace.title}
            </button>
          </nav>
        {:else}
          <h1>Select a workspace</h1>
        {/if}
      {/if}

      {#if workspaceId}
        <div class="board-controls">
          <button class="archived-toggle" on:click={toggleArchivedView}>
            {showArchived ? 'Back to boards' : 'View archived boards'}
          </button>
        </div>
      {/if}
    </header>

    <div class="flex-1 overflow-auto">
      {#if !workspaceId}
        <div class="flex h-full items-center justify-center">
          <div class="flex flex-col items-center gap-3 text-center">
            <img
              class="w-20 h-20 rounded-full bg-gray-100"
              src={avatarSeed.startsWith('http') ? avatarSeed : `https://api.dicebear.com/7.x/lorelei/svg?seed=${avatarSeed}`}
              alt="Avatar"
            />
            <div class="space-y-2">
              <p class="text-lg font-semibold text-gray-900">{greeting}, {userName}</p>
              <p class="text-gray-500 text-sm">Select a workspace from the sidebar to view its boards.</p>
              {#if $workspaces.length > 0}
                <div class="flex flex-wrap justify-center gap-2 pt-2">
                  {#each $workspaces as w}
                    <a
                      use:link
                      href={`/workspace/${w.id}`}
                      class="max-w-[150px] truncate px-3 py-1.5 text-sm text-gray-700 bg-white border border-[#e6e6e6] rounded-lg hover:bg-gray-50 hover:text-gray-900 no-underline"
                    >
                      {w.title}
                    </a>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </div>
      {:else if error}
        <div class="boards-error">
          <p>{error}</p>
          <button class="secondary" on:click={loadBoards}>Retry</button>
        </div>
      {:else if loading}
        <Loading label="Loading boards…" />
      {:else if showArchived && boards.length === 0}
        <p class="boards-empty">No archived boards.</p>
      {:else}
        {#if !showArchived && boards.length === 0}
          <p class="boards-empty mb-4">No boards in this workspace.</p>
        {/if}
        <div class="boards-grid">
          {#each boards as board (board.id)}
            <div
              class="group relative flex flex-col min-h-[140px] p-3 bg-white bg-[radial-gradient(circle,#e5e5e5_1px,transparent_1px)] bg-[length:12px_12px] rounded-[10px] border border-[#e6e6e6] cursor-pointer transition hover:border-[#d4d4d4] hover:bg-[#fafafa]"
              role="listitem"
              on:contextmenu|preventDefault={(e) => openBoardContextMenu(e, board)}
            >
              {#if editingBoardId !== board.id}
                <div class="absolute top-2 right-2 flex items-center gap-1">
                  {#if !showArchived}
                    <button
                      class="w-6 h-6 p-0 rounded-md border-transparent bg-transparent text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-gray-900 group-hover:opacity-100 focus-visible:opacity-100"
                      class:opacity-100={board.starred}
                      class:text-yellow-500={board.starred}
                      on:click|stopPropagation={() => toggleStar(board)}
                      aria-label={board.starred ? 'Unstar board' : 'Star board'}
                    >
                      <Star size={16} weight={board.starred ? 'fill' : 'regular'} />
                    </button>
                  {/if}
                  <div class="relative">
                    <button
                      class="w-6 h-6 p-0 rounded-md border-transparent bg-transparent text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-gray-900 group-hover:opacity-100 focus-visible:opacity-100"
                      class:opacity-100={openMenuId === board.id}
                      on:click|stopPropagation={() => toggleMenu(board.id)}
                      aria-label="Board options"
                    >
                      <DotsThree size={16} weight="bold" />
                    </button>
                    {#if openMenuId === board.id}
                      <div class="absolute right-0 top-7 z-30 min-w-[150px] rounded-[10px] border border-[#e6e6e6] bg-white p-1 shadow-[0_6px_16px_rgba(0,0,0,0.06)]">
                        {#if !showArchived}
                          <button class="block w-full rounded-md border-transparent bg-transparent px-2 py-1.5 text-left text-[13px] font-normal text-gray-900 hover:bg-gray-100" on:click={() => startRename(board)}>Rename</button>
                        {/if}
                        <button class="block w-full rounded-md border-transparent bg-transparent px-2 py-1.5 text-left text-[13px] font-normal text-gray-900 hover:bg-gray-100" on:click={() => toggleArchived(board)}>{board.archived ? 'Unarchive' : 'Archive'}</button>
                        <button class="block w-full rounded-md border-transparent bg-transparent px-2 py-1.5 text-left text-[13px] font-normal text-red-600 hover:bg-red-50" on:click={() => deleteBoard(board)}>Delete</button>
                      </div>
                    {/if}
                  </div>
                </div>
              {/if}

              {#if editingBoardId === board.id}
                <div class="flex-1 flex flex-col justify-center p-0">
                  <input
                    class="w-full mb-2 px-2 py-1.5 border border-gray-900 rounded-lg bg-white text-base font-medium text-gray-900 outline-none"
                    bind:value={editTitle}
                    on:keydown={(e) => {
                      if (e.key === 'Enter') renameBoard(board);
                      if (e.key === 'Escape') cancelRename();
                    }}
                  />
                  <div class="flex gap-2">
                    <button class="flex-1" on:click={() => renameBoard(board)}>Save</button>
                    <button class="flex-1 secondary" on:click={cancelRename}>Cancel</button>
                  </div>
                </div>
              {:else}
                <button class="flex-1 flex justify-center items-center min-w-0 px-10 bg-transparent border-none rounded-none text-gray-900 text-xl font-semibold leading-snug text-center" on:click={() => openBoard(board.id)}>
                  <span class="block w-full overflow-hidden text-ellipsis whitespace-nowrap">{board.title}</span>
                </button>
              {/if}
            </div>
          {/each}

          {#if !showArchived}
            <div class="group relative flex flex-col min-h-[140px] p-0 bg-white bg-[radial-gradient(circle,#e5e5e5_1px,transparent_1px)] bg-[length:12px_12px] rounded-[10px] cursor-pointer transition hover:bg-[#fafafa] text-gray-500 hover:text-gray-900">
              {#if addingBoard}
                <div class="flex-1 flex flex-col justify-center gap-2 p-3">
                  <input
                    bind:this={newBoardInput}
                    class="w-full px-2 py-1.5 border border-[#e6e6e6] rounded-lg bg-white text-base font-medium text-gray-900 outline-none focus:border-gray-900"
                    bind:value={newBoardTitle}
                    placeholder="New board title"
                    on:keydown={(e) => {
                      if (e.key === 'Enter') addBoard();
                      if (e.key === 'Escape') cancelAddBoard();
                    }}
                  />
                  <select
                    class="w-full px-2 py-1.5 border border-[#e6e6e6] rounded-lg bg-white text-sm text-gray-900 outline-none focus:border-gray-900"
                    bind:value={selectedTemplate}
                  >
                    <option value="blank">Blank board</option>
                    <option value="kanban">Kanban (To do, In progress, Done)</option>
                    <option value="sport">Sport Schema (Warm-up, Skill drills, Tactical, Conditioning, Cool-down)</option>
                  </select>
                  <div class="flex gap-2">
                    <button class="flex-1" on:click={addBoard}>Add Board</button>
                    <button class="flex-1 secondary" on:click={cancelAddBoard}>Cancel</button>
                  </div>
                </div>
              {:else}
                <button class="flex-1 flex flex-col items-center justify-center gap-1 w-full p-3 bg-transparent border-none rounded-none text-inherit text-sm font-medium" on:click={openAddBoard}>
                  <span class="text-[1.75rem] font-light leading-none" aria-hidden="true">+</span>
                  <span class="text-sm">Add board</span>
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

{#if contextMenu}
  <div
    class="fixed z-50 min-w-[150px] rounded-[10px] border border-[#e6e6e6] bg-white p-1 shadow-[0_6px_16px_rgba(0,0,0,0.06)]"
    style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
  >
    {#if !contextMenu.board.archived}
      <button class="block w-full rounded-md border-transparent bg-transparent px-2 py-1.5 text-left text-[13px] font-normal text-gray-900 hover:bg-gray-100" on:click={() => { startRename(contextMenu.board); closeContextMenu(); }}>Rename</button>
    {/if}
    <button class="block w-full rounded-md border-transparent bg-transparent px-2 py-1.5 text-left text-[13px] font-normal text-gray-900 hover:bg-gray-100" on:click={() => { toggleArchived(contextMenu.board); closeContextMenu(); }}>{contextMenu.board.archived ? 'Unarchive' : 'Archive'}</button>
    <button class="block w-full rounded-md border-transparent bg-transparent px-2 py-1.5 text-left text-[13px] font-normal text-red-600 hover:bg-red-50" on:click={() => { deleteBoard(contextMenu.board); closeContextMenu(); }}>Delete</button>
  </div>
{/if}
