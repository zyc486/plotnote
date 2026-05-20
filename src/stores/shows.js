import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../utils/supabase'
import { getUserId } from '../utils/helpers'

export const useShowsStore = defineStore('shows', () => {
  const shows = ref([])
  const loading = ref(false)

  function toCamel(row) {
    if (!row) return row
    return {
      ...row,
      avgRating: row.avg_rating,
      ratedCount: row.rated_count,
      totalEpisodes: row.total_episodes,
      seriesId: row.series_id,
      coverImage: row.cover_image,
      lastWatchedAt: row.last_watched_at ? new Date(row.last_watched_at).getTime() : null,
      startDate: row.start_date,
      finishDate: row.finish_date,
    }
  }

  async function fetchShows() {
    loading.value = true
    const userId = await getUserId()
    const { data, error } = await supabase
      .from('shows')
      .select('*')
      .eq('user_id', userId)
      .order('id', { ascending: false })
    if (!error) shows.value = (data || []).map(toCamel)
    loading.value = false
  }

  async function getShow(showId) {
    const { data } = await supabase
      .from('shows')
      .select('*')
      .eq('id', showId)
      .single()
    return toCamel(data)
  }

  async function updateShowCover(showId, coverImage) {
    await supabase.from('shows').update({ cover_image: coverImage }).eq('id', showId)
  }

  async function addShow(name, episodes, metadata = {}) {
    const userId = await getUserId()
    const showData = {
      user_id: userId,
      name,
      avg_rating: 0,
      rated_count: 0,
      total_episodes: episodes.length,
      category: metadata.category || '',
      region: metadata.region || '',
      genres: JSON.stringify(metadata.genres || []),
      cover_image: metadata.coverImage || '',
      author: metadata.author || '',
      status: metadata.status || 'want',
      start_date: metadata.startDate || null,
      finish_date: metadata.finishDate || null,
      last_watched_at: null,
    }
    if (metadata.seriesId) showData.series_id = metadata.seriesId

    const { data: show, error } = await supabase
      .from('shows')
      .insert(showData)
      .select()
      .single()
    if (error) throw error

    if (episodes.length > 0) {
      const episodeRows = episodes.map(ep => ({
        user_id: userId,
        show_id: show.id,
        season: ep.season,
        episode: ep.episode,
        active_record_id: null,
      }))
      await supabase.from('episodes').insert(episodeRows)
    }

    if (metadata.genres?.length) {
      for (const genre of metadata.genres) {
        const { data: existing } = await supabase
          .from('genre_history')
          .select('id')
          .eq('user_id', userId)
          .eq('name', genre)
          .maybeSingle()
        if (!existing) {
          await supabase.from('genre_history').insert({ user_id: userId, name: genre })
        }
      }
    }

    await fetchShows()
    return show.id
  }

  async function updateShowMeta(showId, metadata) {
    const userId = await getUserId()
    const updateData = {}
    if (metadata.name !== undefined) updateData.name = metadata.name
    if (metadata.category !== undefined) updateData.category = metadata.category
    if (metadata.region !== undefined) updateData.region = metadata.region
    if (metadata.genres !== undefined) updateData.genres = JSON.stringify(metadata.genres)
    if (metadata.seriesId !== undefined) updateData.series_id = metadata.seriesId || null
    if (metadata.coverImage !== undefined) updateData.cover_image = metadata.coverImage || ''
    if (metadata.author !== undefined) updateData.author = metadata.author || ''
    if (metadata.status !== undefined) updateData.status = metadata.status
    if (metadata.startDate !== undefined) updateData.start_date = metadata.startDate || null
    if (metadata.finishDate !== undefined) updateData.finish_date = metadata.finishDate || null

    await supabase.from('shows').update(updateData).eq('id', showId)

    if (metadata.genres?.length) {
      for (const genre of metadata.genres) {
        const { data: existing } = await supabase
          .from('genre_history')
          .select('id')
          .eq('user_id', userId)
          .eq('name', genre)
          .maybeSingle()
        if (!existing) {
          await supabase.from('genre_history').insert({ user_id: userId, name: genre })
        }
      }
    }

    await fetchShows()
  }

  async function updateShowStats(showId) {
    const userId = await getUserId()
    const { data: episodes } = await supabase
      .from('episodes')
      .select('id, active_record_id')
      .eq('show_id', showId)
      .eq('user_id', userId)

    if (!episodes || episodes.length === 0) {
      await supabase.from('shows').update({ avg_rating: 0, rated_count: 0 }).eq('id', showId)
      // 更新本地状态
      const show = shows.value.find(s => s.id === showId)
      if (show) {
        show.avgRating = 0
        show.avg_rating = 0
        show.ratedCount = 0
        show.rated_count = 0
      }
      return
    }

    const episodeIds = episodes.map(ep => ep.id)
    const activeRecordIds = episodes
      .filter(ep => ep.active_record_id)
      .map(ep => ep.active_record_id)

    if (activeRecordIds.length === 0) {
      await supabase.from('shows').update({ avg_rating: 0, rated_count: 0 }).eq('id', showId)
      const show = shows.value.find(s => s.id === showId)
      if (show) {
        show.avgRating = 0
        show.avg_rating = 0
        show.ratedCount = 0
        show.rated_count = 0
      }
      return
    }

    const { data: records } = await supabase
      .from('records')
      .select('id, rating')
      .in('id', activeRecordIds)

    const ratedRecords = (records || []).filter(r => r.rating !== undefined && r.rating !== null && r.rating > 0)
    const avgRating = ratedRecords.length > 0
      ? ratedRecords.reduce((sum, r) => sum + r.rating, 0) / ratedRecords.length
      : 0

    const roundedAvg = Math.round(avgRating * 10) / 10
    await supabase.from('shows').update({
      avg_rating: roundedAvg,
      rated_count: ratedRecords.length,
    }).eq('id', showId)

    // 更新本地状态，避免全量重新获取
    const show = shows.value.find(s => s.id === showId)
    if (show) {
      show.avgRating = roundedAvg
      show.avg_rating = roundedAvg
      show.ratedCount = ratedRecords.length
      show.rated_count = ratedRecords.length
    }
  }

  async function deleteShow(showId) {
    const userId = await getUserId()
    const { data: episodes } = await supabase
      .from('episodes')
      .select('id')
      .eq('show_id', showId)
      .eq('user_id', userId)

    if (episodes?.length) {
      const episodeIds = episodes.map(e => e.id)
      await supabase.from('records').delete().in('episode_id', episodeIds).eq('user_id', userId)
    }
    await supabase.from('episodes').delete().eq('show_id', showId).eq('user_id', userId)
    await supabase.from('shows').delete().eq('id', showId).eq('user_id', userId)
    await fetchShows()
  }

  async function fetchAllData() {
    const userId = await getUserId()
    const [showsRes, episodesRes, recordsRes] = await Promise.all([
      supabase.from('shows').select('*').eq('user_id', userId),
      supabase.from('episodes').select('*').eq('user_id', userId),
      supabase.from('records').select('*').eq('user_id', userId),
    ])
    if (!showsRes.error) shows.value = (showsRes.data || []).map(toCamel)
    return {
      shows: shows.value,
      episodes: episodesRes.data || [],
      records: recordsRes.data || [],
    }
  }

  async function getGenreHistory() {
    const userId = await getUserId()
    const { data } = await supabase
      .from('genre_history')
      .select('*')
      .eq('user_id', userId)
    return data || []
  }

  async function updateShowStatus(showId, status) {
    const updateData = { status }
    if (status === 'watching') {
      const show = await getShow(showId)
      if (!show?.start_date) updateData.start_date = new Date().toISOString().split('T')[0]
    }
    if (status === 'finished') {
      const show = await getShow(showId)
      if (!show?.finish_date) updateData.finish_date = new Date().toISOString().split('T')[0]
    }
    await supabase.from('shows').update(updateData).eq('id', showId)
    await fetchShows()
  }

  async function updateLastWatchedAt(showId) {
    const now = new Date().toISOString()
    await supabase.from('shows').update({ last_watched_at: now }).eq('id', showId)
    // 更新本地状态
    const show = shows.value.find(s => s.id === showId)
    if (show) {
      show.last_watched_at = now
      show.lastWatchedAt = new Date(now).getTime()
    }
  }

  async function getAllSeries() {
    const userId = await getUserId()
    const { data } = await supabase
      .from('series')
      .select('*')
      .eq('user_id', userId)
    return data || []
  }

  async function createSeries(name) {
    const userId = await getUserId()
    const { data: existing } = await supabase
      .from('series')
      .select('id')
      .eq('user_id', userId)
      .eq('name', name)
      .maybeSingle()
    if (existing) return existing.id

    const { data, error } = await supabase
      .from('series')
      .insert({ user_id: userId, name })
      .select()
      .single()
    if (error) throw error
    return data.id
  }

  async function getSeriesName(seriesId) {
    if (!seriesId) return ''
    const { data } = await supabase
      .from('series')
      .select('name')
      .eq('id', seriesId)
      .single()
    return data?.name || ''
  }

  return {
    shows, loading, fetchShows, getShow, addShow, updateShowMeta, updateShowStats, deleteShow,
    getGenreHistory, updateShowStatus, updateLastWatchedAt, getAllSeries, createSeries, getSeriesName,
    updateShowCover, fetchAllData,
  }
})
