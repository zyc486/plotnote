<script setup>
import { ref } from 'vue'

const toasts = ref([])
let toastId = 0

function show(message, type = 'success', duration = 2500) {
  const id = ++toastId
  toasts.value.push({ id, message, type })
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }, duration)
}

defineExpose({ show })
</script>

<template>
  <div class="fixed top-4 right-4 z-50 space-y-2">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="px-4 py-3 rounded-xl text-sm font-medium shadow-lg transform transition-all duration-300"
      :class="{
        'bg-emerald-600 text-emerald-100': toast.type === 'success',
        'bg-amber-600 text-amber-100': toast.type === 'warning',
        'bg-red-600 text-red-100': toast.type === 'error',
        'bg-indigo-600 text-indigo-100': toast.type === 'info',
      }"
    >
      {{ toast.message }}
    </div>
  </div>
</template>
