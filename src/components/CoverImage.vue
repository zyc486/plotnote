<script setup>
import { ref, watch, computed } from 'vue'

const props = defineProps({
  src: { type: String, default: '' },
  name: { type: String, default: '' },
  size: { type: String, default: 'md' },
  category: { type: String, default: '' },
  clickable: { type: Boolean, default: false },
})

const emit = defineEmits(['click', 'imageError'])

const errored = ref(false)
const loading = ref(true)

const sizeClasses = computed(() => ({
  sm: 'w-10 h-14 rounded text-[10px]',
  md: 'w-16 h-[88px] rounded-lg text-xs',
  lg: 'w-24 h-[136px] rounded-xl text-sm',
  xl: 'w-32 h-[180px] md:w-36 md:h-[200px] rounded-xl text-sm',
}[props.size] || 'w-16 h-[88px] rounded-lg text-xs'))

const placeholderClass = computed(() => ({
  sm: 'bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800',
  md: 'bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800',
  lg: 'bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800',
}[props.size] || 'bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800'))

const isGame = computed(() => props.category === 'game')

watch(() => props.src, () => {
  errored.value = false
  loading.value = true
})

function onLoad() {
  loading.value = false
}

function onError() {
  errored.value = true
  loading.value = false
  emit('imageError')
}

function onClick() {
  if (props.clickable) emit('click')
}
</script>

<template>
  <div
    :class="[sizeClasses, 'flex-shrink-0 overflow-hidden relative', clickable ? 'cursor-pointer hover:opacity-80 transition' : '']"
    @click="onClick"
  >
    <!-- Loading shimmer -->
    <div v-if="loading && src && !errored" class="absolute inset-0 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-[inherit]" />

    <!-- Image -->
    <img
      v-if="src && !errored"
      :src="src"
      class="w-full h-full transition-opacity duration-300"
      :class="[isGame ? 'object-contain' : 'object-cover', loading ? 'opacity-0' : 'opacity-100']"
      @load="onLoad"
      @error="onError"
      loading="lazy"
    />

    <!-- Fallback placeholder -->
    <div
      v-if="errored || !src"
      class="absolute inset-0 flex items-center justify-center p-1"
      :class="placeholderClass"
    >
      <span class="text-gray-500 dark:text-gray-400 font-medium text-center leading-tight line-clamp-3 break-all">
        {{ name?.charAt(0) || '?' }}
      </span>
    </div>
  </div>
</template>
