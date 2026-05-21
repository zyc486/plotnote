import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../utils/supabase'
import { useShowsStore } from './shows'
import { getUserId } from '../utils/helpers'

export const useRecordsStore = defineStore('records', () => {
  const episodeRecords = ref([])
  const loading = ref(false)

  function toCamelRecord(r) {
    if (!r) return r
    return {
      ...r,
      episodeId: r.episode_id,
      createdAt: r.created_at,
      watchedDate: r.watched_date,
      images: typeof r.images === 'string' ? JSON.parse(r.images) : (r.images || []),
      tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : (r.tags || []),
    }
  }

  async function fetchEpisodeRecords(episodeId) {
    loading.value = true
    const userId = await getUserId()
    const { data, error } = await supabase
      .from('records')
      .select('*')
      .eq('episode_id', episodeId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (!error) {
      episodeRecords.value = (data || []).map(toCamelRecord)
    }
    loading.value = false
  }

  async function getRecord(recordId) {
    const { data } = await supabase
      .from('records')
      .select('*')
      .eq('id', recordId)
      .single()
    return toCamelRecord(data)
  }

  async function getActiveRecord(episodeId) {
    const { data: episode } = await supabase
      .from('episodes')
      .select('active_record_id')
      .eq('id', episodeId)
      .single()
    if (!episode || !episode.active_record_id) return null
    return await getRecord(episode.active_record_id)
  }

  async function createRecord(episodeId, rating = 0, review = '', images = [], tags = [], watchedDate = null) {
    const userId = await getUserId()
    const { data: record, error } = await supabase
      .from('records')
      .insert({
        user_id: userId,
        episode_id: episodeId,
        rating,
        review,
        images: JSON.stringify(images),
        tags: JSON.stringify(tags),
        created_at: new Date().toISOString(),
        watched_date: watchedDate || new Date().toISOString().split('T')[0],
      })
      .select()
      .single()
    if (error) throw error

    await supabase.from('episodes').update({ active_record_id: record.id }).eq('id', episodeId)

    const { data: episode } = await supabase
      .from('episodes')
      .select('show_id')
      .eq('id', episodeId)
      .single()
    if (episode) {
      const showsStore = useShowsStore()
      await showsStore.updateShowStats(episode.show_id)
      await showsStore.updateLastWatchedAt(episode.show_id)
    }

    return record.id
  }

  async function updateRecord(recordId, data) {
    const { data: record } = await supabase
      .from('records')
      .select('episode_id')
      .eq('id', recordId)
      .single()
    if (!record) return

    const updateData = {}
    if (data.rating !== undefined) updateData.rating = data.rating
    if (data.review !== undefined) updateData.review = data.review
    if (data.images !== undefined) updateData.images = JSON.stringify(data.images)
    if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags)
    if (data.watchedDate !== undefined) updateData.watched_date = data.watchedDate

    await supabase.from('records').update(updateData).eq('id', recordId)

    const { data: episode } = await supabase
      .from('episodes')
      .select('show_id')
      .eq('id', record.episode_id)
      .single()
    if (episode) {
      const showsStore = useShowsStore()
      await showsStore.updateShowStats(episode.show_id)
      await showsStore.updateLastWatchedAt(episode.show_id)
    }
  }

  async function setActiveRecord(episodeId, recordId) {
    await supabase.from('episodes').update({ active_record_id: recordId }).eq('id', episodeId)
    const { data: episode } = await supabase
      .from('episodes')
      .select('show_id')
      .eq('id', episodeId)
      .single()
    if (episode) {
      const showsStore = useShowsStore()
      await showsStore.updateShowStats(episode.show_id)
    }
  }

  async function deleteRecord(recordId) {
    const userId = await getUserId()
    const { data: record } = await supabase
      .from('records')
      .select('episode_id')
      .eq('id', recordId)
      .eq('user_id', userId)
      .single()
    if (!record) return

    const { data: episode } = await supabase
      .from('episodes')
      .select('active_record_id, show_id')
      .eq('id', record.episode_id)
      .single()
    const wasActive = episode && episode.active_record_id === recordId

    await supabase.from('records').delete().eq('id', recordId).eq('user_id', userId)

    if (wasActive) {
      const { data: remaining } = await supabase
        .from('records')
        .select('id')
        .eq('episode_id', record.episode_id)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      await supabase.from('episodes').update({
        active_record_id: remaining?.id || null
      }).eq('id', record.episode_id)
    }

    if (episode) {
      const showsStore = useShowsStore()
      await showsStore.updateShowStats(episode.show_id)
    }
  }

  return {
    episodeRecords,
    loading,
    fetchEpisodeRecords,
    getRecord,
    getActiveRecord,
    createRecord,
    updateRecord,
    setActiveRecord,
    deleteRecord,
  }
})
