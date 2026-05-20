<script setup>
const props = defineProps({
  episodes: { type: Array, default: () => [] },
  currentEpisodeId: Number,
  episodeScores: { type: Object, default: () => ({}) },
  availableSeasons: { type: Array, default: () => [] },
  seasonLabel: { type: String, default: '季' },
})

const rightSeason = defineModel('season', { type: Number, default: 0 })
const emit = defineEmits(['select'])

const filteredEpisodes = computed(() => {
  if (rightSeason.value === 0) return props.episodes
  return props.episodes.filter(e => e.season === rightSeason.value)
})

import { computed } from 'vue'
</script>

<template>
  <div class="flex flex-col h-full">
    <div v-if="availableSeasons.length > 1" class="flex gap-1 px-3 py-2 flex-shrink-0 overflow-x-auto border-b border-zinc-100 dark:border-zinc-800/50">
      <button
        v-for="s in availableSeasons" :key="s"
        @click="rightSeason = s"
        class="px-2.5 py-1 text-[11px] rounded-lg font-medium transition-colors whitespace-nowrap flex-shrink-0"
        :class="rightSeason === s ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:text-zinc-500'"
      >第{{ s }}{{ seasonLabel || '季' }}</button>
    </div>

    <div class="flex-1 overflow-y-auto p-3">
      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="ep in filteredEpisodes" :key="ep.id"
          :id="`ep-nav-${ep.id}`"
          @click="emit('select', ep)"
          class="relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all duration-200 active:scale-95"
          :class="ep.id === currentEpisodeId
            ? 'bg-amber-100 dark:bg-amber-900/30 ring-2 ring-amber-400 dark:ring-amber-500 shadow-sm'
            : episodeScores[ep.id]?.rating > 0
              ? 'bg-amber-50/50 dark:bg-amber-900/10 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              : 'bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800'"
        >
          <span
            class="text-sm font-semibold tabular-nums"
            :class="ep.id === currentEpisodeId ? 'text-amber-700 dark:text-amber-400' : episodeScores[ep.id]?.rating > 0 ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400 dark:text-zinc-500'"
          >{{ String(ep.episode).padStart(2, '0') }}</span>
          <span
            v-if="episodeScores[ep.id]?.rating > 0"
            class="text-[10px] font-bold text-amber-500 mt-0.5 tabular-nums leading-none"
          >{{ Number(episodeScores[ep.id].rating).toFixed(1) }}</span>
          <div
            v-if="episodeScores[ep.id]?.count > 1"
            class="absolute top-1 right-1.5 text-[9px] text-zinc-400 dark:text-zinc-500 font-medium"
          >×{{ episodeScores[ep.id].count }}</div>
        </button>
      </div>
    </div>
  </div>
</template>
