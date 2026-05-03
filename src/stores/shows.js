import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '../db'
import { scheduleBackup } from '../utils/autoBackup'

export const useShowsStore = defineStore('shows', () => {
  const shows = ref([])
  const loading = ref(false)

  async function fetchShows() {
    loading.value = true
    shows.value = await db.shows.toArray()
    loading.value = false
  }

  async function getShow(showId) {
    return await db.shows.get(showId)
  }

  async function updateShowCover(showId, coverImage) {
    await db.shows.update(showId, { coverImage })
  }

  async function addShow(name, episodes, metadata = {}) {
    const showData = {
      name,
      avgRating: 0,
      ratedCount: 0,
      totalEpisodes: episodes.length,
      category: metadata.category || '',
      region: metadata.region || '',
      genres: metadata.genres ? JSON.stringify(metadata.genres) : '[]',
      coverImage: metadata.coverImage || '',
      author: metadata.author || '',
      status: metadata.status || 'want',
      startDate: metadata.startDate || null,
      finishDate: metadata.finishDate || null,
      lastWatchedAt: null,
    }
    if (metadata.seriesId) showData.seriesId = metadata.seriesId

    const showId = await db.shows.add(showData)

    const episodeRows = episodes.map(ep => ({
      showId,
      season: ep.season,
      episode: ep.episode,
      activeRecordId: null,
    }))
    await db.episodes.bulkAdd(episodeRows)

    if (metadata.genres?.length) {
      for (const genre of metadata.genres) {
        const existing = await db.genreHistory.where('name').equals(genre).first()
        if (!existing) {
          await db.genreHistory.add({ name: genre })
        }
      }
    }

    await fetchShows()
    scheduleBackup()
    return showId
  }

  async function updateShowMeta(showId, metadata) {
    const updateData = {}
    if (metadata.name !== undefined) updateData.name = metadata.name
    if (metadata.category !== undefined) updateData.category = metadata.category
    if (metadata.region !== undefined) updateData.region = metadata.region
    if (metadata.genres !== undefined) updateData.genres = JSON.stringify(metadata.genres)
    if (metadata.seriesId !== undefined) updateData.seriesId = metadata.seriesId || null
    if (metadata.coverImage !== undefined) updateData.coverImage = metadata.coverImage || ''
    if (metadata.author !== undefined) updateData.author = metadata.author || ''
    if (metadata.status !== undefined) updateData.status = metadata.status
    if (metadata.startDate !== undefined) updateData.startDate = metadata.startDate
    if (metadata.finishDate !== undefined) updateData.finishDate = metadata.finishDate

    await db.shows.update(showId, updateData)

    if (metadata.genres?.length) {
      for (const genre of metadata.genres) {
        const existing = await db.genreHistory.where('name').equals(genre).first()
        if (!existing) {
          await db.genreHistory.add({ name: genre })
        }
      }
    }

    await fetchShows()
    scheduleBackup()
  }

  async function updateShowStats(showId) {
    const episodes = await db.episodes.where({ showId }).toArray()
    const episodeIds = episodes.map(ep => ep.id)

    if (episodeIds.length === 0) {
      await db.shows.update(showId, { avgRating: 0, ratedCount: 0 })
      return
    }

    const records = await db.records.where('episodeId').anyOf(episodeIds).toArray()
    const activeRecords = records.filter(r => {
      const ep = episodes.find(e => e.id === r.episodeId)
      return ep && ep.activeRecordId === r.id
    })

    const ratedRecords = activeRecords.filter(r => r.rating !== undefined && r.rating !== null && r.rating > 0)
    const avgRating = ratedRecords.length > 0
      ? ratedRecords.reduce((sum, r) => sum + r.rating, 0) / ratedRecords.length
      : 0

    await db.shows.update(showId, {
      avgRating: Math.round(avgRating * 10) / 10,
      ratedCount: ratedRecords.length,
    })

    await fetchShows()
  }

  async function deleteShow(showId) {
    const episodeIds = (await db.episodes.where({ showId }).toArray()).map(e => e.id)
    if (episodeIds.length) {
      await db.records.where('episodeId').anyOf(episodeIds).delete()
    }
    await db.episodes.where({ showId }).delete()
    await db.shows.delete(showId)
    await fetchShows()
    scheduleBackup()
  }

  async function getGenreHistory() {
    return await db.genreHistory.toArray()
  }

  async function updateShowStatus(showId, status) {
    const updateData = { status }
    if (status === 'watching' && !((await db.shows.get(showId))?.startDate)) {
      updateData.startDate = new Date().toISOString().split('T')[0]
    }
    if (status === 'finished') {
      const show = await db.shows.get(showId)
      if (!show?.finishDate) updateData.finishDate = new Date().toISOString().split('T')[0]
    }
    await db.shows.update(showId, updateData)
    await fetchShows()
    scheduleBackup()
  }

  async function updateLastWatchedAt(showId) {
    await db.shows.update(showId, { lastWatchedAt: Date.now() })
  }

  async function getAllSeries() {
    return await db.series.toArray()
  }

  async function createSeries(name) {
    const existing = await db.series.where('name').equals(name).first()
    if (existing) return existing.id
    return await db.series.add({ name })
  }

  async function getSeriesName(seriesId) {
    if (!seriesId) return ''
    const s = await db.series.get(seriesId)
    return s ? s.name : ''
  }

  return {
    shows, loading, fetchShows, getShow, addShow, updateShowMeta, updateShowStats, deleteShow,
    getGenreHistory, updateShowStatus, updateLastWatchedAt, getAllSeries, createSeries, getSeriesName,
    updateShowCover,
  }
})
