<script setup>
import { SHOW_STATUSES } from '../constants'

defineProps({
  showId: Number,
  status: String,
  isOpen: Boolean,
})

const emit = defineEmits(['toggle', 'change'])
</script>

<template>
  <div class="absolute top-1.5 right-1.5 cursor-pointer" @click.stop="emit('toggle', showId, $event)">
    <span class="inline-block w-2.5 h-2.5 rounded-full" :class="{
      'bg-blue-500': status === 'want',
      'bg-green-500': status === 'watching',
      'bg-gray-400': status === 'finished',
      'bg-red-500': status === 'dropped',
    }"></span>
    <div
      v-if="isOpen"
      class="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20 min-w-[90px]"
      @click.stop
    >
      <button
        v-for="st in SHOW_STATUSES"
        :key="st.key"
        @click="emit('change', showId, st.key, $event)"
        class="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        :class="status === st.key ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-gray-300'"
      >{{ st.label }}</button>
    </div>
  </div>
</template>
