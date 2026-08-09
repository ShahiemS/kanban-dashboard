<script>
  import { createEventDispatcher } from 'svelte';

  export let card;
  export let api;

  const dispatch = createEventDispatcher();

  let menuOpen = false;

  $: meta = card.meta || {};
  $: tag = meta.tag || '';
  $: tagColor = meta.tag_color || '';
  $: coverImage = meta.cover_image || '';
  $: progress = meta.progress != null ? Number(meta.progress) : null;
  $: attachmentsCount = meta.attachments_count != null ? Number(meta.attachments_count) : null;
  $: commentsCount = meta.comments_count != null ? Number(meta.comments_count) : null;
  $: members = Array.isArray(meta.members) ? meta.members : [];

  function onDragStart(e) {
    e.dataTransfer.setData('cardId', card.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  async function deleteCard() {
    await fetch(`${api}/api/cards/${card.id}`, { method: 'DELETE' });
    dispatch('cardMoved', { ...card, deleted: true });
  }

  function toggleMenu() {
    menuOpen = !menuOpen;
  }
</script>

<div class="card" draggable="true" on:dragstart={onDragStart} role="button" tabindex="0">
  <div class="card-header">
    {#if tag}
      <span class="card-tag" style="background-color: {tagColor}1a; color: {tagColor}">
        {tag}
      </span>
    {:else}
      <span class="card-tag-placeholder"></span>
    {/if}
    <div class="card-header-actions">
      <button class="card-action" aria-label="Add tag">+</button>
      <div class="card-menu-wrapper">
        <button class="card-action card-menu" on:click|stopPropagation={toggleMenu} aria-label="More options">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>
        {#if menuOpen}
          <div class="card-menu-dropdown">
            <button on:click|stopPropagation={deleteCard}>Delete</button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <h3 class="card-title">{card.title}</h3>
  {#if card.description}
    <p class="card-description">{card.description}</p>
  {/if}

  {#if progress != null}
    <div class="card-progress">
      <div class="card-progress-track">
        <div
          class="card-progress-bar"
          style="width: {progress}%; background-color: {tagColor || '#6554c0'}"
        ></div>
      </div>
      <span class="card-progress-text">{progress}%</span>
    </div>
  {/if}

  {#if coverImage}
    <img class="card-cover" src={coverImage} alt="" loading="lazy" />
  {/if}

  <div class="card-footer">
    <div class="card-avatars">
      {#each members as member, i (member)}
        <img
          class="card-avatar"
          src={member}
          alt="Member"
          style="z-index: {members.length - i};"
        />
      {/each}
    </div>

    <div class="card-stats">
      {#if attachmentsCount != null && attachmentsCount > 0}
        <span class="card-stat" title="Attachments">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          {attachmentsCount}
        </span>
      {/if}
      {#if commentsCount != null && commentsCount > 0}
        <span class="card-stat" title="Comments">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          {commentsCount}
        </span>
      {/if}
    </div>
  </div>
</div>
