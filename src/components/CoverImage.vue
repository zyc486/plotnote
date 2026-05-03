<script setup>
import { ref, watch, computed } from 'vue'

const props = defineProps({
  src: { type: String, default: '' },
  name: { type: String, default: '' },
  size: { type: String, default: 'md' },
  clickable: { type: Boolean, default: false },
})

const emit = defineEmits(['click', 'imageError'])

const imgError = ref(false)
const imgLoaded = ref(false)

const sizeClasses = computed(() => ({
  sm: 'w-10 h-14 rounded text-[10px]',
  md: 'w-16 h-[88px] rounded-lg text-xs',
  lg: 'w-24 h-[136px] rounded-xl text-sm',
}[props.size] || 'w-16 h-[88px] rounded-lg text-xs'))

const showImage = computed(() => props.src && !imgError.value)

watch(() => props.src, () => {
  imgError.value = false
  imgLoaded.value = false
})

function onImgError() {
  imgError.value = true
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
    <img
      v-if="showImage"
      :src="src"
      class="w-full h-full object-cover bg-gray-200 dark:bg-gray-700"
      @error="onImgError"
    />
    <div
      v-else
      class="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center p-1"
    >
      <span class="text-gray-500 dark:text-gray-400 font-medium text-center leading-tight line-clamp-3 break-all">
        {{ name || '?' }}
      </span>
    </div>
  </div>
</template>
