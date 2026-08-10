<script>
  import { onMount, tick } from 'svelte';
  import { push } from 'svelte-spa-router';

  export let api;
  export let onLogout;

  let workspaces = [];
  let newWorkspaceTitle = '';
  let loading = true;
  let error = '';
  let editingWorkspaceId = null;
  let editTitle = '';
  let openMenuId = null;
  let addingWorkspace = false;
  let newWorkspaceInput = null;

  onMount(loadWorkspaces);

  async function loadWorkspaces() {
    loading = true;
    error = '';
    openMenuId = null;
    try {
      const res = await fetch(`${api}/api/workspaces`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      workspaces = await res.json();
    } catch (err) {
      console.error('[WorkspaceList] failed to load workspaces', err);
      error = `Could not load workspaces (${err.message}). Is the server running?`;
    } finally {
      loading = false;
    }
  }

  async function addWorkspace() {
    if (!newWorkspaceTitle.trim()) return;
    try {
      const res = await fetch(`${api}/api/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newWorkspaceTitle })
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const workspace = await res.json();
      newWorkspaceTitle = '';
      addingWorkspace = false;
      push(`/workspace/${workspace.id}`);
    } catch (err) {
      error = 'Could not create workspace. Is the server running?';
    }
  }

  function openWorkspace(id) {
    push(`/workspace/${id}`);
  }

  function openAddWorkspace() {
    addingWorkspace = true;
    tick().then(() => newWorkspaceInput?.focus());
  }

  function cancelAddWorkspace() {
    addingWorkspace = false;
    newWorkspaceTitle = '';
  }

  function startRename(workspace) {
    openMenuId = null;
    editingWorkspaceId = workspace.id;
    editTitle = workspace.title;
  }

  function cancelRename() {
    editingWorkspaceId = null;
    editTitle = '';
  }

  async function renameWorkspace(workspace) {
    if (!editTitle.trim()) return;
    try {
      const res = await fetch(`${api}/api/workspaces/${workspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle })
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const updated = await res.json();
      workspaces = workspaces.map(w => w.id === updated.id ? updated : w);
      editingWorkspaceId = null;
    } catch (err) {
      error = 'Could not rename workspace. Is the server running?';
    }
  }

  async function deleteWorkspace(workspace) {
    openMenuId = null;
    if (!confirm(`Delete "${workspace.title}" and all its boards?`)) return;
    try {
      const res = await fetch(`${api}/api/workspaces/${workspace.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      workspaces = workspaces.filter(w => w.id !== workspace.id);
    } catch (err) {
      error = 'Could not delete workspace. Is the server running?';
    }
  }

  function toggleMenu(workspaceId) {
    openMenuId = openMenuId === workspaceId ? null : workspaceId;
  }
</script>

<header class="app-header">
  <h1>Workspaces</h1>
  <div class="board-controls">
    <button class="logout" on:click={onLogout}>Log out</button>
  </div>
</header>

{#if error}
  <div class="boards-error">
    <p>{error}</p>
    <button class="secondary" on:click={loadWorkspaces}>Retry</button>
  </div>
{:else if loading}
  <p class="boards-empty">Loading workspaces…</p>
{:else if workspaces.length === 0}
  <p class="boards-empty">No workspaces yet. Create one to get started.</p>
{:else}
  <div class="boards-grid">
    {#each workspaces as workspace (workspace.id)}
      <div class="group relative flex flex-col min-h-[140px] p-3 bg-white bg-[radial-gradient(circle,#e5e5e5_1px,transparent_1px)] bg-[length:12px_12px] rounded-[10px] border border-[#e6e6e6] cursor-pointer transition hover:border-[#d4d4d4] hover:bg-[#fafafa]">
        {#if editingWorkspaceId !== workspace.id}
          <div class="absolute top-2 right-2">
            <div class="relative">
              <button
                class="flex items-center justify-center w-6 h-6 p-0 rounded-md border-transparent bg-transparent text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-gray-900 group-hover:opacity-100 focus-visible:opacity-100"
                class:opacity-100={openMenuId === workspace.id}
                on:click|stopPropagation={() => toggleMenu(workspace.id)}
                aria-label="Workspace options"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </button>
              {#if openMenuId === workspace.id}
                <div class="absolute right-0 top-7 z-30 min-w-[150px] rounded-[10px] border border-[#e6e6e6] bg-white p-1 shadow-[0_6px_16px_rgba(0,0,0,0.06)]">
                  <button class="block w-full rounded-md border-transparent bg-transparent px-2 py-1.5 text-left text-[13px] font-normal text-gray-900 hover:bg-gray-100" on:click={() => startRename(workspace)}>Rename</button>
                  <button class="block w-full rounded-md border-transparent bg-transparent px-2 py-1.5 text-left text-[13px] font-normal text-red-600 hover:bg-red-50" on:click={() => deleteWorkspace(workspace)}>Delete</button>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        {#if editingWorkspaceId === workspace.id}
          <div class="flex-1 flex flex-col justify-center p-0">
            <input
              class="w-full mb-2 px-2 py-1.5 border border-gray-900 rounded-lg bg-white text-base font-medium text-gray-900 outline-none"
              bind:value={editTitle}
              on:keydown={(e) => {
                if (e.key === 'Enter') renameWorkspace(workspace);
                if (e.key === 'Escape') cancelRename();
              }}
            />
            <div class="flex gap-2">
              <button class="flex-1" on:click={() => renameWorkspace(workspace)}>Save</button>
              <button class="flex-1 secondary" on:click={cancelRename}>Cancel</button>
            </div>
          </div>
        {:else}
          <button class="flex-1 flex justify-center items-center min-w-0 px-10 bg-transparent border-none rounded-none text-gray-900 text-xl font-semibold leading-snug text-center" on:click={() => openWorkspace(workspace.id)}>
            <span class="block w-full overflow-hidden text-ellipsis whitespace-nowrap">{workspace.title}</span>
          </button>
        {/if}
      </div>
    {/each}

    <div class="group relative flex flex-col min-h-[140px] p-0 bg-white bg-[radial-gradient(circle,#e5e5e5_1px,transparent_1px)] bg-[length:12px_12px] rounded-[10px] border border-dashed border-[#e6e6e6] cursor-pointer transition hover:border-[#d4d4d4] hover:bg-[#fafafa] text-gray-500 hover:text-gray-900">
      {#if addingWorkspace}
        <div class="flex-1 flex flex-col justify-center gap-2 p-3">
          <input
            bind:this={newWorkspaceInput}
            class="w-full px-2 py-1.5 border border-[#e6e6e6] rounded-lg bg-white text-base font-medium text-gray-900 outline-none focus:border-gray-900"
            bind:value={newWorkspaceTitle}
            placeholder="Workspace title"
            on:keydown={(e) => {
              if (e.key === 'Enter') addWorkspace();
              if (e.key === 'Escape') cancelAddWorkspace();
            }}
          />
          <div class="flex gap-2">
            <button class="flex-1" on:click={addWorkspace}>Create</button>
            <button class="flex-1 secondary" on:click={cancelAddWorkspace}>Cancel</button>
          </div>
        </div>
      {:else}
        <button class="flex-1 flex flex-col items-center justify-center gap-1 w-full p-3 bg-transparent border-none rounded-none text-inherit text-sm font-medium" on:click={openAddWorkspace}>
          <span class="text-[1.75rem] font-light leading-none" aria-hidden="true">+</span>
          <span class="text-sm">Add workspace</span>
        </button>
      {/if}
    </div>
  </div>
{/if}
