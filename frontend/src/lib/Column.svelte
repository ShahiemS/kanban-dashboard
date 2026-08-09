<script>
  import { createEventDispatcher } from 'svelte';
  import Card from './Card.svelte';

  export let column;
  export let cards;
  export let api;

  const dispatch = createEventDispatcher();

  let newTitle = '';
  let newDesc = '';
  let newTag = '';
  let newTagColor = '';
  let newCoverImage = '';
  let newProgress = '';
  let newAttachments = '';
  let newComments = '';
  let newMembers = '';
  let showAdd = false;
  let dragOver = false;
  let editingTitle = false;
  let editTitle = column.title;
  let menuOpen = false;

  function toggleMenu() {
    menuOpen = !menuOpen;
  }

  function closeMenu() {
    menuOpen = false;
  }

  async function addCard() {
    if (!newTitle.trim()) return;

    const meta = {};
    if (newTag.trim()) meta.tag = newTag.trim();
    if (newTagColor.trim()) meta.tag_color = newTagColor.trim();
    if (newCoverImage.trim()) meta.cover_image = newCoverImage.trim();
    if (newProgress.trim()) meta.progress = parseInt(newProgress, 10);
    if (newAttachments.trim()) meta.attachments_count = parseInt(newAttachments, 10);
    if (newComments.trim()) meta.comments_count = parseInt(newComments, 10);
    if (newMembers.trim()) {
      meta.members = newMembers.split(',').map(s => s.trim()).filter(Boolean);
    }

    const res = await fetch(`${api}/api/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle,
        description: newDesc,
        column_id: column.id,
        position: cards.length,
        meta
      })
    });
    const card = await res.json();
    dispatch('cardMoved', card);
    newTitle = '';
    newDesc = '';
    newTag = '';
    newTagColor = '';
    newCoverImage = '';
    newProgress = '';
    newAttachments = '';
    newComments = '';
    newMembers = '';
    showAdd = false;
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
    const targetCardId = e.dataTransfer.getData('targetCardId');
    if (!cardId || targetCardId) return;
    const res = await fetch(`${api}/api/cards/${cardId}/move`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ column_id: column.id, position: cards.length })
    });
    const updated = await res.json();
    dispatch('cardMoved', updated);
  }

  function onColumnDragStart(e) {
    e.dataTransfer.setData('columnId', column.id);
    e.dataTransfer.effectAllowed = 'move';
  }
  async function archiveAll() {
    closeMenu();
    await fetch(`${api}/api/columns/${column.id}/archive`, { method: 'PATCH' });
    dispatch('archiveAll', { column_id: column.id });
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
        <input type="text" class="column-rename-input" bind:value={editTitle} />
        <button on:click={renameColumn}>Save</button>
        <button class="secondary" on:click={cancelRename}>Cancel</button>
      </div>
    {:else}
      <h2 class="column-title">
        <span class="column-title-text">{column.title}</span>
        <span class="column-count">{cards.length}</span>
      </h2>
      <div class="column-menu-wrapper">
        <button class="card-action column-menu-btn" on:click|stopPropagation={toggleMenu} aria-label="Column options">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>
        {#if menuOpen}
          <div class="card-menu-dropdown column-menu-dropdown">
            <button on:click={startEditing}>Rename list</button>
            <button on:click={archiveAll}>Archive all</button>
            <button class="danger" on:click={deleteColumn}>Delete list</button>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <div class="cards">
    {#each cards as card (card.id)}
      <Card {card} {api} on:cardMoved />
    {/each}
  </div>

  {#if showAdd}
    <div class="add-card">
      <input bind:value={newTitle} placeholder="Card title" />
      <textarea bind:value={newDesc} placeholder="Description" rows="2" />
      <div class="add-card-meta">
        <input bind:value={newTag} placeholder="Tag" />
        <input bind:value={newTagColor} placeholder="Tag color (hex)" />
        <input bind:value={newCoverImage} placeholder="Cover image URL" />
        <input bind:value={newProgress} placeholder="Progress %" type="number" min="0" max="100" />
        <input bind:value={newAttachments} placeholder="Attachments" type="number" min="0" />
        <input bind:value={newComments} placeholder="Comments" type="number" min="0" />
        <input bind:value={newMembers} placeholder="Member image URLs (comma separated)" />
      </div>
      <div class="add-card-actions">
        <button on:click={addCard}>Add card</button>
        <button class="secondary" on:click={() => showAdd = false}>Cancel</button>
      </div>
    </div>
  {:else}
    <button class="add-card-trigger" on:click={() => showAdd = true}>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      Add card
    </button>
  {/if}
</div>
