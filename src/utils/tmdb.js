import { TMDB_API_KEY } from '../config'

const BASE_URL = 'https://api.tmdb.org/3'
const IMG_BASE = 'https://image.tmdb.org/t/p/w200'

const TMDB_GENRE_MAP = {
  28: '动作', 12: '冒险', 16: '动画', 35: '喜剧', 80: '犯罪',
  99: '纪录片', 18: '剧情', 10751: '家庭', 14: '奇幻', 36: '历史',
  27: '恐怖', 10402: '音乐', 9648: '悬疑', 10749: '爱情', 878: '科幻',
  10770: '剧情', 53: '惊悚', 10752: '战争', 37: '冒险',
}

const LANGUAGE_REGION_MAP = {
  'en': '美国', 'cn': '中国大陆', 'zh': '中国大陆', 'ja': '日本',
  'ko': '韩国', 'th': '泰国', 'fr': '法国', 'de': '德国',
  'es': '西班牙', 'hi': '印度', 'it': '意大利', 'ru': '俄罗斯',
  'pt': '巴西',
}

function buildFetchOptions(url) {
  const userKey = localStorage.getItem('tmdb_user_api_key') || ''
  if (userKey) {
    if (userKey.startsWith('eyJ')) {
      return { url, headers: { 'Authorization': `Bearer ${userKey}`, 'Content-Type': 'application/json' } }
    }
    const sep = url.includes('?') ? '&' : '?'
    return { url: `${url}${sep}api_key=${userKey}`, headers: {} }
  }
  return { url, headers: { 'Authorization': `Bearer ${TMDB_API_KEY}`, 'Content-Type': 'application/json' } }
}

export function hasCustomTmdbKey() {
  return !!localStorage.getItem('tmdb_user_api_key')
}

export function getTmdbApiKey() {
  return localStorage.getItem('tmdb_user_api_key') || ''
}

export function setTmdbApiKey(key) {
  if (key) {
    localStorage.setItem('tmdb_user_api_key', key)
  } else {
    localStorage.removeItem('tmdb_user_api_key')
  }
}

export async function searchMovies(query) {
  const { url, headers } = buildFetchOptions(
    `${BASE_URL}/search/movie?query=${encodeURIComponent(query)}&language=zh-CN&include_adult=false`
  )
  const res = await fetch(url, { headers })
  if (!res.ok) {
    if (res.status === 401) {
      if (hasCustomTmdbKey()) throw new Error('API Key 无效，请检查后重试')
      throw new Error('默认 Key 失效，请配置自己的 TMDB API Key')
    }
    throw new Error('TMDB API 请求失败')
  }

  const data = await res.json()
  const items = data.results || []

  return items.slice(0, 10).map(item => ({
    id: item.id,
    name: item.title || item.original_title || '',
    originalName: item.original_title || '',
    genres: (item.genre_ids || []).map(id => TMDB_GENRE_MAP[id]).filter(Boolean),
    rawGenreIds: item.genre_ids || [],
    image: item.poster_path ? `${IMG_BASE}${item.poster_path}` : null,
    language: item.original_language || '',
    releaseDate: item.release_date || '',
    overview: item.overview || '',
    region: LANGUAGE_REGION_MAP[item.original_language] || '',
    source: 'tmdb',
  }))
}

export function inferRegionFromLanguage(lang) {
  return LANGUAGE_REGION_MAP[lang] || ''
}

export async function findTvPoster(query) {
  try {
    const { url, headers } = buildFetchOptions(
      `${BASE_URL}/search/tv?query=${encodeURIComponent(query)}&language=zh-CN`
    )
    const res = await fetch(url, { headers })
    if (!res.ok) return null
    const data = await res.json()
    const item = data.results?.[0]
    return item?.poster_path ? `${IMG_BASE}${item.poster_path}` : null
  } catch {
    return null
  }
}

export async function searchTvShows(query) {
  const { url, headers } = buildFetchOptions(
    `${BASE_URL}/search/tv?query=${encodeURIComponent(query)}&language=zh-CN&include_adult=false`
  )
  const res = await fetch(url, { headers })
  if (!res.ok) {
    if (res.status === 401) {
      if (hasCustomTmdbKey()) throw new Error('API Key 无效，请检查后重试')
      throw new Error('默认 Key 失效，请配置自己的 TMDB API Key')
    }
    throw new Error('TMDB API 请求失败')
  }

  const data = await res.json()
  const items = data.results || []

  return items.slice(0, 10).map(item => ({
    id: item.id,
    name: item.name || item.original_name || '',
    originalName: item.original_name || '',
    cnName: item.name !== item.original_name ? item.name : null,
    genres: (item.genre_ids || []).map(id => TMDB_GENRE_MAP[id]).filter(Boolean),
    rawGenreIds: item.genre_ids || [],
    image: item.poster_path ? `${IMG_BASE}${item.poster_path}` : null,
    language: item.original_language || '',
    firstAirDate: item.first_air_date || '',
    overview: item.overview || '',
    region: LANGUAGE_REGION_MAP[item.original_language] || '',
    source: 'tmdb',
  }))
}

