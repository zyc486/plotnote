import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../utils/supabase'
import { useShowsStore } from './shows'
import { episodeLabel as epLabel } from '../utils/terminology'
import { getUserId } from '../utils/helpers'

export const useEpisodesStore = defineStore('episodes', () => {
  const episodes = ref([])

  function toCamel(ep) {
    if (!ep) return ep
    return {
      ...ep,
      showId: ep.show_id,
      activeRecordId: ep.active_record_id,
    }
  }

  async function fetchEpisodes(showId) {
    const userId = await getUserId()
    const { data, error } = await supabase
      .from('episodes')
      .select('*')
      .eq('show_id', showId)
      .eq('user_id', userId)
      .order('season')
      .order('episode')
    if (!error) episodes.value = (data || []).map(toCamel)
  }

  async function getEpisode(episodeId) {
    const { data } = await supabase
      .from('episodes')
      .select('*')
      .eq('id', episodeId)
      .single()
    return toCamel(data)
  }

  function getAdjacentEpisodes(episodeId) {
    const index = episodes.value.findIndex(e => e.id === episodeId)
    if (index === -1) return { prev: null, next: null }

    return {
      prev: index > 0 ? episodes.value[index - 1] : null,
      next: index < episodes.value.length - 1 ? episodes.value[index + 1] : null,
    }
  }

  function episodeLabel(episode) {
    if (!episode) return ''
    return epLabel(episode, episode._category || 'tv')
  }

  async function fetchEpisodesWithRecords(showId) {
    const userId = await getUserId()
    await fetchEpisodes(showId)

    const episodeIds = episodes.value.map(e => e.id)
    if (!episodeIds.length) return { episodes: episodes.value, recordsByEpisode: {} }

    const { data: records } = await supabase
      .from('records')
      .select('*')
      .in('episode_id', episodeIds)
      .eq('user_id', userId)

    const recordsByEpisode = {}
    for (const r of (records || [])) {
      if (!recordsByEpisode[r.episode_id]) recordsByEpisode[r.episode_id] = []
      recordsByEpisode[r.episode_id].push(r)
    }
    return { episodes: episodes.value, recordsByEpisode }
  }

  async function fetchAllEpisodeScores() {
    const userId = await getUserId()
    const episodeIds = episodes.value.map(e => e.id)
    if (!episodeIds.length) return {}

    const { data: records } = await supabase
      .from('records')
      .select('id, episode_id, rating')
      .in('episode_id', episodeIds)
      .eq('user_id', userId)

    const scores = {}
    for (const ep of episodes.value) {
      const epRecords = (records || []).filter(r => r.episode_id === ep.id)
      const rated = epRecords.find(r => r.rating > 0)
      scores[ep.id] = { rating: rated?.rating || 0, count: epRecords.length }
    }
    return scores
  }

  async function deleteEpisode(episodeId) {
    const userId = await getUserId()
    const { data: episode } = await supabase
      .from('episodes')
      .select('id, show_id')
      .eq('id', episodeId)
      .eq('user_id', userId)
      .single()
    if (!episode) return

    await supabase.from('records').delete().eq('episode_id', episodeId).eq('user_id', userId)
    await supabase.from('episodes').delete().eq('id', episodeId).eq('user_id', userId)

    const showsStore = useShowsStore()
    await showsStore.updateShowStats(episode.show_id)
    await fetchEpisodes(episode.show_id)
  }

  return { episodes, fetchEpisodes, getEpisode, getAdjacentEpisodes, episodeLabel, deleteEpisode, fetchEpisodesWithRecords, fetchAllEpisodeScores }
})
