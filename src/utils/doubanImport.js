import { supabase } from './supabase'
import { getUserId } from './helpers'
import { searchTvShows, getTvShowSeasons, searchMovies } from './tmdb'
import { searchShows as searchTvmaze, getShowEpisodes, buildEpisodesFromApi } from './tvmaze'
import { searchAnime } from './anilist'
import { searchAnime as searchAnimeJikan } from './jikan'
import { searchBooks } from './googleBooks'

const BATCH_SIZE = 3
const DELAY_MS = 800

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// 电视剧搜索（复用现有逻辑）
async function findTvShow(name) {
  try {
    const [tmdbRes, tvmazeRes] = await Promise.allSettled([
      searchTvShows(name),
      searchTvmaze(name),
    ])
    const tmdb = tmdbRes.status === 'fulfilled' ? tmdbRes.value : []
    const tvmaze = tvmazeRes.status === 'fulfilled' ? tvmazeRes.value : []

    let coverImage = tmdb[0]?.image || tvmaze[0]?.image || ''
    let episodes = []

    if (tmdb[0]) {
      try {
        const eps = await getTvShowSeasons(tmdb[0].id)
        episodes = eps.map(ep => ({ season: ep.season, episode: ep.episode }))
      } catch {}
    }
    if (episodes.length === 0 && tvmaze[0]) {
      try {
        const eps = await getShowEpisodes(tvmaze[0].id)
        episodes = buildEpisodesFromApi(eps)
      } catch {}
    }

    return { coverImage, episodes, region: tmdb[0]?.language || tvmaze[0]?.language || '' }
  } catch {
    return { coverImage: '', episodes: [], region: '' }
  }
}

// 动画搜索
async function findAnime(name) {
  try {
    let results = await searchAnime(name)
    if (results.length === 0) results = await searchAnimeJikan(name)
    if (results.length > 0) {
      return { coverImage: results[0].image || '', genres: results[0].genres || [] }
    }
  } catch {}
  return { coverImage: '', genres: [] }
}

// 电影搜索
async function findMovie(name) {
  try {
    const results = await searchMovies(name)
    if (results.length > 0) {
      return { coverImage: results[0].image || '' }
    }
  } catch {}
  return { coverImage: '' }
}

// 图书搜索
async function findBook(name, link) {
  // 从豆瓣链接构造封面 URL（浏览器直接加载可能绕过防盗链）
  if (link) {
    const m = link.match(/subject\/(\d+)/)
    if (m) {
      // 豆瓣图书封面 CDN 格式
      return { coverImage: `https://img9.doubanio.com/view/subject/l/public/s${m[1]}.jpg` }
    }
  }
  return { coverImage: '' }
}

// 推断分类（基于豆瓣链接和标题）
function inferCategory(item) {
  const link = item.link || item.parts?.[0]?.link || ''
  if (link.includes('book.douban.com')) return 'book'
  // 动画特征：标题含特定关键词
  const name = item.name || ''
  const animeKeywords = ['动画', 'OVA', 'OAD', '剧场版', '番', '物语', '传说',
    '间谍过家家', '辉夜大小姐', '进击的巨人', '咒术回战', '排球少年',
    '齐木楠雄', '野良神', '荒川爆笑团', '瑞克和莫蒂', '樱花庄',
    '东京食尸鬼', '星际牛仔', '只有我不在的街道', '为美好的世界献上祝福',
    '忧国的莫里亚蒂', '飞哥与小佛', '爱，死亡和机器人']
  if (animeKeywords.some(k => name.includes(k))) return 'animation'
  return 'tv'
}

// 检查剧集是否已存在
async function showExists(userId, name) {
  const { data } = await supabase
    .from('shows')
    .select('id')
    .eq('user_id', userId)
    .eq('name', name)
    .limit(1)
  return data && data.length > 0
}

