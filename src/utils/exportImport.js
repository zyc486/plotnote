import { supabase } from './supabase'

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id
}

export async function deduplicateShows() {
  const userId = await getUserId()
  const { data: allShows } = await supabase.from('shows').select('*').eq('user_id', userId)
  if (!allShows) return 0

  const grouped = {}
  for (const show of allShows) {
    const key = `${show.name}|||${show.category || ''}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(show)
  }

  let removedCount = 0
  for (const shows of Object.values(grouped)) {
    if (shows.length <= 1) continue
    shows.sort((a, b) => b.id - a.id)
    const [, ...duplicates] = shows
    for (const dup of duplicates) {
      const { data: episodes } = await supabase
        .from('episodes')
        .select('id')
        .eq('show_id', dup.id)
        .eq('user_id', userId)
      if (episodes?.length) {
        const episodeIds = episodes.map(e => e.id)
        await supabase.from('records').delete().in('episode_id', episodeIds).eq('user_id', userId)
      }
      await supabase.from('episodes').delete().eq('show_id', dup.id).eq('user_id', userId)
      await supabase.from('shows').delete().eq('id', dup.id).eq('user_id', userId)
      removedCount++
    }
  }
  return removedCount
}

export async function collectExportData() {
  const userId = await getUserId()
  const [shows, episodes, records, tags, genreHistory, series] = await Promise.all([
    supabase.from('shows').select('*').eq('user_id', userId).then(r => r.data || []),
    supabase.from('episodes').select('*').eq('user_id', userId).then(r => r.data || []),
    supabase.from('records').select('*').eq('user_id', userId).then(r => r.data || []),
    supabase.from('tags').select('*').eq('user_id', userId).then(r => r.data || []),
    supabase.from('genre_history').select('*').eq('user_id', userId).then(r => r.data || []),
    supabase.from('series').select('*').eq('user_id', userId).then(r => r.data || []),
  ])

  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    shows,
    episodes,
    records,
    tags,
    genreHistory,
    series,
  }
}

export async function exportToJSON() {
  const exportData = await collectExportData()

  const json = JSON.stringify(exportData, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `plotnote-export-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  return {
    shows: exportData.shows.length,
    episodes: exportData.episodes.length,
    records: exportData.records.length,
    tags: exportData.tags.length,
    genreHistory: exportData.genreHistory.length,
    series: exportData.series.length,
  }
}

export async function importFromJSON(file) {
  const text = await file.text()
  const data = JSON.parse(text)
  return importFromData(data, false)
}

export async function importFromData(data, replaceAll = false) {
  if (!data.shows || !data.episodes || !data.records) {
    throw new Error('无效的备份数据格式')
  }

  const userId = await getUserId()

  if (replaceAll) {
    await supabase.from('records').delete().eq('user_id', userId)
    await supabase.from('episodes').delete().eq('user_id', userId)
    await supabase.from('shows').delete().eq('user_id', userId)
    await supabase.from('tags').delete().eq('user_id', userId)
    await supabase.from('genre_history').delete().eq('user_id', userId)
    await supabase.from('series').delete().eq('user_id', userId)
  }

  const seriesIdMap = {}
  const showIdMap = {}
  const episodeIdMap = {}

  if (data.series) {
    for (const s of data.series) {
      const oldId = s.id
      const { data: existing } = await supabase
        .from('series')
        .select('id')
        .eq('user_id', userId)
        .eq('name', s.name)
        .maybeSingle()
      if (existing) {
        seriesIdMap[oldId] = existing.id
      } else {
        const { data: inserted } = await supabase
          .from('series')
          .insert({ user_id: userId, name: s.name })
          .select()
          .single()
        if (inserted) seriesIdMap[oldId] = inserted.id
      }
    }
  }

  for (const show of data.shows) {
    const oldId = show.id
    const insertData = {
      user_id: userId,
      name: show.name,
      avg_rating: show.avg_rating || show.avgRating || 0,
      rated_count: show.rated_count || show.ratedCount || 0,
      total_episodes: show.total_episodes || show.totalEpisodes || 0,
      category: show.category || '',
      region: show.region || '',
      genres: show.genres || '[]',
      cover_image: show.cover_image || show.coverImage || '',
      author: show.author || '',
      status: show.status || 'want',
      start_date: show.start_date || show.startDate || null,
      finish_date: show.finish_date || show.finishDate || null,
      last_watched_at: show.last_watched_at || null,
    }
    if (show.series_id || show.seriesId) {
      const sid = show.series_id || show.seriesId
      insertData.series_id = seriesIdMap[sid] || sid
    }

    const { data: inserted } = await supabase
      .from('shows')
      .insert(insertData)
      .select()
      .single()
    if (inserted) showIdMap[oldId] = inserted.id
  }

  for (const ep of data.episodes) {
    const oldId = ep.id
    const newShowId = showIdMap[ep.show_id || ep.showId]
    if (newShowId === undefined) continue

    const { data: inserted } = await supabase
      .from('episodes')
      .insert({
        user_id: userId,
        show_id: newShowId,
        season: ep.season,
        episode: ep.episode,
        active_record_id: null,
      })
      .select()
      .single()
    if (inserted) episodeIdMap[oldId] = inserted.id
  }

  const recordIdMap = {}
  for (const rec of data.records) {
    const oldId = rec.id
    const newEpisodeId = episodeIdMap[rec.episode_id || rec.episodeId]
    if (newEpisodeId === undefined) continue

    const { data: inserted } = await supabase
      .from('records')
      .insert({
        user_id: userId,
        episode_id: newEpisodeId,
        rating: rec.rating || 0,
        review: rec.review || '',
        images: rec.images || '[]',
        tags: rec.tags || '[]',
        created_at: rec.created_at || rec.createdAt || new Date().toISOString(),
        watched_date: rec.watched_date || rec.watchedDate || null,
      })
      .select()
      .single()
    if (inserted && oldId !== undefined) recordIdMap[oldId] = inserted.id
  }

  // Update active_record_id for episodes
  for (const ep of data.episodes) {
    const oldEpId = ep.id
    const oldActiveRecordId = ep.active_record_id || ep.activeRecordId
    if (!oldActiveRecordId) continue
    const newEpId = episodeIdMap[oldEpId]
    const newRecordId = recordIdMap[oldActiveRecordId]
    if (newEpId && newRecordId) {
      await supabase.from('episodes').update({ active_record_id: newRecordId }).eq('id', newEpId)
    }
  }

  if (data.tags) {
    for (const tag of data.tags) {
      const { data: existing } = await supabase
        .from('tags')
        .select('id')
        .eq('user_id', userId)
        .eq('name', tag.name)
        .maybeSingle()
      if (!existing) {
        await supabase.from('tags').insert({
          user_id: userId,
          name: tag.name,
          is_predefined: tag.is_predefined || tag.isPredefined || false,
          usage_count: tag.usage_count || tag.usageCount || 0,
        })
      }
    }
  }

  if (data.genreHistory) {
    for (const genre of data.genreHistory) {
      const { data: existing } = await supabase
        .from('genre_history')
        .select('id')
        .eq('user_id', userId)
        .eq('name', genre.name)
        .maybeSingle()
      if (!existing) {
        await supabase.from('genre_history').insert({ user_id: userId, name: genre.name })
      }
    }
  }

  return {
    shows: data.shows.length,
    episodes: data.episodes.length,
    records: data.records.length,
    tags: data.tags?.length || 0,
    genreHistory: data.genreHistory?.length || 0,
    series: data.series?.length || 0,
  }
}
