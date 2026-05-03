<script setup>
import { ref, computed } from 'vue'
import { compressImage, generateImageId } from '../utils/imageUtils'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
  maxImages: {
    type: Number,
    default: 30,
  },
})

const emit = defineEmits(['update:modelValue'])

const images = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const draggingIndex = ref(null)
const dragOverIndex = ref(null)
const showHint = ref(false)

async function handleFileSelect(event) {
  const files = Array.from(event.target.files)
  await processFiles(files)
  event.target.value = ''
}

async function handlePaste(event) {
  const items = Array.from(event.clipboardData.items)
  const imageFiles = items
    .filter(item => item.type.startsWith('image/'))
    .map(item => item.getAsFile())
    .filter(Boolean)

  if (imageFiles.length) {
    await processFiles(imageFiles)
  }
}

async function processFiles(files) {
  if (images.value.length >= props.maxImages) {
    showHint.value = true
    setTimeout(() => showHint.value = false, 3000)
    return
  }

  const remaining = props.maxImages - images.value.length
  const toProcess = files.slice(0, remaining)

  for (const file of toProcess) {
    const compressed = await compressImage(file)
    images.value = [...images.value, {
      id: generateImageId(),
      src: compressed,
      note: '',
    }]
  }
}

function removeImage(index) {
  const newImages = [...images.value]
  newImages.splice(index, 1)
  images.value = newImages
}

function updateNote(index, note) {
  const newImages = [...images.value]
  newImages[index] = { ...newImages[index], note }
  images.value = newImages
}

function onDragStart(index) {
  draggingIndex.value = index
}

function onDragOver(index) {
  dragOverIndex.value = index
}

function onDrop(index) {
  if (draggingIndex.value === null || draggingIndex.value === index) return
  const newImages = [...images.value]
  const [dragged] = newImages.splice(draggingIndex.value, 1)
  newImages.splice(index, 0, dragged)
  images.value = newImages
  draggingIndex.value = null
  dragOverIndex.value = null
}

function onDragEnd() {
  draggingIndex.value = null
  dragOverIndex.value = null
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <label class="block text-sm text-gray-500 dark:text-gray-400">图片（拖拽排序）</label>
      <span class="text-xs text-gray-400 dark:text-gray-500">{{ images.length }} / {{ maxImages }}</span>
    </div>

    <div
      v-if="showHint"
      class="text-xs text-amber-400 bg-amber-400/10 px-3 py-2 rounded-lg"
    >
      图片数量已达上限（{{ maxImages }}张），超出部分已忽略
    </div>

    <div
      class="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-4 text-center cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition"
      @click="$refs.fileInput.click()"
      @paste.prevent="handlePaste"
    >
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        @change="handleFileSelect"
      />
      <p class="text-gray-500 dark:text-gray-400 text-sm">点击上传 / 粘贴图片</p>
      <p class="text-gray-400 dark:text-gray-600 text-xs mt-1">支持拖拽排序，单图可添加备注</p>
    </div>

    <div v-if="images.length > 0" class="grid grid-cols-3 gap-2">
      <div
        v-for="(img, index) in images"
        :key="img.id"
        class="relative group"
        draggable="true"
        @dragstart="onDragStart(index)"
        @dragover.prevent="onDragOver(index)"
        @drop="onDrop(index)"
        @dragend="onDragEnd"
        :class="{ 'opacity-50': draggingIndex === index, 'ring-2 ring-indigo-500': dragOverIndex === index }"
      >
        <img
          :src="img.src"
          class="w-full aspect-square object-cover rounded-lg cursor-grab"
          loading="lazy"
        />
        <button
          @click="removeImage(index)"
          class="absolute top-1 right-1 bg-black/70 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition"
        >
          ×
        </button>
        <input
          type="text"
          :value="img.note"
          @input="updateNote(index, $event.target.value)"
          placeholder="备注..."
          class="w-full mt-1 text-xs bg-gray-200 dark:bg-gray-700 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
    </div>
  </div>
</template>
