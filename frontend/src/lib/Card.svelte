<script context="module">
  import { writable } from 'svelte/store';
  const activeMenu = writable(null);
</script>

<script>
  import { createEventDispatcher, tick } from 'svelte';
  import { get } from 'svelte/store';
  import { fly } from 'svelte/transition';
  import { DotsThree, Link, X, Check, Article, TextB, TextH, TextItalic, TextUnderline, ListBullets, ListNumbers, PencilSimple } from 'phosphor-svelte';
  import Modal from './Modal.svelte';

  export let card;
  export let api;

  const dispatch = createEventDispatcher();

  let detailOpen = false;
  let detailTitle = '';
  let detailDescription = '';
  let checklists = [];
  let newChecklistTitle = '';
  let newChecklistItem = '';
  let editingListIndex = -1;
  let editingItemIndex = -1;
  let editListTitle = '';
  let editItemText = '';
  let showCompleted = true;
  let editingTitle = false;
  let editTitle = card.title;
  let titleInput = null;
  let showUnsavedConfirm = false;
  let detailTags = [];
  let newTagLabel = '';
  let newTagColor = '#0079bf';
  let linkModalOpen = false;
  let linkUrl = '';
  let linkLabel = '';
  let editingLinkIndex = -1;

  const TAG_COLORS = ['#0079bf', '#61bd4f', '#f2d600', '#ff9f1a', '#eb5a46', '#c377e0', '#00c2e0', '#344563'];

  $: meta = card.meta || {};
  $: coverImage = meta.cover_image || '';
  $: links = Array.isArray(meta.links) ? meta.links : [];
  $: tags = Array.isArray(meta.tags) && meta.tags.length
    ? meta.tags
    : (meta.tag ? [{ label: meta.tag, color: meta.tag_color || '#0079bf' }] : []);
  $: dirty = detailOpen && (detailTitle !== card.title || detailDescription !== (card.description || ''));
  $: completedCount = checklists.reduce((sum, list) => sum + list.items.filter(i => i.done).length, 0);
  $: totalCount = checklists.reduce((sum, list) => sum + list.items.length, 0);
  $: progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  function onDragStart(e) {
    e.dataTransfer.setData('cardId', card.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function closeMenus() {
    activeMenu.set(null);
  }

  async function saveCard(updates = {}) {
    const payload = {
      title: updates.title ?? card.title,
      description: updates.description ?? card.description,
      column_id: updates.column_id ?? card.column_id,
      position: updates.position ?? card.position,
      meta: updates.meta ?? meta,
      archived: updates.archived ?? card.archived,
      completed: updates.completed ?? card.completed
    };
    const res = await fetch(`${api}/api/cards/${card.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const updated = await res.json();
    dispatch('cardMoved', updated);
    return updated;
  }

  async function saveMeta(nextMeta) {
    try {
      await saveCard({ meta: nextMeta });
    } catch (err) {
      console.error('[Card] save meta failed', err);
    }
  }

  function openAddLink() {
    closeMenus();
    editingLinkIndex = -1;
    linkUrl = '';
    linkLabel = '';
    linkModalOpen = true;
  }

  function openEditLink(index) {
    const link = links[index];
    editingLinkIndex = index;
    linkUrl = link.url;
    linkLabel = link.label;
    linkModalOpen = true;
  }

  function closeLinkModal() {
    linkModalOpen = false;
    linkUrl = '';
    linkLabel = '';
    editingLinkIndex = -1;
  }

  function saveLink() {
    const url = linkUrl.trim();
    const label = linkLabel.trim() || url;
    if (!url) return;
    const next = [...links];
    if (editingLinkIndex >= 0) {
      next[editingLinkIndex] = { label, url };
    } else {
      next.push({ label, url });
    }
    saveMeta({ ...meta, links: next });
    closeLinkModal();
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
      await saveCard({ title: newTitle });
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

  async function toggleCompleted() {
    closeMenus();
    try {
      await saveCard({ completed: !card.completed });
    } catch (err) {
      console.error('[Card] toggle completed failed', err);
    }
  }

  async function toggleArchived() {
    closeMenus();
    try {
      await saveCard({ archived: !card.archived });
    } catch (err) {
      console.error('[Card] toggle archived failed', err);
    }
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
    const existing = Array.isArray(meta.checklists) ? meta.checklists : (Array.isArray(meta.subtasks) ? [{ title: 'Checklist', items: meta.subtasks }] : []);
    checklists = existing.map(list => ({ ...list, items: Array.isArray(list.items) ? list.items : [] }));
    detailTags = Array.isArray(meta.tags) ? meta.tags : (meta.tag ? [{ label: meta.tag, color: meta.tag_color || '#0079bf' }] : []);
    newChecklistTitle = '';
    newChecklistItem = '';
    newTagLabel = '';
    newTagColor = '#0079bf';
    showCompleted = true;
  }

  async function saveDetail() {
    const nextMeta = { ...meta, checklists: checklists.map(list => ({ title: list.title, items: list.items.map(i => ({ text: i.text, done: i.done })) })), tags: detailTags };
    try {
      await saveCard({ title: detailTitle, description: detailDescription, meta: nextMeta });
      detailOpen = false;
    } catch (err) {
      console.error('[Card] save detail failed', err);
    }
  }

  function addChecklist() {
    if (!newChecklistTitle.trim()) return;
    checklists = [...checklists, { title: newChecklistTitle.trim(), items: [] }];
    newChecklistTitle = '';
  }

  function deleteChecklist(listIndex) {
    checklists = checklists.filter((_, i) => i !== listIndex);
  }

  function addChecklistItem(listIndex) {
    if (!newChecklistItem.trim()) return;
    const item = { text: newChecklistItem.trim(), done: false };
    checklists = checklists.map((list, i) => i === listIndex ? { ...list, items: [...list.items, item] } : list);
    newChecklistItem = '';
  }

  function deleteChecklistItem(listIndex, itemIndex) {
    checklists = checklists.map((list, i) => i === listIndex ? { ...list, items: list.items.filter((_, j) => j !== itemIndex) } : list);
  }

  function toggleChecklistItem(listIndex, itemIndex) {
    checklists = checklists.map((list, i) => i === listIndex ? { ...list, items: list.items.map((item, j) => j === itemIndex ? { ...item, done: !item.done } : item) } : list);
  }

  function startEditListTitle(listIndex) {
    editingListIndex = listIndex;
    editingItemIndex = -1;
    editListTitle = checklists[listIndex].title;
  }

  function saveListTitle(listIndex) {
    if (editingListIndex !== listIndex) return;
    const next = editListTitle.trim();
    editingListIndex = -1;
    if (next) {
      checklists = checklists.map((list, i) => i === listIndex ? { ...list, title: next } : list);
    }
    editListTitle = '';
  }

  function cancelEditListTitle() {
    editingListIndex = -1;
    editListTitle = '';
  }

  function startEditChecklistItem(listIndex, itemIndex) {
    editingListIndex = listIndex;
    editingItemIndex = itemIndex;
    editItemText = checklists[listIndex].items[itemIndex].text;
  }

  function saveChecklistItem(listIndex, itemIndex) {
    if (editingListIndex !== listIndex || editingItemIndex !== itemIndex) return;
    const next = editItemText.trim();
    editingListIndex = -1;
    editingItemIndex = -1;
    if (next) {
      checklists = checklists.map((list, i) => i === listIndex ? { ...list, items: list.items.map((item, j) => j === itemIndex ? { ...item, text: next } : item) } : list);
    }
    editItemText = '';
  }

  function cancelEditChecklistItem() {
    editingListIndex = -1;
    editingItemIndex = -1;
    editItemText = '';
  }

  function addTag() {
    if (!newTagLabel.trim()) return;
    detailTags = [...detailTags, { label: newTagLabel.trim(), color: newTagColor }];
    newTagLabel = '';
  }

  function deleteTag(index) {
    detailTags = detailTags.filter((_, i) => i !== index);
  }

  function closeDetail() {
    if (dirty) {
      showUnsavedConfirm = true;
      return;
    }
    detailOpen = false;
  }

  function confirmClose() {
    showUnsavedConfirm = false;
    detailOpen = false;
  }

  function cancelClose() {
    showUnsavedConfirm = false;
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
      closeDetail();
      closeMenus();
    }
    if (detailOpen && e.key === 's' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      saveDetail();
    }
  }}
  on:beforeunload={(e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  }}
/>

<div
  class="group relative rounded-[10px] border px-4 py-2 mb-2 active:cursor-grabbing transition-colors {card.archived ? 'bg-gray-50 border-gray-200 opacity-80' : card.completed ? 'bg-emerald-50 border-emerald-100 hover:border-emerald-200 hover:bg-emerald-100' : 'bg-white border-[#e6e6e6] hover:border-[#d4d4d4] hover:bg-[#fafafa]'}"
  draggable={!editingTitle && !card.archived}
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
          on:click|stopPropagation={openAddLink}
        >
          Add link
        </button>
        <button
          class="block w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-left text-[13px] font-normal text-gray-900 hover:bg-gray-100 hover:text-gray-900"
          on:click|stopPropagation={openDetail}
        >
          Add label
        </button>
        <button
          class="block w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-left text-[13px] font-normal text-gray-900 hover:bg-gray-100 hover:text-gray-900"
          on:click|stopPropagation={toggleCompleted}
        >
          {card.completed ? 'Mark incomplete' : 'Mark complete'}
        </button>
        <button
          class="block w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-left text-[13px] font-normal text-gray-900 hover:bg-gray-100 hover:text-gray-900"
          on:click|stopPropagation={toggleArchived}
        >
          {card.archived ? 'Unarchive' : 'Archive'}
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
    <div class="flex items-center gap-2 pr-6">
      <button
        class="shrink-0 w-5 h-5 rounded-full border flex items-center justify-center hidden group-hover:flex focus:flex transition {card.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-300 text-transparent hover:border-gray-900'}"
        on:click|stopPropagation={toggleCompleted}
        aria-label={card.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {#if card.completed}<Check size={10} weight="bold" />{/if}
      </button>
      <h3 class="text-sm font-semibold leading-snug {card.completed ? 'text-gray-400 line-through' : 'text-gray-900'}">{card.title}</h3>
    </div>
  {/if}
  {#if card.archived}
    <div class="mt-1 text-[11px] font-medium text-amber-600">Archived</div>
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
      on:click|stopPropagation={openAddLink}
    >
      Add link
    </button>
    <button
      class="block w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-left text-[13px] font-normal text-gray-900 hover:bg-gray-100 hover:text-gray-900"
      on:click|stopPropagation={toggleCompleted}
    >
      {card.completed ? 'Mark incomplete' : 'Mark complete'}
    </button>
    <button
      class="block w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-left text-[13px] font-normal text-gray-900 hover:bg-gray-100 hover:text-gray-900"
      on:click|stopPropagation={toggleArchived}
    >
      {card.archived ? 'Unarchive' : 'Archive'}
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
      on:click={closeDetail}
      on:keydown={(e) => e.key === 'Escape' && closeDetail()}
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
          on:click={closeDetail}
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

        <div class="flex flex-wrap items-center gap-2">
          <button
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition {card.completed ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-[#e6e6e6] text-gray-700 hover:bg-gray-50'}"
            on:click={() => toggleCompleted()}
          >
            <span class="w-4 h-4 rounded border flex items-center justify-center {card.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-300'}">
              {#if card.completed}<Check size={10} weight="bold" />{/if}
            </span>
            {card.completed ? 'Completed' : 'Mark complete'}
          </button>
          <button
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition {card.archived ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-[#e6e6e6] text-gray-700 hover:bg-gray-50'}"
            on:click={() => toggleArchived()}
          >
            {card.archived ? 'Unarchive' : 'Archive'}
          </button>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide" for="card-detail-desc">Description</label>
          <div class="flex flex-wrap gap-1">
            <button type="button" class="text-xs px-2 py-1 bg-white border border-[#e6e6e6] text-gray-700 rounded-md hover:bg-gray-100" on:click={() => document.execCommand('bold')}><TextB size={14} weight="bold" /></button>
            <button type="button" class="text-xs px-2 py-1 bg-white border border-[#e6e6e6] text-gray-700 rounded-md hover:bg-gray-100" on:click={() => document.execCommand('italic')}><TextItalic size={14} weight="bold" /></button>
            <button type="button" class="text-xs px-2 py-1 bg-white border border-[#e6e6e6] text-gray-700 rounded-md hover:bg-gray-100" on:click={() => document.execCommand('underline')}><TextUnderline size={14} weight="bold" /></button>
            <button type="button" class="text-xs px-2 py-1 bg-white border border-[#e6e6e6] text-gray-700 rounded-md hover:bg-gray-100" on:click={() => document.execCommand('formatBlock', false, 'h2')}><TextH size={14} weight="bold" /></button>
            <button type="button" class="text-xs px-2 py-1 bg-white border border-[#e6e6e6] text-gray-700 rounded-md hover:bg-gray-100" on:click={() => document.execCommand('insertUnorderedList')}><ListBullets size={14} weight="bold" /></button>
            <button type="button" class="text-xs px-2 py-1 bg-white border border-[#e6e6e6] text-gray-700 rounded-md hover:bg-gray-100" on:click={() => document.execCommand('insertOrderedList')}><ListNumbers size={14} weight="bold" /></button>
          </div>
          <div
            id="card-detail-desc"
            contenteditable="true"
            class="w-full min-h-[120px] px-3 py-2 border border-[#e6e6e6] rounded-lg bg-white text-sm text-gray-700 outline-none focus:border-gray-900"
            bind:innerHTML={detailDescription}
          />
        </div>

        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Checklists</h4>
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

          {#each checklists as list, li}
            <div class="rounded-xl border border-[#e6e6e6] bg-white p-3 space-y-2">
              <div class="flex items-center justify-between gap-2">
                {#if editingListIndex === li && editingItemIndex === -1}
                  <input
                    class="flex-1 px-2 py-1 border border-[#e6e6e6] rounded text-sm text-gray-900 outline-none focus:border-gray-900"
                    bind:value={editListTitle}
                    on:keydown={(e) => {
                      if (e.key === 'Enter') saveListTitle(li);
                      if (e.key === 'Escape') cancelEditListTitle();
                    }}
                    on:blur={() => saveListTitle(li)}
                  />
                {:else}
                  <button
                    class="text-sm font-semibold text-gray-900 hover:underline cursor-pointer bg-transparent border-none p-0"
                    on:click={() => startEditListTitle(li)}
                  >
                    {list.title}
                  </button>
                {/if}
                <button
                  class="text-gray-400 hover:text-red-600"
                  on:click={() => deleteChecklist(li)}
                  aria-label="Delete checklist"
                >
                  <X size={14} />
                </button>
              </div>

              <ul class="m-0 p-0 list-none space-y-2">
                {#each list.items as item, i}
                  {#if showCompleted || !item.done}
                    <li class="flex items-center gap-2 group">
                      <label class="flex items-center gap-2 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          class="sr-only"
                          checked={item.done}
                          on:change={() => toggleChecklistItem(li, i)}
                        />
                        <span class="w-5 h-5 rounded border flex items-center justify-center transition {item.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-300 text-transparent'}">
                          {#if item.done}<Check size={12} weight="bold" />{/if}
                        </span>
                      </label>
                      {#if editingListIndex === li && editingItemIndex === i}
                        <input
                          class="flex-1 px-2 py-1 border border-[#e6e6e6] rounded text-sm text-gray-900 outline-none focus:border-gray-900"
                          bind:value={editItemText}
                          on:keydown={(e) => {
                            if (e.key === 'Enter') saveChecklistItem(li, i);
                            if (e.key === 'Escape') cancelEditChecklistItem();
                          }}
                          on:blur={() => saveChecklistItem(li, i)}
                        />
                      {:else}
                        <span
                          class="flex-1 text-sm text-gray-800 select-none {item.done ? 'line-through text-gray-400' : ''} hover:underline cursor-pointer"
                          role="button"
                          tabindex="0"
                          on:click={() => startEditChecklistItem(li, i)}
                          on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && startEditChecklistItem(li, i)}
                        >{item.text}</span>
                      {/if}
                      <button
                        class="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-gray-400 hover:text-red-600 transition"
                        on:click={() => deleteChecklistItem(li, i)}
                        aria-label="Delete item"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  {/if}
                {/each}
              </ul>

              <div class="flex gap-2">
                <input
                  class="flex-1 px-3 py-1.5 border border-[#e6e6e6] rounded-lg text-sm text-gray-900 outline-none focus:border-gray-900"
                  bind:value={newChecklistItem}
                  placeholder="Add checklist item"
                  on:keydown={(e) => e.key === 'Enter' && addChecklistItem(li)}
                />
                <button class="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800" on:click={() => addChecklistItem(li)}>Add</button>
              </div>
            </div>
          {/each}

          <div class="flex gap-2">
            <input
              class="flex-1 px-3 py-1.5 border border-[#e6e6e6] rounded-lg text-sm text-gray-900 outline-none focus:border-gray-900"
              bind:value={newChecklistTitle}
              placeholder="New checklist title"
              on:keydown={(e) => e.key === 'Enter' && addChecklist()}
            />
            <button class="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800" on:click={addChecklist}>Add checklist</button>
          </div>
        </div>

        {#if links.length > 0}
          <div class="flex flex-col gap-2">
            <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Links</h4>
            <div class="flex flex-wrap gap-3">
              {#each links as link, i}
                <span class="inline-flex items-center gap-1">
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
                  <button
                    class="p-0 text-gray-400 hover:text-gray-700 bg-transparent border-none"
                    on:click={() => openEditLink(i)}
                    aria-label="Edit link"
                  >
                    <PencilSimple size={12} />
                  </button>
                </span>
              {/each}
            </div>
          </div>
        {/if}

        <div class="space-y-2">
          <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Labels</h4>
          {#if detailTags.length > 0}
            <div class="flex flex-wrap gap-1.5">
              {#each detailTags as tag, i}
                <span
                  class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style="background-color: {tag.color}1a; color: {tag.color}"
                >
                  {tag.label}
                  <button
                    class="text-inherit hover:text-red-600"
                    on:click={() => deleteTag(i)}
                    aria-label="Remove label"
                  >
                    <X size={10} weight="bold" />
                  </button>
                </span>
              {/each}
            </div>
          {/if}
          <div class="flex gap-2">
            <input
              class="flex-1 px-3 py-1.5 border border-[#e6e6e6] rounded-lg text-sm text-gray-900 outline-none focus:border-gray-900"
              bind:value={newTagLabel}
              placeholder="Label name"
              on:keydown={(e) => e.key === 'Enter' && addTag()}
            />
            <button class="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800" on:click={addTag}>Add</button>
          </div>
          <div class="flex flex-wrap items-center gap-1.5">
            {#each TAG_COLORS as c}
              <button
                type="button"
                class="w-6 h-6 rounded-full border-2 transition {newTagColor === c ? 'border-gray-900' : 'border-transparent'}"
                style="background-color: {c};"
                on:click={() => newTagColor = c}
                aria-label="Select color"
              ></button>
            {/each}
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between px-5 py-4 border-t border-[#e6e6e6] shrink-0">
        <button class="px-3 py-1.5 rounded-lg bg-transparent text-sm text-red-600 hover:bg-red-50" on:click={deleteDetail}>
          Delete
        </button>
        <div class="flex items-center gap-3">
          <span class="text-xs font-medium text-amber-600 {dirty ? 'visible' : 'invisible'}">Unsaved changes</span>
          <div class="flex gap-2">
            <button class="px-3 py-1.5 rounded-lg border border-[#e6e6e6] bg-white text-sm text-gray-700 hover:bg-gray-50" on:click={closeDetail}>
              Cancel
            </button>
            <button class="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800" on:click={saveDetail}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if showUnsavedConfirm}
  <Modal title="Unsaved changes" on:close={cancelClose}>
    <p class="text-sm text-gray-700 mb-4">You have unsaved changes. Close without saving?</p>
    <div class="flex gap-2 justify-end">
      <button class="secondary" on:click={cancelClose}>Keep editing</button>
      <button on:click={confirmClose}>Close without saving</button>
    </div>
  </Modal>
{/if}

{#if linkModalOpen}
  <Modal title={editingLinkIndex >= 0 ? 'Edit link' : 'Add link'} on:close={closeLinkModal}>
    <div class="space-y-3">
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide" for="link-url">URL</label>
        <input
          id="link-url"
          class="w-full px-3 py-1.5 border border-[#e6e6e6] rounded-lg text-sm text-gray-900 outline-none focus:border-gray-900"
          bind:value={linkUrl}
          placeholder="https://example.com"
          on:keydown={(e) => e.key === 'Enter' && saveLink()}
        />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide" for="link-label">Label</label>
        <input
          id="link-label"
          class="w-full px-3 py-1.5 border border-[#e6e6e6] rounded-lg text-sm text-gray-900 outline-none focus:border-gray-900"
          bind:value={linkLabel}
          placeholder="Link label"
          on:keydown={(e) => e.key === 'Enter' && saveLink()}
        />
      </div>
      <div class="flex gap-2 justify-end">
        <button class="secondary" on:click={closeLinkModal}>Cancel</button>
        <button on:click={saveLink}>{editingLinkIndex >= 0 ? 'Save' : 'Add'}</button>
      </div>
    </div>
  </Modal>
{/if}
