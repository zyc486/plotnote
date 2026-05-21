<script setup>
import { computed } from 'vue'
import { progressLabel } from '../utils/terminology'
import StatusDropdown from './StatusDropdown.vue'

const props = defineProps({
  show: Object,
  statusDropdownId: Number,
  selectable: Boolean,
  selected: Boolean,
})

const emit = defineEmits(['goTo', 'edit', 'delete', 'toggleStatus', 'changeStatus', 'toggleSelect'])

const progress = computed(() => progressLabel(props.show))
</script>

<template>
  <div @click="selectable ? emit('toggleSelect', show.id) : emit('goTo', show.id)" class="group cursor-pointer">
    <div class="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800 mb-2">
      <div v-if="selectable" class="absolute top-1.5 right-1.5 z-10">
        <div class="w-6 h-6 rounded border-2 flex items-center justify-center transition" :class="selected ? 'bg-indigo-500 border-indigo-500' : 'bg-white/80 border-gray-400 dark:bg-gray-800/80'">
          <svg v-if="selected" class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
        </div>
      </div>
      <img
        v-if="show.coverImage"
        :src="show.coverImage"
        :alt="show.name"
        class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
        @error="$event.target.style.display = 'none'"
      />
      <div v-else class="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center p-2">
        <span class="text-gray-500 dark:text-gray-400 font-medium text-center text-xs leading-tight line-clamp-3">{{ show.name }}</span>
      </div>
      <div v-if="show.avgRating > 0" class="absolute top-1.5 left-1.5 bg-black/75 backdrop-blur-sm text-amber-400 text-xs font-bold px-1.5 py-0.5 rounded">
        {{ show.avgRating }}
      </div>
      <StatusDropdown
        v-if="show.status"
        :show-id="show.id"
        :status="show.status"
        :is-open="statusDropdownId === show.id"
        @toggle="emit('toggleStatus', $event)"
        @change="emit('changeStatus', $event)"
      />
      <div @click.stop class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
        <div class="flex justify-end gap-1.5">
          <button @click.stop="emit('edit', show, $event)" class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 text-white text-xs flex items-center justify-center transition">编辑</button>
          <button @click.stop="emit('delete', show.id, $event)" class="w-8 h-8 rounded-full bg-red-500/60 hover:bg-red-500/80 text-white text-xs flex items-center justify-center transition">删</button>
        </div>
      </div>
    </div>
    <h3 class="text-xs md:text-sm font-medium text-gray-900 dark:text-gray-100 truncate leading-tight">{{ show.name }}</h3>
    <p class="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{{ progress }}</p>
  </div>
</template>
