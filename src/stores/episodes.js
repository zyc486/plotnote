import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '../db'
import { useShowsStore } from './shows'
import { episodeLabel as epLabel } from '../utils/terminology'
import { scheduleBackup } from '../utils/autoBackup'

export const useEpisodesStore = defineStore('episodes', () => {
  const episodes = ref([])

  async function fetchEpisodes(showId) {
    episodes.value = await db.episodes.where({ showId }).toArray()
    episodes.value.sort((a, b) => {
      if (a.season !== b.season) return a.season - b.season
      return a.episode - b.episode
    })
  }

  async function getEpisode(episodeId) {
    return await db.episodes.get(episodeId)
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

  async function deleteEpisode(episodeId) {
    const episode = await db.episodes.get(episodeId)
    if (!episode) return

    await db.records.where({ episodeId }).delete()
    await db.episodes.delete(episodeId)

    const showsStore = useShowsStore()
    await showsStore.updateShowStats(episode.showId)
    await fetchEpisodes(episode.showId)
    scheduleBackup()
  }

  return { episodes, fetchEpisodes, getEpisode, getAdjacentEpisodes, episodeLabel, deleteEpisode }
})
