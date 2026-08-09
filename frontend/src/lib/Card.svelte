<script>
  import { createEventDispatcher } from 'svelte';

  export let card;
  export let api;

  const dispatch = createEventDispatcher();

  let menuOpen = false;

  $: meta = card.meta || {};
  $: coverImage = meta.cover_image || '';
  $: subtasks = Array.isArray(meta.subtasks) ? meta.subtasks : [];
  $: links = Array.isArray(meta.links) ? meta.links : [];
  $: tags = Array.isArray(meta.tags) && meta.tags.length
    ? meta.tags
    : (meta.tag ? [{ label: meta.tag, color: meta.tag_color || '#0079bf' }] : []);

  function onDragStart(e) {
    e.dataTransfer.setData('cardId', card.id);
    e.dataTransfer.effectAllowed = 'move';
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

  function toggleSubtask(index) {
    const next = subtasks.map((s, i) => i === index ? { ...s, done: !s.done } : s);
    saveMeta({ ...meta, subtasks: next });
  }

  function addSubtask() {
    const text = prompt('Sub task title');
    if (!text || !text.trim()) return;
    saveMeta({ ...meta, subtasks: [...subtasks, { text: text.trim(), done: false }] });
  }

  function addLink() {
    const url = prompt('Link URL (e.g. https://docs.google.com/...)');
    if (!url || !url.trim()) return;
    const label = prompt('Label to show', url.replace(/^https?:\/\//, '').split('/')[0]) || url;
    saveMeta({ ...meta, links: [...links, { label: label.trim(), url: url.trim() }] });
  }

  async function deleteCard() {
    await fetch(`${api}/api/cards/${card.id}`, { method: 'DELETE' });
    dispatch('cardMoved', { ...card, deleted: true });
  }

  function toggleMenu() {
    menuOpen = !menuOpen;
  }
</script>

<div
  class="group relative bg-white rounded-[10px] border border-[#e6e6e6] p-3 mb-2 cursor-grab active:cursor-grabbing transition-colors hover:border-[#d4d4d4] hover:bg-[#fafafa]"
  draggable="true"
  on:dragstart={onDragStart}
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
    {#if menuOpen}
      <div class="absolute right-0 top-7 z-30 min-w-[140px] rounded-[10px] border border-[#e6e6e6] bg-white p-1 shadow-[0_6px_16px_rgba(0,0,0,0.06)]">
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

  {#if subtasks.length > 0}
    <div class="mt-3">
      <p class="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Sub tasks</p>
      <ul class="mt-1.5 space-y-1.5">
        {#each subtasks as subtask, i}
          <li class="flex items-center gap-2">
            <button
              class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition
                {subtask.done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-gray-400'}"
              on:click|stopPropagation={() => toggleSubtask(i)}
              aria-label={subtask.done ? 'Mark incomplete' : 'Mark complete'}
            >
              {#if subtask.done}
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              {/if}
            </button>
            <span class="text-sm text-gray-700">{subtask.text}</span>
          </li>
        {/each}
      </ul>
      <button
        class="mt-1.5 text-xs text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-600 transition"
        on:click|stopPropagation={addSubtask}
      >
        + Add sub task
      </button>
    </div>
  {:else}
    <button
      class="mt-3 text-xs text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-600 transition"
      on:click|stopPropagation={addSubtask}
    >
      + Add sub tasks
    </button>
  {/if}

  {#if coverImage}
    <img class="mt-3 h-28 w-full rounded-lg object-cover" src={coverImage} alt="" loading="lazy" />
  {/if}

  {#if links.length > 0}
    <div class="mt-3 flex flex-wrap items-center gap-3">
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
      <button class="text-xs text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-600 transition" on:click|stopPropagation={addLink}>
        + Add link
      </button>
    </div>
  {:else}
    <button class="mt-3 text-xs text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-600 transition" on:click|stopPropagation={addLink}>
      + Add link
    </button>
  {/if}

  {#if tags.length > 0}
    <div class="mt-3 flex flex-wrap gap-1.5">
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
