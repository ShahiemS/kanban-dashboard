<script>
  import { createEventDispatcher, tick } from 'svelte';
  import { flip } from 'svelte/animate';
  import { DotsThree, Plus, MagicWand, CircleNotch } from 'phosphor-svelte';
  import Card, { draggingCard } from './Card.svelte';
  import Modal from './Modal.svelte';

  export let column;
  export let cards;
  export let api;

  const dispatch = createEventDispatcher();

  let newTitle = '';
  let newDesc = '';
  let addAnother = false;
  let showAdd = false;
  let justAdded = false;
  let dragOver = false;
  let editingTitle = false;
  let editTitle = column.title;
  let menuOpen = false;
  let titleInput = null;
  let improving = false;
  let improveError = '';
  let improveNotice = '';
  let improveNoticeTimer = null;
  let dropIndex = null;
  let cardsEl = null;

  function computeDropIndex(y) {
    if (!cardsEl) return cards.length;
    const els = cardsEl.querySelectorAll('.card-wrapper');
    for (let i = 0; i < els.length; i++) {
      const r = els[i].lastElementChild.getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return els.length;
  }

  function onCardsDragOver(e) {
    if (!e.dataTransfer.types.includes('cardid')) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    dropIndex = computeDropIndex(e.clientY);
    dragOver = true;
  }

  function onCardsDragLeave(e) {
    if (cardsEl && !cardsEl.contains(e.relatedTarget)) {
      dropIndex = null;
    }
  }

  function onCardsDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const cardId = parseInt(e.dataTransfer.getData('cardId'), 10);
    const index = dropIndex ?? cards.length;
    dropIndex = null;
    dragOver = false;
    if (!cardId) return;
    dispatch('cardDropped', { cardId, columnId: column.id, index });
  }

  async function improveWithAI() {
    if (improving || (!newTitle.trim() && !newDesc.trim())) return;
    improving = true;
    improveError = '';
    improveNotice = '';
    try {
      const res = await fetch(`${api}/api/ai/improve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, description: newDesc })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      const changed = (data.title && data.title !== newTitle) || (data.description && data.description !== newDesc);
      if (data.title) newTitle = data.title;
      if (data.description) newDesc = data.description;
      improveNotice = changed ? 'Improved' : 'Already looks good';
      clearTimeout(improveNoticeTimer);
      improveNoticeTimer = setTimeout(() => { improveNotice = ''; }, 3000);
    } catch (err) {
      improveError = err.message || 'Improvement failed';
    } finally {
      improving = false;
    }
  }

  function toggleMenu() {
    menuOpen = !menuOpen;
  }

  function closeMenu() {
    menuOpen = false;
  }

  async function addCard() {
    if (!newTitle.trim()) return;

    const res = await fetch(`${api}/api/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle,
        description: newDesc,
        column_id: column.id,
        position: cards.length,
        meta: {}
      })
    });
    const card = await res.json();
    dispatch('cardMoved', card);
    newTitle = '';
    newDesc = '';

    if (addAnother) {
      justAdded = true;
      setTimeout(() => { justAdded = false; }, 1500);
      tick().then(() => titleInput?.focus());
    } else {
      showAdd = false;
    }
  }

  function closeAddCard() {
    showAdd = false;
    newTitle = '';
    newDesc = '';
  }

  async function openAddCard() {
    showAdd = true;
    await tick();
    titleInput?.focus();
  }

  function onDragOver(e) {
    e.preventDefault();
    dragOver = true;
  }

  function onDragLeave() {
    dragOver = false;
  }

  async function onDrop(e) {
    e.preventDefault();
    dragOver = false;
    const columnId = e.dataTransfer.getData('columnId');
    if (columnId) {
      dispatch('columnMoved', { from: parseInt(columnId, 10), to: column.id });
      return;
    }
    const cardId = e.dataTransfer.getData('cardId');
    if (!cardId) return;
    dispatch('cardDropped', { cardId: parseInt(cardId, 10), columnId: column.id, index: cards.length });
  }

  $: if (!$draggingCard) dropIndex = null;

  function onColumnDragStart(e) {
    e.dataTransfer.setData('columnId', column.id);
    e.dataTransfer.effectAllowed = 'move';
  }
  async function archiveAll() {
    closeMenu();
    await fetch(`${api}/api/columns/${column.id}/archive`, { method: 'PATCH' });
    dispatch('archiveAll', { column_id: column.id });
  }

  async function archiveCompleted() {
    closeMenu();
    await fetch(`${api}/api/columns/${column.id}/archive-completed`, { method: 'PATCH' });
    dispatch('archiveCompleted', { column_id: column.id });
  }

  function startEditing() {
    closeMenu();
    editingTitle = true;
    editTitle = column.title;
  }

  function cancelRename() {
    editingTitle = false;
    editTitle = column.title;
  }

  async function renameColumn() {
    if (!editTitle.trim()) return;
    const res = await fetch(`${api}/api/columns/${column.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle })
    });
    const updated = await res.json();
    column.title = updated.title;
    dispatch('columnRenamed', updated);
    editingTitle = false;
  }

  async function deleteColumn() {
    closeMenu();
    if (!confirm('Delete this column and all its cards?')) return;
    await fetch(`${api}/api/columns/${column.id}`, { method: 'DELETE' });
    dispatch('columnDeleted', { column_id: column.id });
  }
</script>

<div
  class="column"
  class:drag-over={dragOver}
  draggable="true"
  on:dragstart|self={onColumnDragStart}
  on:dragover={onDragOver}
  on:dragleave={onDragLeave}
  on:drop={onDrop}
  role="list"
>
  <div class="column-header">
    {#if editingTitle}
      <div class="column-rename">
        <input
          type="text"
          class="column-rename-input"
          bind:value={editTitle}
          on:keydown={(e) => {
            if (e.key === 'Enter') renameColumn();
            if (e.key === 'Escape') cancelRename();
          }}
        />
        <button on:click={renameColumn}>Save</button>
        <button class="secondary" on:click={cancelRename}>Cancel</button>
      </div>
    {:else}
      <h2 class="column-title">
        <button class="column-title-text bg-transparent border-none p-0 text-inherit cursor-pointer hover:bg-transparent hover:opacity-80" on:click={startEditing}>{column.title}</button>
        <span class="column-count">{cards.length}</span>
      </h2>
      <div class="column-menu-wrapper">
        <button class="card-action column-menu-btn" on:click|stopPropagation={toggleMenu} aria-label="Column options">
          <DotsThree size={16} weight="bold" />
        </button>
        {#if menuOpen}
          <div class="card-menu-dropdown column-menu-dropdown">
            <button on:click={startEditing}>Rename list</button>
            <button on:click={archiveAll}>Archive all</button>
            <button on:click={archiveCompleted}>Archive completed</button>
            <button class="danger" on:click={deleteColumn}>Delete list</button>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <div
    class="cards"
    bind:this={cardsEl}
    on:dragover={onCardsDragOver}
    on:dragleave={onCardsDragLeave}
    on:drop={onCardsDrop}
  >
    {#each cards as card, i (card.id)}
      <div class="card-wrapper" class:card-dragging={$draggingCard?.id === card.id} animate:flip={{ duration: 200 }}>
        {#if dropIndex === i}
          <div class="drop-indicator" style:height="{$draggingCard?.height || 40}px"></div>
        {/if}
        <Card {card} {api} on:cardMoved />
      </div>
    {/each}
    {#if dropIndex !== null && dropIndex >= cards.length}
      <div class="drop-indicator" style:height="{$draggingCard?.height || 40}px"></div>
    {/if}
  </div>

  <button class="add-card-trigger" on:click={openAddCard}>
    <Plus size={14} />
    Add card
  </button>
</div>

{#if showAdd}
  <Modal title="Add card to {column.title}" on:close={closeAddCard}>
    <div class="add-card-form">
      <label class="add-card-label" for="add-card-title">Title</label>
      <input bind:this={titleInput} id="add-card-title" bind:value={newTitle} placeholder="e.g. Design the login page" on:keydown={(e) => e.key === 'Enter' && addCard()} />

      <label class="add-card-label" for="add-card-desc">Description</label>
      <textarea id="add-card-desc" bind:value={newDesc} placeholder="Optional description" rows="3" />

      <div style="display: flex; align-items: center; gap: 8px;">
        <button
          class="secondary"
          style="display: inline-flex; align-items: center; gap: 6px;"
          on:click={improveWithAI}
          disabled={improving || (!newTitle.trim() && !newDesc.trim())}
          title="Improve title and description with AI"
        >
          {#if improving}
            <CircleNotch size={14} class="animate-spin" />
            Improving…
          {:else}
            <MagicWand size={14} />
            Improve with AI
          {/if}
        </button>
        {#if improveNotice}
          <span style="font-size: 11px; color: #059669;">{improveNotice}</span>
        {/if}
        {#if improveError}
          <span style="font-size: 11px; color: #dc2626;">{improveError}</span>
        {/if}
      </div>

      <label class="add-card-checkbox">
        <input type="checkbox" bind:checked={addAnother} />
        Add another card after this one
      </label>

      <div class="add-card-actions">
        <button on:click={addCard}>Add card</button>
        <button class="secondary" on:click={closeAddCard}>Done</button>
        {#if justAdded}
          <span class="add-card-confirm">Card added — add another below</span>
        {/if}
      </div>
    </div>
  </Modal>
{/if}
