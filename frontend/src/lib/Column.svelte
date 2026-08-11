<script>
  import { createEventDispatcher, tick } from 'svelte';
  import { DotsThree, Plus } from 'phosphor-svelte';
  import Card from './Card.svelte';
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
