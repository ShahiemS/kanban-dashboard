<script context="module">
  import { writable } from 'svelte/store';
  const activeMenu = writable(null);
</script>

<script>
  import { createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store';
  import Modal from './Modal.svelte';

  export let card;
  export let api;

  const dispatch = createEventDispatcher();

  let detailOpen = false;
  let detailTitle = '';
  let detailDescription = '';
  let checklist = [];
  let newChecklistItem = '';

  $: meta = card.meta || {};
  $: coverImage = meta.cover_image || '';
  $: links = Array.isArray(meta.links) ? meta.links : [];
  $: tags = Array.isArray(meta.tags) && meta.tags.length
    ? meta.tags
    : (meta.tag ? [{ label: meta.tag, color: meta.tag_color || '#0079bf' }] : []);

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
    const newTitle = prompt('Rename card', card.title);
    if (!newTitle || !newTitle.trim() || newTitle.trim() === card.title) return;
    try {
      const res = await fetch(`${api}/api/cards/${card.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: card.description,
          column_id: card.column_id,
          position: card.position,
          meta
        })
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      dispatch('cardMoved', { ...card, title: newTitle.trim() });
    } catch (err) {
      console.error('[Card] rename failed', err);
    }
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
    closeMenus();
    detailOpen = true;
    detailTitle = card.title;
    detailDescription = card.description || '';
    checklist = Array.isArray(meta.subtasks) ? meta.subtasks : [];
    newChecklistItem = '';
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

<svelte:window on:click={closeMenus} on:keydown={(e) => e.key === 'Escape' && closeMenus()} />

<div
  class="group relative bg-white rounded-[10px] border border-[#e6e6e6] p-2 mb-2 cursor-grab active:cursor-grabbing transition-colors hover:border-[#d4d4d4] hover:bg-[#fafafa]"
  draggable="true"
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
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <circle cx="5" cy="12" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="19" cy="12" r="2" />
      </svg>
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

  <h3 class="pr-6 text-sm font-semibold text-gray-900 leading-snug">{card.title}</h3>
  {#if card.description}
    <p class="mt-1 text-xs text-gray-500 leading-relaxed">{card.description}</p>
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
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
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
  <Modal title={card.title} on:close={() => detailOpen = false}>
    <div class="space-y-4">
      {#if coverImage}
        <img class="h-40 w-full rounded-lg object-cover" src={coverImage} alt="" />
      {/if}

      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide" for="card-detail-title">Title</label>
        <input
          id="card-detail-title"
          class="w-full px-2 py-1.5 border border-[#e6e6e6] rounded-lg bg-white text-sm font-semibold text-gray-900 outline-none focus:border-gray-900"
          bind:value={detailTitle}
        />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide" for="card-detail-desc">Description</label>
        <textarea
          id="card-detail-desc"
          class="w-full px-2 py-1.5 border border-[#e6e6e6] rounded-lg bg-white text-sm text-gray-700 outline-none focus:border-gray-900 resize-none"
          bind:value={detailDescription}
          rows="4"
        />
      </div>

      <div class="flex flex-col gap-2">
        <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Checklist</h4>
        {#if checklist.length > 0}
          <ul class="space-y-1">
            {#each checklist as item, i}
              <li class="flex items-center gap-2">
                <input
                  type="checkbox"
                  bind:checked={item.done}
                  on:change={() => toggleChecklistItem(i)}
                />
                <span class="text-sm text-gray-800" class:line-through={item.done}>{item.text}</span>
                <button
                  class="ml-auto text-xs text-gray-400 hover:text-red-600"
                  on:click={() => deleteChecklistItem(i)}
                >
                  Delete
                </button>
              </li>
            {/each}
          </ul>
        {/if}
        <div class="flex gap-2">
          <input
            class="flex-1 px-2 py-1 border border-[#e6e6e6] rounded-lg text-sm text-gray-900 outline-none focus:border-gray-900"
            bind:value={newChecklistItem}
            placeholder="Add checklist item"
            on:keydown={(e) => e.key === 'Enter' && addChecklistItem()}
          />
          <button class="px-3 py-1 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800" on:click={addChecklistItem}>Add</button>
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

      <div class="flex justify-between pt-2">
        <button class="px-3 py-1.5 rounded-lg border border-transparent bg-transparent text-sm text-red-600 hover:bg-red-50" on:click={deleteDetail}>
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
  </Modal>
{/if}
