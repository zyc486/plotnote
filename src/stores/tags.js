import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../utils/supabase'
import { PREDEFINED_TAGS } from '../db'

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id
}

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
    const { data: tag } = await supabase
      .from('tags')
      .select('usage_count')
      .eq('id', tagId)
      .single()
    if (tag) {
      await supabase.from('tags').update({ usage_count: (tag.usage_count || 0) + 1 }).eq('id', tagId)
      await fetchTags()
    }
  }

  async function decrementUsage(tagId) {
    const { data: tag } = await supabase
      .from('tags')
      .select('usage_count')
      .eq('id', tagId)
      .single()
    if (tag && tag.usage_count > 0) {
      await supabase.from('tags').update({ usage_count: tag.usage_count - 1 }).eq('id', tagId)
      await fetchTags()
    }
  }

  function fuzzyMatch(input, tagName) {
    return tagName.includes(input)
  }

  async function searchTags(input) {
    const userId = await getUserId()
    const { data } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', userId)
    return (data || []).filter(t => fuzzyMatch(input, t.name))
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
