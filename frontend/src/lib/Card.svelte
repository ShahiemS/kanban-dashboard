<script context="module">
  import { writable } from 'svelte/store';
  const activeMenu = writable(null);
</script>

<script>
  import { createEventDispatcher, tick } from 'svelte';
  import { get } from 'svelte/store';
  import { fly } from 'svelte/transition';
  import { DotsThree, Link, X, Check, Article, TextB, TextItalic, TextUnderline, ListBullets } from 'phosphor-svelte';

  export let card;
  export let api;

  const dispatch = createEventDispatcher();

  let detailOpen = false;
  let detailTitle = '';
  let detailDescription = '';
  let checklist = [];
  let newChecklistItem = '';
  let showCompleted = true;
  let editingTitle = false;
  let editTitle = card.title;
  let titleInput = null;

  $: meta = card.meta || {};
  $: coverImage = meta.cover_image || '';
  $: links = Array.isArray(meta.links) ? meta.links : [];
  $: tags = Array.isArray(meta.tags) && meta.tags.length
    ? meta.tags
    : (meta.tag ? [{ label: meta.tag, color: meta.tag_color || '#0079bf' }] : []);
  $: completedCount = checklist.filter(i => i.done).length;
  $: totalCount = checklist.length;
  $: progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  function onDragStart(e) {
    e.dataTransfer.setData('cardId', card.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function closeMenus() {
    activeMenu.set(null);
  }

  async function saveMeta(nextMeta) {
    await fetch(`${api}/api/cards/${card.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: card.title,
        description: card.description,
        column_id: card.column_id,
        position: card.position,
        meta: nextMeta
      })
    });
    dispatch('cardMoved', { ...card, meta: nextMeta });
  }

  function addLink() {
    closeMenus();
    const url = prompt('Link URL (e.g. https://docs.google.com/...)');
    if (!url || !url.trim()) return;
    const label = prompt('Label to show', url.replace(/^https?:\/\//, '').split('/')[0]) || url;
    saveMeta({ ...meta, links: [...links, { label: label.trim(), url: url.trim() }] });
  }

  async function renameCard() {
    closeMenus();
    editingTitle = true;
    editTitle = card.title;
    await tick();
    titleInput?.focus();
  }

  async function saveRename() {
    if (!editingTitle) return;
    const newTitle = editTitle.trim();
    editingTitle = false;
    if (!newTitle || newTitle === card.title) {
      editTitle = card.title;
      return;
    }
    try {
      const res = await fetch(`${api}/api/cards/${card.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: card.description,
          column_id: card.column_id,
          position: card.position,
          meta
        })
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      dispatch('cardMoved', { ...card, title: newTitle });
    } catch (err) {
      console.error('[Card] rename failed', err);
    }
  }

  function cancelRename() {
    editingTitle = false;
    editTitle = card.title;
  }

  async function deleteCard() {
    closeMenus();
    await fetch(`${api}/api/cards/${card.id}`, { method: 'DELETE' });
    dispatch('cardMoved', { ...card, deleted: true });
  }

  function toggleMenu() {
    const current = get(activeMenu);
    if (current?.cardId === card.id && current?.type === 'menu') {
      activeMenu.set(null);
    } else {
      activeMenu.set({ cardId: card.id, type: 'menu' });
    }
  }

  function showContextMenu(e) {
    e.preventDefault();
    activeMenu.set({ cardId: card.id, type: 'context', x: e.clientX, y: e.clientY });
  }

  function openDetail() {
    if (editingTitle) return;
    closeMenus();
    detailOpen = true;
    detailTitle = card.title;
    detailDescription = card.description || '';
    checklist = Array.isArray(meta.subtasks) ? meta.subtasks : [];
    newChecklistItem = '';
    showCompleted = true;
  }

  async function saveDetail() {
    const nextMeta = { ...meta, subtasks: checklist };
    try {
      const res = await fetch(`${api}/api/cards/${card.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: detailTitle,
          description: detailDescription,
          column_id: card.column_id,
          position: card.position,
          meta: nextMeta
        })
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      dispatch('cardMoved', { ...card, title: detailTitle, description: detailDescription, meta: nextMeta });
      detailOpen = false;
    } catch (err) {
      console.error('[Card] save detail failed', err);
    }
  }

  function addChecklistItem() {
    if (!newChecklistItem.trim()) return;
    checklist = [...checklist, { text: newChecklistItem.trim(), done: false }];
    newChecklistItem = '';
  }

  function deleteChecklistItem(index) {
    checklist = checklist.filter((_, i) => i !== index);
  }

  function toggleChecklistItem(index) {
    checklist = checklist.map((item, i) => i === index ? { ...item, done: !item.done } : item);
  }

  function deleteDetail() {
    deleteCard();
    detailOpen = false;
  }
</script>

<svelte:window
  on:click={closeMenus}
  on:keydown={(e) => {
    if (e.key === 'Escape') {
      detailOpen = false;
      closeMenus();
    }
  }}
/>

<div
  class="group relative bg-white rounded-[10px] border border-[#e6e6e6] p-2 mb-2 active:cursor-grabbing transition-colors hover:border-[#d4d4d4] hover:bg-[#fafafa]"
  draggable={!editingTitle}
  on:dragstart={onDragStart}
  on:click={openDetail}
  on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && openDetail()}
  on:contextmenu|preventDefault={showContextMenu}
  role="button"
  tabindex="0"
>
  <div class="absolute top-2 right-2">
    <button
      class="flex items-center justify-center w-6 h-6 rounded-md border border-transparent bg-transparent p-0 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-900 transition"
      on:click|stopPropagation={toggleMenu}
      aria-label="More options"
    >
      <DotsThree size={14} weight="bold" />
    </button>
    {#if $activeMenu?.cardId === card.id && $activeMenu?.type === 'menu'}
      <div class="absolute bottom-full right-0 z-30 min-w-[140px] rounded-[10px] border border-[#e6e6e6] bg-white p-1 shadow-[0_6px_16px_rgba(0,0,0,0.06)]">
        <button
          class="block w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-left text-[13px] font-normal text-gray-900 hover:bg-gray-100 hover:text-gray-900"
          on:click|stopPropagation={renameCard}
        >
          Rename
        </button>
        <button
          class="block w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-left text-[13px] font-normal text-gray-900 hover:bg-gray-100 hover:text-gray-900"
          on:click|stopPropagation={addLink}
        >
          Add link
        </button>
        <button
          class="block w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-left text-[13px] font-normal text-red-600 hover:bg-red-50 hover:text-red-600"
          on:click|stopPropagation={deleteCard}
        >
          Delete
        </button>
      </div>
    {/if}
  </div>

  {#if editingTitle}
    <input
      bind:this={titleInput}
      type="text"
      class="w-full pr-6 mb-1 text-sm font-semibold text-gray-900 leading-snug border border-[#e6e6e6] rounded px-1 py-0.5 outline-none focus:border-gray-900"
      bind:value={editTitle}
      on:click={(e) => e.stopPropagation()}
      on:mousedown={(e) => e.stopPropagation()}
      on:keydown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') saveRename();
        if (e.key === 'Escape') cancelRename();
      }}
    />
    <div class="flex gap-1 mt-1">
      <button class="text-xs px-2 py-1" on:click|stopPropagation={saveRename} on:keydown={(e) => e.stopPropagation()}>Save</button>
      <button class="text-xs px-2 py-1 secondary" on:click|stopPropagation={cancelRename} on:keydown={(e) => e.stopPropagation()}>Cancel</button>
    </div>
  {:else}
    <h3 class="pr-6 text-sm font-semibold text-gray-900 leading-snug">{card.title}</h3>
  {/if}
  {#if card.description}
    <div class="mt-2 text-gray-500" aria-hidden="true">
      <Article size={14} />
    </div>
  {/if}

  {#if coverImage}
    <img class="mt-2 h-24 w-full rounded-lg object-cover" src={coverImage} alt="" loading="lazy" />
  {/if}

  {#if links.length > 0}
    <div class="mt-2 flex flex-wrap items-center gap-3">
      {#each links as link}
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex max-w-[130px] items-center gap-1 text-xs text-blue-600 hover:underline"
          on:click|stopPropagation
        >
          <Link size={12} />
          <span class="truncate">{link.label}</span>
        </a>
      {/each}
    </div>
  {/if}

  {#if tags.length > 0}
    <div class="mt-2 flex flex-wrap gap-1.5">
      {#each tags as t}
        <span
          class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
          style="background-color: {t.color}1a; color: {t.color}"
        >
          {t.label}
        </span>
      {/each}
    </div>
  {/if}
</div>

{#if $activeMenu?.cardId === card.id && $activeMenu?.type === 'context'}
  <div
    class="fixed z-50 min-w-[140px] rounded-[10px] border border-[#e6e6e6] bg-white p-1 shadow-[0_6px_16px_rgba(0,0,0,0.06)]"
    style="top: {$activeMenu.y}px; left: {$activeMenu.x}px;"
    role="menu"
  >
    <button
      class="block w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-left text-[13px] font-normal text-gray-900 hover:bg-gray-100 hover:text-gray-900"
      on:click|stopPropagation={renameCard}
    >
      Rename
    </button>
    <button
      class="block w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-left text-[13px] font-normal text-gray-900 hover:bg-gray-100 hover:text-gray-900"
      on:click|stopPropagation={addLink}
    >
      Add link
    </button>
    <button
      class="block w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-left text-[13px] font-normal text-red-600 hover:bg-red-50 hover:text-red-600"
      on:click|stopPropagation={deleteCard}
    >
      Delete
    </button>
  </div>
{/if}

{#if detailOpen}
  <div class="fixed inset-0 z-50">
    <div
      class="absolute inset-0 bg-black/25 transition-opacity"
      role="presentation"
      on:click={() => detailOpen = false}
      on:keydown={(e) => e.key === 'Escape' && (detailOpen = false)}
    />
    <div
      class="absolute right-0 top-0 h-full w-[480px] max-w-full bg-white shadow-2xl flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Card details"
      transition:fly={{ x: 480, duration: 200, opacity: 1 }}
    >
      <div class="flex items-center justify-between px-5 py-4 border-b border-[#e6e6e6] shrink-0">
        <h2 class="text-lg font-semibold text-gray-900">Card details</h2>
        <button
          class="flex items-center justify-center w-8 h-8 rounded-md bg-transparent border-none text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          on:click={() => detailOpen = false}
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {#if coverImage}
          <img class="h-48 w-full rounded-xl object-cover" src={coverImage} alt="" />
        {/if}

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide" for="card-detail-title">Title</label>
          <input
            id="card-detail-title"
            class="w-full px-3 py-2 border border-[#e6e6e6] rounded-lg bg-white text-sm font-semibold text-gray-900 outline-none focus:border-gray-900"
            bind:value={detailTitle}
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide" for="card-detail-desc">Description</label>
          <div class="flex gap-1">
            <button type="button" class="text-xs px-2 py-1" on:click={() => document.execCommand('bold')}><TextB size={14} weight="bold" /></button>
            <button type="button" class="text-xs px-2 py-1" on:click={() => document.execCommand('italic')}><TextItalic size={14} weight="bold" /></button>
            <button type="button" class="text-xs px-2 py-1" on:click={() => document.execCommand('underline')}><TextUnderline size={14} weight="bold" /></button>
            <button type="button" class="text-xs px-2 py-1" on:click={() => document.execCommand('insertUnorderedList')}><ListBullets size={14} weight="bold" /></button>
          </div>
          <div
            id="card-detail-desc"
            contenteditable="true"
            class="w-full min-h-[120px] px-3 py-2 border border-[#e6e6e6] rounded-lg bg-white text-sm text-gray-700 outline-none focus:border-gray-900"
            bind:innerHTML={detailDescription}
          />
        </div>

        <div class="rounded-xl border border-[#e6e6e6] bg-white p-3 space-y-2">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Checklist</h4>
            <span class="text-xs font-medium text-gray-500">{completedCount}/{totalCount}</span>
          </div>

          {#if totalCount > 0}
            <div class="flex items-center gap-2">
              <div class="h-2 flex-1 rounded-full bg-gray-200 overflow-hidden">
                <div class="h-full rounded-full bg-emerald-500 transition-all" style="width: {progressPercent}%"></div>
              </div>
              <span class="text-xs font-medium text-gray-500">{progressPercent}%</span>
            </div>
            <button
              class="text-xs font-medium text-emerald-600 hover:text-emerald-700"
              on:click={() => showCompleted = !showCompleted}
            >
              {showCompleted ? 'Hide completed' : 'Show completed'}
            </button>
          {/if}

          <ul class="m-0 p-0 list-none space-y-2">
            {#each checklist as item, i}
              {#if showCompleted || !item.done}
                <li class="flex items-center gap-2 group">
                  <label class="flex items-center gap-2 flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      class="sr-only"
                      checked={item.done}
                      on:change={() => toggleChecklistItem(i)}
                    />
                    <span class="w-5 h-5 rounded border flex items-center justify-center transition {item.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-300 text-transparent'}">
                      {#if item.done}<Check size={12} weight="bold" />{/if}
                    </span>
                    <span class="text-sm text-gray-800 flex-1 select-none" class:line-through={item.done} class:text-gray-400={item.done}>{item.text}</span>
                  </label>
                  <button
                    class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition"
                    on:click={() => deleteChecklistItem(i)}
                    aria-label="Delete item"
                  >
                    <X size={14} />
                  </button>
                </li>
              {/if}
            {/each}
          </ul>

          <div class="flex gap-2 mt-3">
            <input
              class="flex-1 px-3 py-1.5 border border-[#e6e6e6] rounded-lg text-sm text-gray-900 outline-none focus:border-gray-900"
              bind:value={newChecklistItem}
              placeholder="Add checklist item"
              on:keydown={(e) => e.key === 'Enter' && addChecklistItem()}
            />
            <button class="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800" on:click={addChecklistItem}>Add</button>
          </div>
        </div>

        {#if links.length > 0}
          <div class="flex flex-col gap-2">
            <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Links</h4>
            <div class="flex flex-wrap gap-3">
              {#each links as link}
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex max-w-[160px] items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  <span class="truncate">{link.label}</span>
                </a>
              {/each}
            </div>
          </div>
        {/if}

        {#if tags.length > 0}
          <div class="flex flex-wrap gap-1.5">
            {#each tags as t}
              <span
                class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                style="background-color: {t.color}1a; color: {t.color}"
              >
                {t.label}
              </span>
            {/each}
          </div>
        {/if}
      </div>

      <div class="flex items-center justify-between px-5 py-4 border-t border-[#e6e6e6] shrink-0">
        <button class="px-3 py-1.5 rounded-lg bg-transparent text-sm text-red-600 hover:bg-red-50" on:click={deleteDetail}>
          Delete
        </button>
        <div class="flex gap-2">
          <button class="px-3 py-1.5 rounded-lg border border-[#e6e6e6] bg-white text-sm text-gray-700 hover:bg-gray-50" on:click={() => detailOpen = false}>
            Cancel
          </button>
          <button class="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800" on:click={saveDetail}>
            Save
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
