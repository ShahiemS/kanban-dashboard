<script context="module">
  import { writable } from 'svelte/store';
  const activeMenu = writable(null);
</script>

<script>
  import { createEventDispatcher, tick } from 'svelte';
  import { get } from 'svelte/store';
  import { fly } from 'svelte/transition';
  import { DotsThree, Link, X, Check, Article, TextB, TextH, TextItalic, TextUnderline, ListBullets, ListNumbers, PencilSimple, Trash, Timer, Play, Pause, ArrowCounterClockwise } from 'phosphor-svelte';
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
  let menuBtnEl = null;
  let menuPos = { top: 0, left: 0 };
  let detailTags = [];
  let newTagLabel = '';
  let newTagColor = '#0079bf';
  let linkModalOpen = false;
  let linkUrl = '';
  let linkLabel = '';
  let editingLinkIndex = -1;
  let attachmentModalOpen = false;
  let attachmentName = '';
  let attachmentUrl = '';
  let editingAttachmentIndex = -1;
  let showColorPicker = false;
  let activeTab = 'details';
  let editingDetailTitle = false;
  let showDeleteConfirm = false;
  let newComment = '';
  let editingCommentIndex = -1;
  let editCommentText = '';

  // Pomodoro timer
  let pomodoroMinutes = 25;
  let breakMinutes = 5;
  let pomodoroSeconds = pomodoroMinutes * 60;
  let pomodoroRunning = false;
  let pomodoroInterval = null;
  let pomodoroMode = 'work'; // 'work' | 'break'
  let pomodoroCount = 0;

  const TAG_COLORS = ['#0079bf', '#61bd4f', '#f2d600', '#ff9f1a', '#eb5a46', '#c377e0', '#00c2e0', '#344563'];

  function focusOnMount(node) {
    node.focus();
    node.select();
  }

  $: meta = card.meta || {};
  $: coverImage = meta.cover_image || '';
  $: links = Array.isArray(meta.links) ? meta.links : [];
  $: attachments = Array.isArray(meta.attachments) ? meta.attachments : [];
  $: comments = Array.isArray(meta.comments) ? meta.comments : [];
  $: tags = Array.isArray(meta.tags) && meta.tags.length
    ? meta.tags
    : (meta.tag ? [{ label: meta.tag, color: meta.tag_color || '#0079bf' }] : []);
  $: dirty = detailOpen && (detailTitle !== card.title || detailDescription !== (card.description || ''));

  let savedDocTitle = '';
  $: if (typeof document !== 'undefined') {
    if (pomodoroRunning || pomodoroSeconds < (pomodoroMode === 'work' ? pomodoroMinutes : breakMinutes) * 60) {
      if (!savedDocTitle) savedDocTitle = document.title;
      const label = pomodoroMode === 'work' ? 'Focus' : 'Break';
      document.title = `${formatTime(pomodoroSeconds)} ${label} | Pomodoro`;
    } else if (savedDocTitle) {
      document.title = savedDocTitle;
      savedDocTitle = '';
    }
  }
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

  function openAddAttachment() {
    closeMenus();
    editingAttachmentIndex = -1;
    attachmentName = '';
    attachmentUrl = '';
    attachmentModalOpen = true;
  }

  function openEditAttachment(index) {
    const att = attachments[index];
    editingAttachmentIndex = index;
    attachmentName = att.name;
    attachmentUrl = att.url;
    attachmentModalOpen = true;
  }

  function closeAttachmentModal() {
    attachmentModalOpen = false;
    attachmentName = '';
    attachmentUrl = '';
    editingAttachmentIndex = -1;
  }

  function saveAttachment() {
    const url = attachmentUrl.trim();
    const name = attachmentName.trim() || url.split('/').pop() || 'Attachment';
    if (!url) return;
    const next = [...attachments];
    if (editingAttachmentIndex >= 0) {
      next[editingAttachmentIndex] = { name, url };
    } else {
      next.push({ name, url });
    }
    saveMeta({ ...meta, attachments: next });
    closeAttachmentModal();
  }

  function removeAttachment(index) {
    const next = attachments.filter((_, i) => i !== index);
    saveMeta({ ...meta, attachments: next });
  }

  function removeLink(index) {
    const next = links.filter((_, i) => i !== index);
    saveMeta({ ...meta, links: next });
  }

  function addComment() {
    if (!newComment.trim()) return;
    const author = localStorage.getItem('kanban.user.name') || 'Anonymous';
    const avatar = localStorage.getItem('kanban.user.avatarSeed') || '';
    const comment = { text: newComment.trim(), timestamp: new Date().toISOString(), author, avatar };
    saveMeta({ ...meta, comments: [...comments, comment] });
    newComment = '';
  }

  function getAvatarUrl(seed) {
    if (!seed) return '';
    if (seed.startsWith('http')) return seed;
    return `https://api.dicebear.com/7.x/lorelei/svg?seed=${seed}`;
  }

  function startPomodoro() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    pomodoroRunning = true;
    pomodoroInterval = setInterval(() => {
      pomodoroSeconds--;
      if (pomodoroSeconds <= 0) {
        clearInterval(pomodoroInterval);
        pomodoroRunning = false;
        const wasWork = pomodoroMode === 'work';
        if (wasWork) {
          pomodoroCount++;
          pomodoroMode = 'break';
          pomodoroSeconds = breakMinutes * 60;
        } else {
          pomodoroMode = 'work';
          pomodoroSeconds = pomodoroMinutes * 60;
        }
        pomodoroNotify(wasWork ? 'Focus session done! Time for a break.' : 'Break over! Ready to focus again.');
      }
    }, 1000);
  }

  function pausePomodoro() {
    pomodoroRunning = false;
    if (pomodoroInterval) clearInterval(pomodoroInterval);
  }

  function resetPomodoro() {
    pausePomodoro();
    pomodoroMode = 'work';
    pomodoroSeconds = pomodoroMinutes * 60;
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function pomodoroNotify(message) {
    // Audio alert - 3 beeps, louder and longer
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const beep = (freq, startTime, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.value = 0.8;
        gain.gain.setValueAtTime(0.8, ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startTime + duration);
        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
      };
      beep(880, 0, 0.4);
      beep(1100, 0.5, 0.4);
      beep(880, 1.0, 0.6);
    } catch (e) {}
    // Browser notification
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('Pomodoro', { body: message, icon: '/favicon.svg' });
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then(p => {
          if (p === 'granted') new Notification('Pomodoro', { body: message, icon: '/favicon.svg' });
        });
      }
    }
  }

  function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }

  function deleteComment(index) {
    const next = comments.filter((_, i) => i !== index);
    saveMeta({ ...meta, comments: next });
  }

  function startEditComment(index) {
    editingCommentIndex = index;
    editCommentText = comments[index].text;
  }

  function saveEditComment() {
    if (editingCommentIndex < 0) return;
    const next = comments.map((c, i) => i === editingCommentIndex ? { ...c, text: editCommentText.trim() } : c);
    saveMeta({ ...meta, comments: next });
    editingCommentIndex = -1;
    editCommentText = '';
  }

  function cancelEditComment() {
    editingCommentIndex = -1;
    editCommentText = '';
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
      if (menuBtnEl) {
        const rect = menuBtnEl.getBoundingClientRect();
        menuPos = { top: rect.bottom + 4, left: rect.right };
      }
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
    saveMeta({ ...meta, tags: detailTags });
  }

  function deleteTag(index) {
    detailTags = detailTags.filter((_, i) => i !== index);
    saveMeta({ ...meta, tags: detailTags });
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
    showDeleteConfirm = true;
  }

  function confirmDelete() {
    showDeleteConfirm = false;
    deleteCard();
    detailOpen = false;
  }

  function cancelDelete() {
    showDeleteConfirm = false;
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
      bind:this={menuBtnEl}
      class="flex items-center justify-center w-6 h-6 rounded-md border border-transparent bg-transparent p-0 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-900 transition"
      on:click|stopPropagation={toggleMenu}
      aria-label="More options"
    >
      <DotsThree size={14} weight="bold" />
    </button>
    {#if $activeMenu?.cardId === card.id && $activeMenu?.type === 'menu'}
      <div class="fixed z-50 min-w-[140px] rounded-[10px] border border-[#e6e6e6] bg-white p-1 shadow-[0_6px_16px_rgba(0,0,0,0.06)]" style="top: {menuPos.top}px; left: {menuPos.left}px; transform: translateX(-100%)">
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
          class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium bg-white text-gray-900 border border-[#e6e6e6]"
        >
          <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background-color: {t.color};"></span>
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
        {#if editingDetailTitle}
          <input
            class="flex-1 mr-3 px-2 py-1 text-lg font-semibold text-gray-900 border border-[#e6e6e6] rounded-lg outline-none focus:border-gray-900 bg-white"
            bind:value={detailTitle}
            use:focusOnMount
            on:blur={() => editingDetailTitle = false}
            on:keydown={(e) => { if (e.key === 'Enter') editingDetailTitle = false; }}
          />
        {:else}
          <button
            class="flex items-center gap-2 bg-transparent border-none p-0 group text-left"
            on:click={() => editingDetailTitle = true}
          >
            <h2 class="text-lg font-semibold text-gray-900 truncate">{detailTitle || 'Untitled'}</h2>
            <PencilSimple size={14} class="shrink-0 text-gray-400 opacity-0 group-hover:opacity-100 transition" />
          </button>
        {/if}
        <button
          class="flex items-center justify-center w-8 h-8 rounded-md bg-transparent border-none text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          on:click={closeDetail}
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div class="flex gap-0 border-b border-[#e6e6e6] px-5">
        <button
          class="px-4 py-2.5 text-xs font-medium transition bg-transparent border-0 border-b-2 rounded-none {activeTab === 'details' ? 'border-b-black text-gray-900' : 'border-b-transparent text-gray-500 hover:text-gray-700'}"
          on:click={() => activeTab = 'details'}
        >Details</button>
        <button
          class="px-4 py-2.5 text-xs font-medium transition bg-transparent border-0 border-b-2 rounded-none {activeTab === 'links' ? 'border-b-black text-gray-900' : 'border-b-transparent text-gray-500 hover:text-gray-700'}"
          on:click={() => activeTab = 'links'}
        >Links ({links.length})</button>
        <button
          class="px-4 py-2.5 text-xs font-medium transition bg-transparent border-0 border-b-2 rounded-none {activeTab === 'labels' ? 'border-b-black text-gray-900' : 'border-b-transparent text-gray-500 hover:text-gray-700'}"
          on:click={() => activeTab = 'labels'}
        >Labels ({detailTags.length})</button>
        <button
          class="px-4 py-2.5 text-xs font-medium transition bg-transparent border-0 border-b-2 rounded-none {activeTab === 'comments' ? 'border-b-black text-gray-900' : 'border-b-transparent text-gray-500 hover:text-gray-700'}"
          on:click={() => activeTab = 'comments'}
        >Comments ({comments.length})</button>
        <button
          class="px-4 py-2.5 text-xs font-medium transition bg-transparent border-0 border-b-2 rounded-none {activeTab === 'pomodoro' ? 'border-b-black text-gray-900' : 'border-b-transparent text-gray-500 hover:text-gray-700'}"
          on:click={() => activeTab = 'pomodoro'}
        >Pomodoro</button>
      </div>

      <div class="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {#if activeTab === 'details'}
        {#if coverImage}
          <img class="h-48 w-full rounded-xl object-cover" src={coverImage} alt="" />
        {/if}



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
              class="text-xs font-medium px-2 py-1 rounded border border-[#e6e6e6] bg-white text-gray-700 hover:bg-gray-50 transition"
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
                  class="p-1 rounded border border-[#e6e6e6] bg-white text-gray-400 hover:text-red-600 hover:border-red-200 transition"
                  on:click={() => deleteChecklist(li)}
                  aria-label="Delete checklist"
                >
                  <X size={12} />
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

        <div class="space-y-2">
          <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Attachments</h4>
          {#if attachments.length > 0}
            <div class="flex flex-col gap-2">
              {#each attachments as att, i}
                <div class="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#e6e6e6] bg-white">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-gray-400">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                  <a href={att.url} target="_blank" rel="noopener noreferrer" class="flex-1 text-xs text-gray-900 hover:underline truncate">{att.name}</a>
                  <button class="p-0 bg-transparent border-none text-gray-400 hover:text-gray-700" on:click={() => openEditAttachment(i)} aria-label="Edit attachment">
                    <PencilSimple size={12} />
                  </button>
                  <button class="p-0 bg-transparent border-none text-gray-400 hover:text-red-500" on:click={() => removeAttachment(i)} aria-label="Remove attachment">
                    <X size={12} weight="bold" />
                  </button>
                </div>
              {/each}
            </div>
          {/if}
          <button class="px-3 py-1.5 rounded-lg border border-[#e6e6e6] bg-white text-sm font-medium text-gray-900 hover:bg-gray-50" on:click={openAddAttachment}>+ Add attachment</button>
        </div>

        {:else if activeTab === 'links'}
          <div class="space-y-3">
            {#if links.length > 0}
              <div class="flex flex-wrap gap-2">
                {#each links as link, i}
                  <span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium bg-white border border-[#e6e6e6] text-gray-900">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" class="max-w-[120px] truncate text-gray-900 hover:underline no-underline">{link.label}</a>
                    <button class="flex items-center justify-center p-0 bg-transparent border-none text-gray-400 hover:text-gray-900 transition" on:click={() => openEditLink(i)} aria-label="Edit link">
                      <PencilSimple size={11} />
                    </button>
                    <button class="flex items-center justify-center w-4 h-4 rounded-full bg-transparent border-none text-gray-400 hover:text-gray-900 hover:bg-gray-200 transition" on:click={() => removeLink(i)} aria-label="Remove link">
                      <X size={10} weight="bold" />
                    </button>
                  </span>
                {/each}
              </div>
            {:else}
              <p class="text-xs text-gray-400">No links yet.</p>
            {/if}
            <button class="px-3 py-1.5 rounded-lg border border-[#e6e6e6] bg-white text-sm font-medium text-gray-900 hover:bg-gray-50" on:click={openAddLink}>+ Add link</button>
          </div>

        {:else if activeTab === 'labels'}
          <div class="space-y-3">
            {#if detailTags.length > 0}
              <div class="flex flex-wrap gap-2">
                {#each detailTags as tag, i}
                  <span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium bg-white text-gray-900 border border-[#e6e6e6]">
                    <span class="w-2 h-2 rounded-full shrink-0" style="background-color: {tag.color};"></span>
                    {tag.label}
                    <button class="flex items-center justify-center w-4 h-4 rounded-full bg-transparent border-none text-gray-400 hover:text-gray-900 hover:bg-gray-200 transition" on:click={() => deleteTag(i)} aria-label="Remove label">
                      <X size={10} weight="bold" />
                    </button>
                  </span>
                {/each}
              </div>
            {/if}
            <div class="flex gap-2 items-center">
              <div class="relative">
                <button
                  type="button"
                  class="w-7 h-7 rounded-full border border-[#e6e6e6] shrink-0"
                  style="background-color: {newTagColor};"
                  on:click|stopPropagation={() => showColorPicker = !showColorPicker}
                  aria-label="Pick color"
                ></button>
                {#if showColorPicker}
                  <div class="fixed z-[9999] p-2 bg-white border border-[#e6e6e6] rounded-lg shadow-[0_6px_16px_rgba(0,0,0,0.12)]" style="width: 120px; margin-top: 4px;">
                    <div class="grid grid-cols-4 gap-1">
                      {#each TAG_COLORS as c}
                        <button
                          type="button"
                          class="w-6 h-6 rounded-full border-2 transition {newTagColor === c ? 'border-gray-900' : 'border-transparent hover:border-gray-300'}"
                          style="background-color: {c};"
                          on:click|stopPropagation={() => { newTagColor = c; showColorPicker = false; }}
                          aria-label="Select color"
                        ></button>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
              <input
                class="flex-1 px-3 py-1.5 border border-[#e6e6e6] rounded-lg text-sm text-gray-900 outline-none focus:border-gray-900"
                bind:value={newTagLabel}
                placeholder="Label name"
                on:keydown={(e) => e.key === 'Enter' && addTag()}
              />
              <button class="px-3 py-1.5 rounded-lg border border-[#e6e6e6] bg-white text-sm font-medium text-gray-900 hover:bg-gray-50" on:click={addTag}>Add</button>
            </div>
          </div>

        {:else if activeTab === 'comments'}
          <div class="space-y-4">
            {#if comments.length > 0}
              <div class="flex flex-col gap-3">
                {#each comments as comment, i}
                  <div class="flex gap-3 px-3 py-2.5 rounded-lg border border-[#e6e6e6] bg-white">
                    {#if comment.avatar}
                      <img class="w-8 h-8 rounded-full shrink-0 mt-0.5" src={getAvatarUrl(comment.avatar)} alt={comment.author} />
                    {:else}
                      <div class="w-8 h-8 rounded-full shrink-0 mt-0.5 bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">{(comment.author || 'A').charAt(0).toUpperCase()}</div>
                    {/if}
                    <div class="flex flex-col gap-1 flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-medium text-gray-900">{comment.author}</span>
                      <span class="text-[10px] text-gray-400">{new Date(comment.timestamp).toLocaleDateString()} {new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {#if editingCommentIndex === i}
                      <div class="flex flex-col gap-2 mt-1">
                        <textarea
                          class="w-full px-2 py-1.5 border border-[#e6e6e6] rounded-lg text-sm text-gray-900 outline-none focus:border-gray-900 resize-none"
                          rows="2"
                          bind:value={editCommentText}
                          on:keydown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEditComment(); }}
                        ></textarea>
                        <div class="flex gap-2 justify-end">
                          <button class="px-2 py-1 text-xs rounded border border-[#e6e6e6] bg-white text-gray-700 hover:bg-gray-50" on:click={cancelEditComment}>Cancel</button>
                          <button class="px-2 py-1 text-xs rounded border border-gray-900 bg-gray-900 text-white hover:bg-gray-800" on:click={saveEditComment}>Save</button>
                        </div>
                      </div>
                    {:else}
                      <p class="text-sm text-gray-700 whitespace-pre-wrap">{comment.text}</p>
                      <div class="flex gap-2 mt-1">
                        <button class="p-0 bg-transparent border-none text-gray-400 hover:text-gray-700 text-xs" on:click={() => startEditComment(i)}>Edit</button>
                        <button class="p-0 bg-transparent border-none text-gray-400 hover:text-red-500 text-xs" on:click={() => deleteComment(i)}>Delete</button>
                      </div>
                    {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="text-xs text-gray-400">No comments yet.</p>
            {/if}
            <div class="flex flex-col gap-2">
              <textarea
                class="w-full px-3 py-2 border border-[#e6e6e6] rounded-lg text-sm text-gray-900 outline-none focus:border-gray-900 resize-none"
                rows="3"
                bind:value={newComment}
                placeholder="Write a comment..."
                on:keydown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addComment(); }}
              ></textarea>
              <div class="flex justify-end">
                <button class="px-3 py-1.5 rounded-lg border border-[#e6e6e6] bg-white text-sm font-medium text-gray-900 hover:bg-gray-50" on:click={addComment}>Add comment</button>
              </div>
            </div>
          </div>

        {:else if activeTab === 'pomodoro'}
          <div class="flex flex-col items-center gap-6 py-4">
            <div class="text-center">
              <span class="text-xs font-medium uppercase tracking-wide {pomodoroMode === 'work' ? 'text-gray-900' : 'text-emerald-600'}">
                {pomodoroMode === 'work' ? 'Focus time' : 'Break'}
              </span>
            </div>

            <div class="relative flex items-center justify-center w-48 h-48">
              <svg class="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#e6e6e6" stroke-width="4" />
                <circle
                  cx="50" cy="50" r="45" fill="none"
                  stroke={pomodoroMode === 'work' ? '#111827' : '#10b981'}
                  stroke-width="4"
                  stroke-linecap="round"
                  stroke-dasharray={2 * Math.PI * 45}
                  stroke-dashoffset={2 * Math.PI * 45 * (1 - pomodoroSeconds / ((pomodoroMode === 'work' ? pomodoroMinutes : breakMinutes) * 60))}
                  class="transition-all duration-1000 ease-linear"
                />
              </svg>
              <span class="text-4xl font-bold text-gray-900 tabular-nums">{formatTime(pomodoroSeconds)}</span>
            </div>

            <div class="flex items-center gap-3">
              {#if pomodoroRunning}
                <button
                  class="flex items-center justify-center w-12 h-12 rounded-full border border-[#e6e6e6] bg-white text-gray-900 hover:bg-gray-50 transition"
                  on:click={pausePomodoro}
                  aria-label="Pause"
                >
                  <Pause size={20} weight="bold" />
                </button>
              {:else}
                <button
                  class="flex items-center justify-center w-12 h-12 rounded-full border border-gray-900 bg-gray-900 text-white hover:bg-gray-800 transition"
                  on:click={startPomodoro}
                  aria-label="Start"
                >
                  <Play size={20} weight="bold" />
                </button>
              {/if}
              <button
                class="flex items-center justify-center w-10 h-10 rounded-full border border-[#e6e6e6] bg-white text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition"
                on:click={resetPomodoro}
                aria-label="Reset"
              >
                <ArrowCounterClockwise size={16} weight="bold" />
              </button>
            </div>

            <div class="flex items-center gap-4 text-xs text-gray-500">
              <div class="flex items-center gap-1.5">
                <label for="pomo-work">Work</label>
                <input id="pomo-work" type="number" min="1" max="60" class="w-12 px-1.5 py-1 border border-[#e6e6e6] rounded text-center text-xs text-gray-900 outline-none focus:border-gray-900" bind:value={pomodoroMinutes} on:change={() => { if (!pomodoroRunning && pomodoroMode === 'work') pomodoroSeconds = pomodoroMinutes * 60; }} />
                <span>min</span>
              </div>
              <div class="flex items-center gap-1.5">
                <label for="pomo-break">Break</label>
                <input id="pomo-break" type="number" min="1" max="30" class="w-12 px-1.5 py-1 border border-[#e6e6e6] rounded text-center text-xs text-gray-900 outline-none focus:border-gray-900" bind:value={breakMinutes} on:change={() => { if (!pomodoroRunning && pomodoroMode === 'break') pomodoroSeconds = breakMinutes * 60; }} />
                <span>min</span>
              </div>
            </div>

            {#if pomodoroCount > 0}
              <p class="text-xs text-gray-500">{pomodoroCount} session{pomodoroCount > 1 ? 's' : ''} completed</p>
            {/if}

            {#if typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default'}
              <button
                class="text-xs text-gray-500 hover:text-gray-900 underline bg-transparent border-none p-0"
                on:click={requestNotificationPermission}
              >Enable notifications</button>
            {:else if typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'}
              <span class="text-[10px] text-gray-400">Notifications enabled</span>
            {/if}
          </div>
        {/if}
      </div>

      <div class="flex items-center justify-between px-5 py-4 border-t border-[#e6e6e6] shrink-0">
        <button class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-transparent text-sm font-medium text-red-600 hover:bg-red-50" on:click={deleteDetail}>
          <Trash size={14} weight="bold" />
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

{#if showDeleteConfirm}
  <Modal title="Delete card" on:close={cancelDelete}>
    <p class="text-sm text-gray-700 mb-4">Are you sure you want to delete this card? This action cannot be undone.</p>
    <div class="flex gap-2 justify-end">
      <button class="secondary" on:click={cancelDelete}>Cancel</button>
      <button class="inline-flex items-center gap-1.5 bg-red-600 text-white hover:bg-red-700" on:click={confirmDelete}>
        <Trash size={14} weight="bold" />
        Delete
      </button>
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

{#if attachmentModalOpen}
  <Modal title={editingAttachmentIndex >= 0 ? 'Edit attachment' : 'Add attachment'} on:close={closeAttachmentModal}>
    <div class="space-y-3">
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide" for="attachment-url">File URL</label>
        <input
          id="attachment-url"
          class="w-full px-3 py-1.5 border border-[#e6e6e6] rounded-lg text-sm text-gray-900 outline-none focus:border-gray-900"
          bind:value={attachmentUrl}
          placeholder="https://example.com/file.pdf"
          on:keydown={(e) => e.key === 'Enter' && saveAttachment()}
        />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide" for="attachment-name">Name</label>
        <input
          id="attachment-name"
          class="w-full px-3 py-1.5 border border-[#e6e6e6] rounded-lg text-sm text-gray-900 outline-none focus:border-gray-900"
          bind:value={attachmentName}
          placeholder="File name"
          on:keydown={(e) => e.key === 'Enter' && saveAttachment()}
        />
      </div>
      <div class="flex gap-2 justify-end">
        <button class="secondary" on:click={closeAttachmentModal}>Cancel</button>
        <button on:click={saveAttachment}>{editingAttachmentIndex >= 0 ? 'Save' : 'Add'}</button>
      </div>
    </div>
  </Modal>
{/if}
