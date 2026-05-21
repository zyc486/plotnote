<script setup>
defineProps({
  prevEpisode: Object,
  nextEpisode: Object,
  currentEpisode: Object,
  epTerm: { type: String, default: '集' },
})

const emit = defineEmits(['jump'])
</script>

<template>
  <footer class="flex-shrink-0 border-t border-zinc-200/60 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md px-4 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
    <div class="flex items-center justify-center gap-6">
      <button
        :disabled="!prevEpisode"
        @click="emit('jump', prevEpisode)"
        class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
        :class="prevEpisode ? 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95' : 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed'"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        上一{{ epTerm }}
      </button>

      <span class="text-xs text-zinc-300 dark:text-zinc-600 select-none">第 {{ currentEpisode?.episode }} {{ epTerm }}</span>

      <button
        :disabled="!nextEpisode"
        @click="emit('jump', nextEpisode)"
        class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
        :class="nextEpisode ? 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95' : 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed'"
      >
        下一{{ epTerm }}
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
      </button>
    </div>
  </footer>
</template>
