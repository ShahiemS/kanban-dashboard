<script>
  import { fade } from 'svelte/transition';

  export let label = 'Loading…';
</script>

<div class="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500" transition:fade={{ duration: 150 }}>
  <div class="w-8 h-8 border-2 border-[#e6e6e6] border-t-gray-900 rounded-full animate-spin"></div>
  <span class="text-sm font-medium">{label}</span>
</div>
