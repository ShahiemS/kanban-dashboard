<script>
  import { onMount, tick, createEventDispatcher } from 'svelte';
  import { link } from 'svelte-spa-router';
  import { DotsThree, CaretLeft, List, Buildings, Kanban, House, X } from 'phosphor-svelte';
  import { workspaces } from './workspaceStore.js';

  const dispatch = createEventDispatcher();

  export let api;
  export let activeWorkspaceId = null;
  export let onLogout = () => {};

  let loading = true;
  let error = '';
  let openMenuId = null;
  let showUserMenu = false;
  let editingWorkspaceId = null;
  let avatarSeed = 'User';
  let userName = 'User';

  const AVATAR_STORAGE_KEY = 'kanban.user.avatarSeed';
  const AVATAR_OPTIONS = ['Felix', 'Aneka', 'Casper', 'Mia', 'Leo', 'Zoe', 'Mila', 'Noah', 'Oliver', 'Luna', 'Jasper', 'Ava', 'Ethan', 'Liam', 'Sofia', 'Lucas', 'Isabella', 'Mason', 'Aurora', 'Jake', 'Kofi', 'Jabari', 'Malik'];
  const MAN_WITH_BEARD_URL = 'https://api.dicebear.com/10.x/lorelei/svg?hairVariant=variant01,variant02,variant03,variant04,variant05,variant06,variant07,variant08,variant09,variant10,variant11,variant12,variant13,variant14,variant15,variant16,variant17,variant18,variant19,variant20,variant21,variant22,variant23,variant24,variant25,variant26,variant27,variant28,variant29,variant30,variant31,variant32,variant33,variant34,variant35,variant36,variant37,variant38,variant39,variant40,variant41,variant42,variant43,variant44,variant45,variant46,variant47&eyebrowsVariant=variant01,variant02,variant03,variant04,variant05,variant06,variant09,variant10,variant11,variant13&beardProbability=97&eyesVariant=variant03,variant04,variant05,variant06,variant07,variant08,variant09,variant10,variant16,variant17,variant18,variant19,variant21,variant22,variant23,variant24&seed=Felix';
  const CUSTOM_AVATARS = { 'Man with beard': MAN_WITH_BEARD_URL };
  const USERNAME_KEY = 'kanban.user.name';

  function avatarUrl(seed) {
    return seed.startsWith('http') ? seed : `https://api.dicebear.com/7.x/lorelei/svg?seed=${seed}`;
  }
  let editTitle = '';
  let addingWorkspace = false;
  let newWorkspaceTitle = '';
  let searchQuery = '';
  let newWorkspaceInput = null;
  let collapsed = false;
  let workspaceBoards = {};

  const SIDEBAR_COLLAPSED_KEY = 'kanban.sidebar.collapsed';

  $: if (activeWorkspaceId) loadWorkspaceBoards(activeWorkspaceId);
  $: if (searchQuery) loadAllBoards();

  function toggleSidebar() {
    collapsed = !collapsed;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    }
  }

  function closeMobileSidebar() {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      collapsed = true;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'true');
      }
    }
  }

  onMount(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (saved !== null) {
        collapsed = saved === 'true';
      } else if (typeof window !== 'undefined' && window.innerWidth < 768) {
        collapsed = true;
      }
      const savedAvatar = localStorage.getItem(AVATAR_STORAGE_KEY);
      if (savedAvatar) avatarSeed = savedAvatar;
      const savedName = localStorage.getItem(USERNAME_KEY);
      if (savedName) userName = savedName;
    }
    loadWorkspaces();
  });

  function saveUserName() {
    userName = userName.trim() || 'User';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(USERNAME_KEY, userName);
    }
    dispatch('profileChanged', { userName, avatarSeed });
  }

  function setAvatarSeed(seed) {
    avatarSeed = seed;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AVATAR_STORAGE_KEY, seed);
    }
    dispatch('profileChanged', { userName, avatarSeed });
  }

  async function loadWorkspaces() {
    loading = true;
    error = '';
    try {
      const res = await fetch(`${api}/api/workspaces`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      workspaces.set(await res.json());
    } catch (err) {
      console.error('[WorkspaceSidebar] failed to load workspaces', err);
      error = 'Could not load workspaces';
    } finally {
      loading = false;
    }
  }

  async function loadWorkspaceBoards(workspaceId) {
    try {
      const res = await fetch(`${api}/api/boards?workspace_id=${workspaceId}&archived=false`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const boards = await res.json();
      workspaceBoards[workspaceId] = boards;
      workspaceBoards = workspaceBoards; // trigger reactivity
    } catch (err) {
      console.error('[WorkspaceSidebar] failed to load boards', err);
    }
  }

  async function loadAllBoards() {
    for (const ws of $workspaces) {
      if (!workspaceBoards[ws.id]) {
        await loadWorkspaceBoards(ws.id);
      }
    }
  }

  function openAddWorkspace() {
    addingWorkspace = true;
    tick().then(() => newWorkspaceInput?.focus());
  }

  function cancelAddWorkspace() {
    addingWorkspace = false;
    newWorkspaceTitle = '';
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
      workspaces.update(list => [...list, workspace]);
      newWorkspaceTitle = '';
      addingWorkspace = false;
    } catch (err) {
      error = 'Could not create workspace';
    }
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
      workspaces.update(list => list.map(w => w.id === updated.id ? updated : w));
      editingWorkspaceId = null;
    } catch (err) {
      error = 'Could not rename workspace';
    }
  }

  async function deleteWorkspace(workspace) {
    openMenuId = null;
    if (!confirm(`Delete "${workspace.title}" and all its boards?`)) return;
    try {
      const res = await fetch(`${api}/api/workspaces/${workspace.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      workspaces.update(list => list.filter(w => w.id !== workspace.id));
    } catch (err) {
      error = 'Could not delete workspace';
    }
  }

  function toggleMenu(workspaceId) {
    openMenuId = openMenuId === workspaceId ? null : workspaceId;
  }

  function closeMenu() {
    openMenuId = null;
    showUserMenu = false;
  }

  function toggleUserMenu() {
    showUserMenu = !showUserMenu;
  }
</script>

<svelte:window
  on:click={closeMenu}
  on:keydown={(e) => {
    if (e.key === 'Escape') closeMenu();
  }}
/>

<div class="flex flex-col h-full bg-[#f8f8f8] border-r border-[#e6e6e6] transition-all duration-200 {collapsed ? 'w-12' : 'w-60'}">
  <div class="p-4 pb-6 flex items-center justify-between">
    {#if !collapsed}
      <div class="flex items-center gap-2">
        <img src="/favicon.svg" alt="Logo" class="w-6 h-6" />
        <h2 class="text-base md:text-sm font-semibold text-gray-900">Workspaces</h2>
      </div>
      <button
        class="!bg-transparent !border-transparent p-0 m-0 text-gray-400 hover:text-gray-900"
        on:click={toggleSidebar}
        aria-label="Close sidebar"
      >
        <CaretLeft size={24} weight="bold" class="w-6 h-6 md:w-5 md:h-5" />
      </button>
    {:else}
      <button
        class="!bg-transparent !border-transparent p-0 m-0 text-gray-400 hover:text-gray-900"
        on:click={toggleSidebar}
        aria-label="Open sidebar"
      >
        <List size={24} weight="bold" class="w-6 h-6 md:w-5 md:h-5" />
      </button>
    {/if}
  </div>

  {#if !collapsed}
  <div class="p-2 pb-0 relative">
    <input
      type="text"
      class="w-full px-3 py-1.5 pr-7 text-sm border border-[#e6e6e6] rounded-lg bg-white outline-none focus:border-gray-900"
      bind:value={searchQuery}
      placeholder="Search workspaces & boards"
    />
    {#if searchQuery}
      <button
        class="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center p-0 bg-transparent border-none text-gray-400 hover:text-gray-700"
        on:click={() => searchQuery = ''}
        aria-label="Clear search"
      >
        <X size={14} weight="bold" />
      </button>
    {/if}
  </div>
  {/if}
  <div class="{collapsed ? 'p-1 flex justify-center' : 'p-2 pt-0 mt-3'}">
    <a
      use:link
      href="/"
      class="group flex items-center rounded-lg text-base transition no-underline
        {collapsed ? 'justify-center w-8 h-8 mx-auto' : 'gap-2 px-3 py-2'}
        {activeWorkspaceId === null
          ? 'bg-white text-gray-900 font-semibold shadow-sm'
          : 'text-gray-600 hover:bg-white hover:text-gray-900'}"
    >
      <span class="shrink-0 {collapsed ? 'w-6 h-6' : 'w-8 h-8'} rounded-full flex items-center justify-center bg-gray-100 text-gray-500 group-hover:text-gray-700">
        <House size={collapsed ? 14 : 18} weight="bold" />
      </span>
      {#if !collapsed}<span class="truncate">Home</span>{/if}
    </a>
  </div>
  {#if !collapsed}
  <div class="flex-1 overflow-y-auto p-2 space-y-2">
    {#if loading}
      <p class="px-3 py-2 text-sm text-gray-500">Loading…</p>
    {:else if error}
      <p class="px-3 py-2 text-sm text-red-600">{error}</p>
    {:else}
      {#each $workspaces.filter(w => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        if (w.title.toLowerCase().includes(q)) return true;
        const boards = workspaceBoards[w.id] || [];
        return boards.some(b => b.title.toLowerCase().includes(q));
      }) as workspace (workspace.id)}
        <div class="relative group">
          {#if editingWorkspaceId === workspace.id}
            <div class="px-2 py-1.5">
              <input
                class="w-full px-2 py-1 text-base bg-transparent border-none outline-none"
                bind:value={editTitle}
                on:keydown={(e) => {
                  if (e.key === 'Enter') renameWorkspace(workspace);
                  if (e.key === 'Escape') cancelRename();
                }}
              />
              <div class="flex gap-1 mt-1.5">
                <button class="flex-1 px-2 py-1 text-sm rounded-md bg-gray-900 text-white" on:click={() => renameWorkspace(workspace)}>Save</button>
                <button class="flex-1 px-2 py-1 text-sm rounded-md border border-[#e6e6e6] bg-white text-gray-700" on:click={cancelRename}>Cancel</button>
              </div>
            </div>
          {:else}
            <a
              use:link
              href={`/workspace/${workspace.id}`}
              class="group flex items-center gap-2 px-3 py-2 rounded-lg text-base transition no-underline
                {activeWorkspaceId === workspace.id
                  ? 'bg-white text-gray-900 font-semibold shadow-sm'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900'}"
              on:contextmenu|preventDefault={() => openMenuId = workspace.id}
            >
              <span class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center {activeWorkspaceId === workspace.id ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-500 group-hover:text-gray-700'}">
                <Buildings size={18} weight="bold" />
              </span>
              <span class="truncate">{workspace.title}</span>
            </a>
            <button
              class="absolute right-1.5 top-1.5 flex items-center justify-center w-6 h-6 rounded-md transition hover:bg-gray-100 !bg-transparent !border-transparent text-gray-400 opacity-100 {activeWorkspaceId === workspace.id || openMenuId === workspace.id ? 'text-gray-900' : 'hover:text-gray-600'}"
              on:click|stopPropagation={() => toggleMenu(workspace.id)}
              aria-label="Workspace options"
            >
              <DotsThree size={14} weight="bold" />
            </button>
            {#if openMenuId === workspace.id}
              <div class="absolute right-2 top-8 z-30 min-w-[120px] rounded-[10px] border border-[#e6e6e6] bg-white p-1 shadow-[0_6px_16px_rgba(0,0,0,0.06)]">
                <button class="block w-full rounded-md border-transparent bg-transparent px-2 py-1.5 text-left text-[13px] font-normal text-gray-900 hover:bg-gray-100" on:click={() => startRename(workspace)}>Rename</button>
                <button class="block w-full rounded-md border-transparent bg-transparent px-2 py-1.5 text-left text-[13px] font-normal text-red-600 hover:bg-red-50" on:click={() => deleteWorkspace(workspace)}>Delete</button>
              </div>
            {/if}
            {#if (activeWorkspaceId === workspace.id || searchQuery) && workspaceBoards[workspace.id]?.length}
              <div class="pl-4 py-1 space-y-2">
                {#each workspaceBoards[workspace.id].filter(b => !searchQuery || b.title.toLowerCase().includes(searchQuery.toLowerCase())) as board}
                  <a
                    use:link
                    href={`/board/${board.id}`}
                    class="group flex items-center gap-1.5 px-2 py-1 rounded-md text-[0.95rem] text-gray-600 hover:bg-white hover:text-gray-900 no-underline transition"
                    on:click={closeMobileSidebar}
                  >
                    <Kanban size={16} weight="bold" class="shrink-0 text-gray-400 group-hover:text-gray-600" />
                    <span class="truncate">{board.title}</span>
                  </a>
                {/each}
              </div>
            {/if}
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  <div class="p-3 border-t border-[#e6e6e6]">
    {#if addingWorkspace}
      <input
        bind:this={newWorkspaceInput}
        class="w-full px-2 py-1.5 text-base border border-[#e6e6e6] rounded-lg bg-white outline-none focus:border-gray-900"
        bind:value={newWorkspaceTitle}
        placeholder="Workspace title"
        on:keydown={(e) => {
          if (e.key === 'Enter') addWorkspace();
          if (e.key === 'Escape') cancelAddWorkspace();
        }}
      />
      <div class="flex gap-2 mt-2">
        <button class="flex-1 px-2 py-1 text-sm rounded-lg bg-gray-900 text-white font-medium" on:click={addWorkspace}>Add</button>
        <button class="flex-1 px-2 py-1 text-sm rounded-lg border border-[#e6e6e6] bg-white text-gray-700" on:click={cancelAddWorkspace}>Cancel</button>
      </div>
    {:else}
      <button
        class="w-full flex items-center justify-center gap-1 px-3 py-2 text-base font-medium text-gray-500 rounded-lg border border-dashed border-[#d4d4d4] hover:border-gray-400 hover:text-gray-900 transition !bg-transparent"
        on:click={openAddWorkspace}
      >
        <span class="text-base leading-none">+</span>
        Add workspace
      </button>
    {/if}
  </div>
{/if}

  <div class="relative p-3 border-t border-[#e6e6e6] mt-auto">
    <button
      class="w-full flex items-center {collapsed ? 'justify-center' : 'gap-2'} p-0 bg-transparent border-none text-gray-900"
      on:click|stopPropagation={toggleUserMenu}
      aria-label="User menu"
    >
      <img
        class="w-10 h-10 rounded-full bg-gray-100 shrink-0"
        src={avatarUrl(avatarSeed)}
        alt="Avatar"
      />
      {#if !collapsed}
        <span class="text-base font-medium truncate flex-1 text-left">{userName}</span>
      {/if}
    </button>
    {#if showUserMenu}
      <div
        class="absolute left-full bottom-0 ml-2 w-80 p-4 bg-white border border-[#e6e6e6] rounded-[10px] shadow-[0_6px_16px_rgba(0,0,0,0.06)] z-50 max-h-[80vh] overflow-y-auto overflow-x-hidden"
        role="group"
        aria-label="User menu"
        on:click|stopPropagation
        on:keydown={(e) => { if (e.key === 'Escape') closeMenu(); }}
      >
        <label class="block text-xs text-gray-500 mb-1" for="user-name">Name</label>
        <input
          id="user-name"
          class="w-full mb-2 px-2 py-1.5 text-sm border border-[#e6e6e6] rounded-lg bg-white text-gray-900 outline-none focus:border-gray-900"
          bind:value={userName}
          placeholder="Your name"
          on:blur={saveUserName}
          on:keydown={(e) => { if (e.key === 'Enter') saveUserName(); }}
        />
        <p class="text-xs text-gray-500 mb-1.5">Choose avatar</p>
        <div class="flex flex-wrap gap-1 mb-2">
          {#each AVATAR_OPTIONS as seed}
            <button
              class="p-0 border-none bg-transparent rounded-full"
              on:click|stopPropagation={() => setAvatarSeed(seed)}
              aria-label={`Choose avatar ${seed}`}
            >
              <img
                class="w-8 h-8 rounded-full border-2 {avatarSeed === seed ? 'border-gray-900' : 'border-transparent'} hover:border-gray-400"
                src={avatarUrl(seed)}
                alt={seed}
              />
            </button>
          {/each}
          {#each Object.entries(CUSTOM_AVATARS) as [label, url]}
            <button
              class="p-0 border-none bg-transparent rounded-full"
              on:click|stopPropagation={() => setAvatarSeed(url)}
              aria-label={`Choose avatar ${label}`}
            >
              <img
                class="w-8 h-8 rounded-full border-2 {avatarSeed === url ? 'border-gray-900' : 'border-transparent'} hover:border-gray-400"
                src={url}
                alt={label}
              />
            </button>
          {/each}
        </div>
        <button class="block w-full rounded-md border-transparent bg-transparent px-2 py-1.5 text-left text-[13px] font-normal text-gray-900 hover:bg-gray-100" on:click|stopPropagation={onLogout}>Log out</button>
      </div>
    {/if}
  </div>
</div>
