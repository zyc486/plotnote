<script setup>
const rating = defineModel('rating', { type: Number, default: 0 })
const props = defineProps({ animation: Boolean })
</script>

<template>
  <div class="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200/60 dark:border-zinc-800">
    <div class="text-center mb-4">
      <span
        class="inline-block text-5xl font-bold tracking-tight transition-all duration-300"
        :class="rating > 0 ? 'text-amber-500' : 'text-zinc-300 dark:text-zinc-600'"
        :style="{ transform: animation ? 'scale(1.15)' : 'scale(1)' }"
      >{{ Number(rating).toFixed(1) }}</span>
      <p class="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">/ 10</p>
    </div>

    <div class="flex justify-center gap-1 mb-4">
      <button
        v-for="star in 5" :key="star"
        @click="rating = star * 2"
        class="text-2xl transition-all duration-150 hover:scale-110"
        :class="rating >= star * 2 ? 'text-amber-400' : 'text-zinc-200 dark:text-zinc-700'"
      >★</button>
    </div>

    <div class="relative">
      <input
        v-model.number="rating"
        type="range" min="0" max="10" step="0.1"
        class="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        :class="rating > 0 ? 'accent-amber-400' : 'accent-zinc-300 dark:accent-zinc-600'"
      />
    </div>

    <div class="flex items-center justify-between gap-1 mt-3">
      <button
        v-for="n in [0,2,4,6,8,10]" :key="n"
        @click="rating = n"
        class="w-8 h-6 rounded-md text-[10px] font-medium transition-colors"
        :class="rating === n ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:text-zinc-500'"
      >{{ n }}</button>
      <input
        :value="rating"
        @input="rating = Number($event.target.value)"
        type="number" min="0" max="10" step="0.1"
        class="w-14 text-center bg-transparent text-sm font-bold outline-none border-b-2 transition-colors"
        :class="rating > 0 ? 'text-amber-500 border-amber-300' : 'text-zinc-400 border-zinc-200 dark:border-zinc-700'"
      />
    </div>
  </div>
</template>
