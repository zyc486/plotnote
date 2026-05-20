<script setup>
import { ref } from 'vue'

const toasts = ref([])
let toastId = 0

function show(message, type = 'success', durationOrCallback = 2500, undoCallback = null) {
  const id = ++toastId
  let duration = 2500
  let onUndo = null

  if (typeof durationOrCallback === 'function') {
    onUndo = durationOrCallback
    duration = 5000
  } else if (undoCallback) {
    onUndo = undoCallback
    duration = 5000
  }

  toasts.value.push({ id, message, type, onUndo })
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }, duration)
}

function handleUndo(toast) {
  toast.onUndo?.()
  toasts.value = toasts.value.filter(t => t.id !== toast.id)
}

defineExpose({ show })
</script>

<template>
  <div class="fixed top-4 right-4 z-50 space-y-2">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium shadow-lg transform transition-all duration-300"
      :class="{
        'bg-emerald-600 text-emerald-100': toast.type === 'success',
        'bg-amber-600 text-amber-100': toast.type === 'warning',
        'bg-red-600 text-red-100': toast.type === 'error',
        'bg-indigo-600 text-indigo-100': toast.type === 'info',
      }"
    >
      <span>{{ toast.message }}</span>
      <button
        v-if="toast.onUndo"
        @click="handleUndo(toast)"
        class="text-white/90 hover:text-white font-semibold text-xs underline underline-offset-2 whitespace-nowrap"
      >撤销</button>
    </div>
  </div>
</template>
