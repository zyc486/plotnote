import { db } from '../db'

export async function collectExportData() {
  const shows = await db.shows.toArray()
  const episodes = await db.episodes.toArray()
  const records = await db.records.toArray()
  const tags = await db.tags.toArray()
  const genreHistory = await db.genreHistory.toArray()
  const series = await db.series.toArray()

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
  return importFromData(data)
}

export async function importFromData(data) {
  if (!data.shows || !data.episodes || !data.records) {
    throw new Error('无效的备份数据格式')
  }

  const importedSeriesIdMap = {}

  if (data.series) {
    for (const s of data.series) {
      const oldId = s.id
      const existing = await db.series.where('name').equals(s.name).first()
      if (existing) {
        importedSeriesIdMap[oldId] = existing.id
      } else {
        delete s.id
        const newId = await db.series.add(s)
        importedSeriesIdMap[oldId] = newId
      }
    }
  }

  const importedShowIdMap = {}

  for (const show of data.shows) {
    const oldId = show.id
    if (show.seriesId && importedSeriesIdMap[show.seriesId]) {
      show.seriesId = importedSeriesIdMap[show.seriesId]
    } else if (show.seriesId) {
      delete show.seriesId
    }
    delete show.id
    const newId = await db.shows.add(show)
    importedShowIdMap[oldId] = newId
  }

  const importedEpisodeIdMap = {}

  for (const episode of data.episodes) {
    const oldId = episode.id
    const newShowId = importedShowIdMap[episode.showId]
    if (newShowId === undefined) continue
    delete episode.id
    episode.showId = newShowId
    const newId = await db.episodes.add(episode)
    importedEpisodeIdMap[oldId] = newId
  }

  for (const record of data.records) {
    const newEpisodeId = importedEpisodeIdMap[record.episodeId]
    if (newEpisodeId === undefined) continue
    delete record.id
    record.episodeId = newEpisodeId
    await db.records.add(record)
  }

  if (data.tags) {
    for (const tag of data.tags) {
      const existing = await db.tags.where('name').equals(tag.name).first()
      if (!existing) {
        delete tag.id
        await db.tags.add(tag)
      }
    }
  }

  if (data.genreHistory) {
    for (const genre of data.genreHistory) {
      const existing = await db.genreHistory.where('name').equals(genre.name).first()
      if (!existing) {
        delete genre.id
        await db.genreHistory.add(genre)
      }
    }
  }

  for (const [oldId, newId] of Object.entries(importedShowIdMap)) {
    const episodes = await db.episodes.where('showId').equals(newId).toArray()
    let totalRating = 0
    let ratedCount = 0
    for (const ep of episodes) {
      const records = await db.records.where('episodeId').equals(ep.id).toArray()
      const activeRecord = records.find(r => r.id === ep.activeRecordId)
      if (activeRecord) {
        totalRating += activeRecord.rating
        ratedCount++
      }
    }
    const avgRating = ratedCount > 0 ? Math.round((totalRating / ratedCount) * 10) / 10 : 0
    await db.shows.update(newId, { avgRating, ratedCount })
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
