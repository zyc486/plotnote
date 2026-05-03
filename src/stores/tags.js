import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, PREDEFINED_TAGS } from '../db'

export const useTagsStore = defineStore('tags', () => {
  const tags = ref([])
  const MAX_CUSTOM_TAGS = 20

  async function initTags() {
    const existing = await db.tags.toArray()
    if (existing.length === 0) {
      for (const name of PREDEFINED_TAGS) {
        await db.tags.add({ name, isPredefined: true, usageCount: 0 })
      }
    }
    await fetchTags()
  }

  async function fetchTags() {
    tags.value = await db.tags.orderBy('usageCount').reverse().toArray()
  }

  async function addCustomTag(name) {
    const trimmed = name.trim()
    if (!trimmed) return null
    if (tags.value.filter(t => !t.isPredefined).length >= MAX_CUSTOM_TAGS) {
      return null
    }

    const existing = tags.value.find(t => t.name === trimmed)
    if (existing) return existing

    const id = await db.tags.add({ name: trimmed, isPredefined: false, usageCount: 0 })
    await fetchTags()
    return { id, name: trimmed, isPredefined: false, usageCount: 0 }
  }

  async function incrementUsage(tagId) {
    const tag = await db.tags.get(tagId)
    if (tag) {
      await db.tags.update(tagId, { usageCount: (tag.usageCount || 0) + 1 })
      await fetchTags()
    }
  }

  async function decrementUsage(tagId) {
    const tag = await db.tags.get(tagId)
    if (tag && tag.usageCount > 0) {
      await db.tags.update(tagId, { usageCount: tag.usageCount - 1 })
      await fetchTags()
    }
  }

  function fuzzyMatch(input, tagName) {
    return tagName.includes(input)
  }

  async function searchTags(input) {
    const all = await db.tags.toArray()
    return all.filter(t => fuzzyMatch(input, t.name))
  }

  return {
    tags,
    fetchTags,
    initTags,
    addCustomTag,
    incrementUsage,
    decrementUsage,
    searchTags,
    MAX_CUSTOM_TAGS,
  }
})
