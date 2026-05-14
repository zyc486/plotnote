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
  return importFromData(data, false)
}

export async function importFromData(data, replaceAll = false) {
  if (!data.shows || !data.episodes || !data.records) {
    throw new Error('无效的备份数据格式')
  }

  const tables = [db.shows, db.episodes, db.records, db.tags, db.genreHistory, db.series]

  if (replaceAll) {
    let backup = null
    try {
      backup = await collectExportData()
      await db.transaction('rw', tables, async () => {
        await Promise.all(tables.map(t => t.clear()))
      })
    } catch (e) {
      throw new Error('清空数据库失败: ' + e.message)
    }
    try {
      return await doImport(data, tables, true)
    } catch (e) {
      if (backup) {
        console.warn('导入失败，尝试恢复原始数据...')
        try {
          await doImport(backup, tables, true)
        } catch (restoreErr) {
          console.error('恢复也失败了:', restoreErr)
        }
      }
      throw new Error('导入失败: ' + e.message)
    }
  }

  return doImport(data, tables, false)
}

async function doImport(data, tables, isReplace) {
  const importedSeriesIdMap = {}
  const importedShowIdMap = {}
  const importedEpisodeIdMap = {}
  const importedRecordIdMap = {}

  await db.transaction('rw', tables, async () => {
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

    // 保存 episode 原始 ID 映射，用于后续 activeRecordId 处理
    const episodeOldIdMap = new Map()
    for (const episode of data.episodes) {
      const oldId = episode.id
      const newShowId = importedShowIdMap[episode.showId]
      if (newShowId === undefined) continue
      delete episode.id
      episode.showId = newShowId
      const newId = await db.episodes.add(episode)
      importedEpisodeIdMap[oldId] = newId
      episodeOldIdMap.set(episode, oldId)
    }

    for (const record of data.records) {
      const oldRecordId = record.id
      const newEpisodeId = importedEpisodeIdMap[record.episodeId]
      if (newEpisodeId === undefined) continue
      delete record.id
      record.episodeId = newEpisodeId
      const newRecordId = await db.records.add(record)
      if (oldRecordId !== undefined) {
        importedRecordIdMap[oldRecordId] = newRecordId
      }
    }

    // 使用保存的原始 ID 映射 activeRecordId
    for (const ep of data.episodes) {
      const oldId = episodeOldIdMap.get(ep)
      if (oldId === undefined) continue
      if (ep.activeRecordId && importedRecordIdMap[ep.activeRecordId]) {
        const newEpisodeId = importedEpisodeIdMap[oldId]
        if (newEpisodeId !== undefined) {
          await db.episodes.update(newEpisodeId, {
            activeRecordId: importedRecordIdMap[ep.activeRecordId],
          })
        }
      }
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

    for (const newId of Object.values(importedShowIdMap)) {
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
  })

  return {
    shows: data.shows.length,
    episodes: data.episodes.length,
    records: data.records.length,
    tags: data.tags?.length || 0,
    genreHistory: data.genreHistory?.length || 0,
    series: data.series?.length || 0,
  }
}
