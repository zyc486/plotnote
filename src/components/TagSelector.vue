<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTagsStore } from '../stores/tags'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:modelValue'])

const tagsStore = useTagsStore()

const selectedTags = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const customInput = ref('')
const showCustomInput = ref(false)
const searchResults = ref([])
const searchQuery = ref('')

onMounted(() => {
  tagsStore.initTags()
})

function isSelected(tagName) {
  return selectedTags.value.includes(tagName)
}

async function toggleTag(tag) {
  if (isSelected(tag.name)) {
    selectedTags.value = selectedTags.value.filter(t => t !== tag.name)
    if (tag.id) await tagsStore.decrementUsage(tag.id)
  } else {
    if (selectedTags.value.length >= 20) return
    selectedTags.value = [...selectedTags.value, tag.name]
    if (tag.id) await tagsStore.incrementUsage(tag.id)
  }
}

async function addCustomTag() {
  const name = customInput.value.trim()
  if (!name) return
  if (selectedTags.value.includes(name)) {
    customInput.value = ''
    return
  }
  if (selectedTags.value.length >= 20) return

  const tag = await tagsStore.addCustomTag(name)
  if (tag) {
    selectedTags.value = [...selectedTags.value, name]
    await tagsStore.incrementUsage(tag.id)
  }
  customInput.value = ''
  showCustomInput.value = false
}

async function removeTag(tagName) {
  selectedTags.value = selectedTags.value.filter(t => t !== tagName)
  const tag = tagsStore.tags.find(t => t.name === tagName)
  if (tag) await tagsStore.decrementUsage(tag.id)
}

async function handleSearch(query) {
  searchQuery.value = query
  if (query.trim()) {
    searchResults.value = await tagsStore.searchTags(query)
  } else {
    searchResults.value = []
  }
}

const predefinedTags = computed(() => tagsStore.tags.filter(t => t.isPredefined))
const customTags = computed(() => tagsStore.tags.filter(t => !t.isPredefined))
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <label class="block text-sm text-gray-500 dark:text-gray-400">标签</label>
      <span class="text-xs text-gray-400 dark:text-gray-500">{{ selectedTags.length }} / 20</span>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="tag in selectedTags"
        :key="tag"
        @click="removeTag(tag)"
        class="px-3 py-1 bg-indigo-100 text-indigo-600 dark:bg-indigo-600/30 dark:text-indigo-300 rounded-full text-sm flex items-center gap-1 hover:bg-indigo-200 dark:hover:bg-indigo-600/50 transition"
      >
        {{ tag }}
        <span class="text-xs">×</span>
      </button>
    </div>

    <div v-if="searchQuery || showCustomInput" class="space-y-2">
      <input
        v-if="showCustomInput"
        v-model="customInput"
        type="text"
        placeholder="输入自定义标签..."
        class="w-full bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        @keyup.enter="addCustomTag"
        autofocus
      />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索标签..."
        class="w-full bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        @input="handleSearch(searchQuery)"
      />
      <div v-if="searchResults.length > 0" class="flex flex-wrap gap-1">
        <button
          v-for="tag in searchResults"
          :key="tag.id"
          @click="toggleTag(tag)"
          class="px-2 py-1 rounded-full text-xs transition"
          :class="isSelected(tag.name) ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-600/50 dark:text-indigo-300' : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'"
        >
          {{ tag.name }}
        </button>
      </div>
    </div>

    <div class="space-y-2">
      <div class="text-xs text-gray-400 dark:text-gray-500">推荐标签</div>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="tag in predefinedTags"
          :key="tag.id"
          @click="toggleTag(tag)"
          class="px-2 py-1 rounded-full text-xs transition"
          :class="isSelected(tag.name) ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-600/50 dark:text-indigo-300' : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'"
        >
          {{ tag.name }}
        </button>
      </div>
      <div v-if="customTags.length > 0" class="flex flex-wrap gap-1 mt-2">
        <button
          v-for="tag in customTags"
          :key="tag.id"
          @click="toggleTag(tag)"
          class="px-2 py-1 rounded-full text-xs transition"
          :class="isSelected(tag.name) ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-600/50 dark:text-indigo-300' : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'"
        >
          {{ tag.name }}
        </button>
      </div>
    </div>

    <button
      v-if="!showCustomInput"
      @click="showCustomInput = true"
      class="text-xs text-indigo-500 hover:text-indigo-400 dark:text-indigo-400 dark:hover:text-indigo-300 transition"
    >
      + 添加自定义标签
    </button>
  </div>
</template>
