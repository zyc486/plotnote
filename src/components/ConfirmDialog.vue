<script setup>
import { watch } from 'vue'

const props = defineProps({
  visible: Boolean,
  title: { type: String, default: '确认操作' },
  message: { type: String, default: '确定要执行此操作吗？' },
  confirmText: { type: String, default: '确定' },
  cancelText: { type: String, default: '取消' },
  danger: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'cancel'])

function onConfirm() {
  emit('confirm')
}

function onCancel() {
  emit('cancel')
}

function onKeydown(e) {
  if (e.key === 'Escape') onCancel()
}

watch(() => props.visible, (val) => {
  if (val) {
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('keydown', onKeydown)
  }
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]" @click.self="onCancel" role="dialog" aria-modal="true" :aria-label="title">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm mx-4 border border-gray-200 dark:border-gray-700 shadow-xl">
        <h3 class="text-lg font-medium mb-2">{{ title }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">{{ message }}</p>
        <div class="flex gap-3 justify-end">
          <button @click="onCancel" class="px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition">{{ cancelText }}</button>
          <button @click="onConfirm" class="px-4 py-2 rounded-lg text-sm font-medium transition" :class="danger ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-gray-800 hover:bg-gray-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500'">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
