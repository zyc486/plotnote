<script setup>
defineProps({ ratings: Object })
</script>

<template>
  <div v-if="ratings" class="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200/60 dark:border-zinc-800 space-y-2">
    <p class="text-[11px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-medium">外部评分</p>
    <div v-if="ratings.imdbRating" class="flex items-center justify-between text-sm">
      <span class="text-zinc-600 dark:text-zinc-400">IMDb</span>
      <span class="font-semibold text-yellow-600 dark:text-yellow-500">{{ ratings.imdbRating }}/10</span>
    </div>
    <div v-if="ratings.rtRating" class="flex items-center justify-between text-sm">
      <span class="text-zinc-600 dark:text-zinc-400">烂番茄</span>
      <span class="font-semibold text-red-500">{{ ratings.rtRating }}</span>
    </div>
    <div v-if="ratings.metacritic" class="flex items-center justify-between text-sm">
      <span class="text-zinc-600 dark:text-zinc-400">Metacritic</span>
      <span class="font-semibold text-blue-500">{{ ratings.metacritic }}</span>
    </div>
  </div>
</template>
