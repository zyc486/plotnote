import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../utils/supabase'
import { PREDEFINED_TAGS } from '../db'
import { getUserId } from '../utils/helpers'

export const useTagsStore = defineStore('tags', () => {
  const tags = ref([])
  const MAX_CUSTOM_TAGS = 20

  async function initTags() {
    const userId = await getUserId()
    const { data: existing } = await supabase
      .from('tags')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
    if (!existing || existing.length === 0) {
      const tagRows = PREDEFINED_TAGS.map(name => ({
        user_id: userId,
        name,
        is_predefined: true,
        usage_count: 0,
      }))
      await supabase.from('tags').insert(tagRows)
    }
    await fetchTags()
  }

  async function fetchTags() {
    const userId = await getUserId()
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', userId)
      .order('usage_count', { ascending: false })
    if (!error) tags.value = data || []
  }

  async function addCustomTag(name) {
    const trimmed = name.trim()
    if (!trimmed) return null
    if (tags.value.filter(t => !t.is_predefined).length >= MAX_CUSTOM_TAGS) {
      return null
    }

    const existing = tags.value.find(t => t.name === trimmed)
    if (existing) return existing

    const userId = await getUserId()
    const { data, error } = await supabase
      .from('tags')
      .insert({ user_id: userId, name: trimmed, is_predefined: false, usage_count: 0 })
      .select()
      .single()
    if (error) throw error
    await fetchTags()
    return data
  }

  async function incrementUsage(tagId) {
    const tag = tags.value.find(t => t.id === tagId)
    if (!tag) return
    const newCount = (tag.usage_count || 0) + 1
    // 乐观更新本地状态
    tag.usage_count = newCount
    // 后台同步到服务器
    await supabase.from('tags').update({ usage_count: newCount }).eq('id', tagId)
  }

  async function decrementUsage(tagId) {
    const tag = tags.value.find(t => t.id === tagId)
    if (!tag || tag.usage_count <= 0) return
    const newCount = tag.usage_count - 1
    // 乐观更新本地状态
    tag.usage_count = newCount
    // 后台同步到服务器
    await supabase.from('tags').update({ usage_count: newCount }).eq('id', tagId)
  }

  function fuzzyMatch(input, tagName) {
    return tagName.includes(input)
  }

  function searchTags(input) {
    return tags.value.filter(t => fuzzyMatch(input, t.name))
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