// 创建 series
async function getOrCreateSeries(userId, name) {
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

// 插入单部剧集/电影
async function insertShow(userId, name, episodes, metadata) {
  const showData = {
    user_id: userId,
    name,
    avg_rating: metadata.avgRating || 0,
    rated_count: 0,
    total_episodes: episodes.length,
    category: metadata.category || '',
    region: metadata.region || '',
    genres: JSON.stringify(metadata.genres || []),
    cover_image: metadata.coverImage || '',
    author: metadata.author || '',
    status: metadata.status || 'want',
    start_date: null,
    finish_date: metadata.status === 'finished' ? new Date().toISOString().split('T')[0] : null,
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

  return show.id
}

// 进度回调
let onProgress = null

export function setImportProgressCallback(cb) {
  onProgress = cb
}

function report(msg, pct) {
  if (onProgress) onProgress(msg, pct)
}

// 跳过列表（用户已有的剧集）
const SKIP_NAMES = ['生活大爆炸']

// 仅补全图书封面
export async function fixBookCovers(data) {
  const userId = await getUserId()
  if (!userId) throw new Error('未登录')

  let fixed = 0
  const books = data.books || []

  for (const book of books) {
    if (!book.link) continue
    const m = book.link.match(/subject\/(\d+)/)
    if (!m) continue

    const coverUrl = `https://img9.doubanio.com/view/subject/l/public/s${m[1]}.jpg`

    const { data: existing } = await supabase
      .from('shows')
      .select('id, cover_image')
      .eq('user_id', userId)
      .eq('name', book.title)
      .eq('category', 'book')
      .limit(1)

    if (existing && existing.length > 0 && !existing[0].cover_image) {
      await supabase.from('shows').update({ cover_image: coverUrl }).eq('id', existing[0].id)
      fixed++
    }
  }

  return fixed
}

export async function importDoubanData(data) {
  const userId = await getUserId()
  if (!userId) throw new Error('未登录')

  const results = { tv: 0, movie: 0, book: 0, skipped: 0, errors: [] }
  const allItems = []

  // 1. 处理电视剧
  for (const show of data.tvShows) {
    if (SKIP_NAMES.includes(show.name)) {
      results.skipped++
      continue
    }
    allItems.push({ ...show, _category: inferCategory(show), _type: 'tv' })
  }

  // 2. 处理电影系列
  for (const series of data.movieSeries) {
    allItems.push({ ...series, _category: 'movie', _type: 'movieSeries' })
  }

  // 3. 处理独立电影
  for (const movie of data.standaloneMovies) {
    allItems.push({ ...movie, _category: 'movie', _type: 'movie' })
  }

  // 4. 处理图书
  for (const book of data.books) {
    allItems.push({ ...book, _category: 'book', _type: 'book' })
  }

  const total = allItems.length
  let done = 0

  // 分批处理
  for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
    const batch = allItems.slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map(async (item) => {
      try {
        await processItem(userId, item, results)
      } catch (e) {
        results.errors.push(`${item.name || item.title}: ${e.message}`)
      }
      done++
      report(`正在导入 ${done}/${total}...`, Math.round(done / total * 100))
    }))
    if (i + BATCH_SIZE < allItems.length) {
      await sleep(DELAY_MS)
    }
  }

  return results
}

async function processItem(userId, item, results) {
  if (item._type === 'tv') {
    await processTvShow(userId, item, results)
  } else if (item._type === 'movieSeries') {
    await processMovieSeries(userId, item, results)
  } else if (item._type === 'movie') {
    await processMovie(userId, item, results)
  } else if (item._type === 'book') {
    await processBook(userId, item, results)
  }
}

async function processTvShow(userId, show, results) {
  if (await showExists(userId, show.name)) {
    results.skipped++
    return
  }

  const maxSeason = Math.max(...show.seasons.map(s => s.season), 1)
  const avgRating = show.seasons.reduce((s, x) => s + (x.myRating || x.rating || 0), 0) / show.seasons.length

  // 搜索 API 获取封面和集数
  const apiData = await findTvShow(show.name)

  // 生成集数（每季默认 12 集，如果有 API 数据用 API 的）
  let episodes = apiData.episodes
  if (episodes.length === 0) {
    episodes = []
    for (let s = 1; s <= maxSeason; s++) {
      for (let e = 1; e <= 12; e++) {
        episodes.push({ season: s, episode: e })
      }
    }
  }

  // 创建 series
  let seriesId = null
  if (maxSeason > 1) {
    seriesId = await getOrCreateSeries(userId, show.name)
  }

  await insertShow(userId, show.name, episodes, {
    category: show._category,
    region: show.region || apiData.region,
    genres: show.genres,
    coverImage: apiData.coverImage,
    avgRating: Math.round(avgRating * 10) / 10,
    status: show.status,
    seriesId,
  })
  results.tv++
}

async function processMovieSeries(userId, series, results) {
  const seriesId = await getOrCreateSeries(userId, series.name)

  for (const part of series.parts) {
    if (await showExists(userId, part.title)) {
      results.skipped++
      continue
    }

    const apiData = await findMovie(part.title)
    await insertShow(userId, part.title, [{ season: 1, episode: 1 }], {
      category: 'movie',
      region: part.region || series.region,
      genres: part.genres || series.genres,
      coverImage: apiData.coverImage,
      avgRating: part.myRating || part.rating || 0,
      status: part.status || series.status,
      seriesId,
    })
    results.movie++
  }
}

async function processMovie(userId, movie, results) {
  if (await showExists(userId, movie.title)) {
    results.skipped++
    return
  }

  const apiData = await findMovie(movie.title)
  await insertShow(userId, movie.title, [{ season: 1, episode: 1 }], {
    category: 'movie',
    region: movie.region,
    genres: movie.genres,
    coverImage: apiData.coverImage,
    avgRating: movie.myRating || movie.rating || 0,
    status: movie.status,
  })
  results.movie++
}

async function processBook(userId, book, results) {
  if (await showExists(userId, book.title)) {
    results.skipped++
    return
  }

  const apiData = await findBook(book.title, book.link)
  await insertShow(userId, book.title, [{ season: 1, episode: 1 }], {
    category: 'book',
    region: '',
    genres: [],
    coverImage: apiData.coverImage,
    avgRating: book.myRating || book.rating || 0,
    status: book.status,
  })
  results.book++
}