export async function getTvShowSeasons(tvId) {
  const { url, headers } = buildFetchOptions(
    `${BASE_URL}/tv/${tvId}?language=zh-CN`
  )
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error('获取剧集信息失败')
  const data = await res.json()

  const episodes = []
  for (const season of data.seasons || []) {
    if (season.season_number === 0) continue // 跳过特别篇
    const seasonUrl = buildFetchOptions(
      `${BASE_URL}/tv/${tvId}/season/${season.season_number}?language=zh-CN`
    )
    const seasonRes = await fetch(seasonUrl.url, { headers: seasonUrl.headers })
    if (!seasonRes.ok) continue
    const seasonData = await seasonRes.json()
    for (const ep of seasonData.episodes || []) {
      if (ep.episode_number > 0) {
        episodes.push({
          season: ep.season_number,
          episode: ep.episode_number,
          name: ep.name || '',
        })
      }
    }
  }
  return episodes
}

// 演职员信息
export async function getMovieCredits(movieId) {
  const { url, headers } = buildFetchOptions(
    `${BASE_URL}/movie/${movieId}/credits?language=zh-CN`
  )
  try {
    const res = await fetch(url, { headers })
    if (!res.ok) return { cast: [], crew: [] }
    const data = await res.json()
    const profileSize = 'w185'
    return {
      cast: (data.cast || []).slice(0, 12).map(p => ({
        name: p.name || '',
        character: p.character || '',
        profile: p.profile_path ? `https://image.tmdb.org/t/p/${profileSize}${p.profile_path}` : null,
      })),
      crew: (data.crew || [])
        .filter(p => ['Director', 'Writer', 'Screenplay', 'Producer', 'Executive Producer'].includes(p.job))
        .map(p => ({
          name: p.name || '',
          job: p.job || '',
          profile: p.profile_path ? `https://image.tmdb.org/t/p/${profileSize}${p.profile_path}` : null,
        })),
    }
  } catch {
    return { cast: [], crew: [] }
  }
}

export async function getTvCredits(tvId) {
  const { url, headers } = buildFetchOptions(
    `${BASE_URL}/tv/${tvId}/aggregate_credits?language=zh-CN`
  )
  try {
    const res = await fetch(url, { headers })
    if (!res.ok) return { cast: [], crew: [] }
    const data = await res.json()
    const profileSize = 'w185'
    return {
      cast: (data.cast || []).slice(0, 12).map(p => ({
        name: p.name || '',
        character: (p.roles || []).map(r => r.character).filter(Boolean).join(' / '),
        profile: p.profile_path ? `https://image.tmdb.org/t/p/${profileSize}${p.profile_path}` : null,
      })),
      crew: (data.crew || [])
        .filter(p => {
          const jobs = (p.jobs || []).map(j => j.job)
          return jobs.some(j => ['Director', 'Writer', 'Screenplay', 'Producer', 'Executive Producer', 'Creator'].includes(j))
        })
        .map(p => ({
          name: p.name || '',
          job: (p.jobs || []).map(j => j.job).filter(j => ['Director', 'Writer', 'Screenplay', 'Producer', 'Executive Producer', 'Creator'].includes(j))[0] || '',
          profile: p.profile_path ? `https://image.tmdb.org/t/p/${profileSize}${p.profile_path}` : null,
        })),
    }
  } catch {
    return { cast: [], crew: [] }
  }
}

export async function findShowCredits(name, category) {
  if (!name) return { cast: [], crew: [] }
  const { url, headers } = buildFetchOptions(
    category === 'movie'
      ? `${BASE_URL}/search/movie?query=${encodeURIComponent(name)}&language=zh-CN`
      : `${BASE_URL}/search/tv?query=${encodeURIComponent(name)}&language=zh-CN`
  )
  try {
    const res = await fetch(url, { headers })
    if (!res.ok) return { cast: [], crew: [] }
    const data = await res.json()
    const first = data.results?.[0]
    if (!first) return { cast: [], crew: [] }
    if (category === 'movie') {
      return getMovieCredits(first.id)
    } else {
      return getTvCredits(first.id)
    }
  } catch {
    return { cast: [], crew: [] }
  }
}

export async function findMoviePosterFallback(query) {
  try {
    const { url, headers } = buildFetchOptions(
      `${BASE_URL}/search/movie?query=${encodeURIComponent(query)}&language=zh-CN&include_adult=false`
    )
    const res = await fetch(url, { headers })
    if (!res.ok) return null
    const data = await res.json()
    const item = data.results?.[0]
    return item?.poster_path ? `${IMG_BASE}${item.poster_path}` : null
  } catch {
    return null
  }
}
