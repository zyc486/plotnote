<script setup>
import { ref, onUnmounted } from 'vue'

const visible = ref(false)
const milestone = ref(null)
const dismissing = ref(false)

function show(m) {
  milestone.value = m
  visible.value = true
  dismissing.value = false
}

function close() {
  dismissing.value = true
  setTimeout(() => {
    visible.value = false
    milestone.value = null
    dismissing.value = false
  }, 300)
}

function onKeydown(e) {
  if (e.key === 'Escape') close()
}

defineExpose({ show })
</script>

<template>
  <Teleport to="body">
    <Transition name="milestone">
      <div v-if="visible" class="fixed inset-0 bg-black/70 flex items-center justify-center z-[70]" @click.self="close" @keydown="onKeydown" role="dialog" aria-modal="true" aria-label="里程碑">
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-8 w-full max-w-sm mx-4 border border-gray-200 dark:border-gray-700 shadow-2xl text-center" :class="{ 'milestone-dismiss': dismissing }">
          <div class="text-6xl mb-4">🎉</div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{{ milestone?.label }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">{{ milestone?.message }}</p>
          <button
            @click="close"
            class="px-6 py-2.5 rounded-xl text-sm font-medium transition bg-gray-800 hover:bg-gray-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500"
          >
            继续加油
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.milestone-enter-active {
  transition: opacity 0.3s ease;
}
.milestone-leave-active {
  transition: opacity 0.3s ease;
}
.milestone-enter-from,
.milestone-leave-to {
  opacity: 0;
}
.milestone-enter-active .bg-white,
.milestone-enter-active .dark\:bg-gray-800 {
  animation: milestone-pop 0.4s ease-out;
}
.milestone-dismiss {
  animation: milestone-fade 0.3s ease-in forwards;
}

@keyframes milestone-pop {
  0% { transform: scale(0.8); opacity: 0; }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes milestone-fade {
  to { transform: scale(0.95); opacity: 0; }
}
</style>
