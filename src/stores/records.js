import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '../db'
import { useShowsStore } from './shows'
import { scheduleBackup } from '../utils/autoBackup'

export const useRecordsStore = defineStore('records', () => {
  const episodeRecords = ref([])

  async function fetchEpisodeRecords(episodeId) {
    episodeRecords.value = await db.records.where({ episodeId }).reverse().toArray()
  }

  async function getRecord(recordId) {
    return await db.records.get(recordId)
  }

  async function getActiveRecord(episodeId) {
    const episode = await db.episodes.get(episodeId)
    if (!episode || !episode.activeRecordId) return null
    return await db.records.get(episode.activeRecordId)
  }

  async function createRecord(episodeId, rating = 0, review = '', images = [], tags = [], watchedDate = null) {
    const now = Date.now()
    const recordId = await db.records.add({
      episodeId,
      rating,
      review,
      images: JSON.stringify(images),
      tags: JSON.stringify(tags),
      createdAt: now,
      watchedDate: watchedDate || new Date().toISOString().split('T')[0],
    })

    await db.episodes.update(episodeId, { activeRecordId: recordId })

    const episode = await db.episodes.get(episodeId)
    const showsStore = useShowsStore()
    await showsStore.updateShowStats(episode.showId)
    await showsStore.updateLastWatchedAt(episode.showId)

    scheduleBackup()
    return recordId
  }

  async function updateRecord(recordId, data) {
    const record = await db.records.get(recordId)
    if (!record) return

    const updateData = {}
    if (data.rating !== undefined) updateData.rating = data.rating
    if (data.review !== undefined) updateData.review = data.review
    if (data.images !== undefined) updateData.images = JSON.stringify(data.images)
    if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags)
    if (data.watchedDate !== undefined) updateData.watchedDate = data.watchedDate

    await db.records.update(recordId, updateData)

    const episode = await db.episodes.get(record.episodeId)
    if (episode) {
      const showsStore = useShowsStore()
      await showsStore.updateShowStats(episode.showId)
      await showsStore.updateLastWatchedAt(episode.showId)
    }
    scheduleBackup()
  }

  async function setActiveRecord(episodeId, recordId) {
    await db.episodes.update(episodeId, { activeRecordId: recordId })
    const episode = await db.episodes.get(episodeId)
    const showsStore = useShowsStore()
    await showsStore.updateShowStats(episode.showId)
    scheduleBackup()
  }

  async function deleteRecord(recordId) {
    const record = await db.records.get(recordId)
    if (!record) return

    const episode = await db.episodes.get(record.episodeId)
    const wasActive = episode && episode.activeRecordId === recordId

    await db.records.delete(recordId)

    if (wasActive) {
      const remaining = await db.records.where({ episodeId: record.episodeId }).first()
      if (remaining) {
        await db.episodes.update(record.episodeId, { activeRecordId: remaining.id })
      } else {
        await db.episodes.update(record.episodeId, { activeRecordId: null })
      }
    }

    if (episode) {
      const showsStore = useShowsStore()
      await showsStore.updateShowStats(episode.showId)
    }
    scheduleBackup()
  }

  return {
    episodeRecords,
    fetchEpisodeRecords,
    getRecord,
    getActiveRecord,
    createRecord,
    updateRecord,
    setActiveRecord,
    deleteRecord,
  }
})
