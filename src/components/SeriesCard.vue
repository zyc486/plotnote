<script setup>
defineProps({
  seriesId: Number,
  seriesName: String,
  coverImage: String,
  showCount: Number,
  avgRating: [String, Number],
  isExpanded: Boolean,
})

const emit = defineEmits(['toggle'])
</script>

<template>
  <div @click="emit('toggle', seriesId)" class="group cursor-pointer">
    <div class="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800 mb-2">
      <img
        v-if="coverImage"
        :src="coverImage"
        :alt="seriesName"
        class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
        @error="$event.target.style.display = 'none'"
      />
      <div v-else class="w-full h-full bg-gradient-to-br from-indigo-200 to-indigo-400 dark:from-indigo-800 dark:to-indigo-900 flex items-center justify-center p-2">
        <span class="text-indigo-700 dark:text-indigo-200 font-medium text-center text-xs leading-tight line-clamp-3">{{ seriesName }}</span>
      </div>
      <div class="absolute top-1.5 left-1.5 bg-indigo-600/90 backdrop-blur-sm text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
        系列 · {{ showCount }}部
      </div>
      <div v-if="avgRating > 0" class="absolute top-1.5 right-1.5 bg-black/75 backdrop-blur-sm text-amber-400 text-xs font-bold px-1.5 py-0.5 rounded">
        {{ avgRating }}
      </div>
      <div class="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center transition-transform duration-200" :class="{ 'rotate-90': isExpanded }">
        <span class="text-white text-xs">▶</span>
      </div>
    </div>
    <h3 class="text-xs md:text-sm font-medium text-gray-900 dark:text-gray-100 truncate leading-tight">{{ seriesName }}</h3>
    <p class="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 mt-0.5">系列 · {{ showCount }}部</p>
  </div>
</template>
