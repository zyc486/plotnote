<script setup>
import { formatDate } from '../utils/helpers'

defineProps({
  records: { type: Array, default: () => [] },
  currentRecordId: Number,
  activeRecordId: Number,
})

const emit = defineEmits(['create', 'switch', 'delete'])
</script>

<template>
  <div class="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200/60 dark:border-zinc-800">
    <div class="flex items-center justify-between mb-3">
      <p class="text-[11px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-medium">多刷记录</p>
      <button @click="emit('create')" class="text-xs text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300 transition-colors font-medium">+ 新建</button>
    </div>
    <div v-if="records.length > 0" class="space-y-1.5">
      <div
        v-for="(record, index) in records" :key="record.id"
        @click="record.id !== currentRecordId && emit('switch', record.id)"
        class="group rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-200"
        :class="record.id === currentRecordId ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-transparent'"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xs font-medium text-zinc-700 dark:text-zinc-300">第{{ records.length - index }}次</span>
            <span v-if="record.id === activeRecordId" class="text-[10px] bg-amber-400/20 text-amber-600 dark:text-amber-400 px-1.5 py-px rounded-full font-medium">主</span>
          </div>
          <span v-if="record.rating > 0" class="text-sm font-bold text-amber-500">{{ Number(record.rating).toFixed(1) }}</span>
          <span v-else class="text-xs text-zinc-300 dark:text-zinc-600">—</span>
        </div>
        <div class="flex items-center justify-between mt-1">
          <span class="text-[10px] text-zinc-400 dark:text-zinc-500">{{ record.watchedDate || formatDate(record.createdAt) }}</span>
          <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              v-if="record.id !== currentRecordId"
              @click.stop="emit('delete', record.id)"
              class="text-[10px] text-red-400 hover:text-red-500 px-1 transition-colors"
            >删除</button>
          </div>
        </div>
      </div>
    </div>
    <p v-else class="text-xs text-zinc-400 dark:text-zinc-500 text-center py-4">评分后自动创建</p>
  </div>
</template>
