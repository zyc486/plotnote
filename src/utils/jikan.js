const BASE_URL = 'https://api.jikan.moe/v4'

export async function searchAnime(query) {
  if (!query.trim()) return []

  try {
    const res = await fetch(`${BASE_URL}/anime?q=${encodeURIComponent(query)}&limit=10&sfw=true`)
    if (!res.ok) throw new Error('Jikan API 请求失败')

    const data = await res.json()
    const items = data.data || []

    return items.map(item => ({
      id: item.mal_id,
      name: item.title || '',
      nativeName: item.title_japanese || '',
      englishName: item.title_english || '',
      episodes: item.episodes || 0,
      genres: (item.genres || []).map(g => g.name),
      status: item.status || '',
      image: item.images?.jpg?.image_url || null,
      score: item.score || 0,
      synopsis: item.synopsis || '',
      type: item.type || '',
      source: 'jikan',
    }))
  } catch (e) {
    console.warn('Jikan search failed:', e.message)
    return []
  }
}

export async function getAnimeById(malId) {
  try {
    const res = await fetch(`${BASE_URL}/anime/${malId}/full`)
    if (!res.ok) return null
    const data = await res.json()
    return data.data || null
  } catch {
    return null
  }
}

export async function getAnimeEpisodes(malId) {
  try {
    const res = await fetch(`${BASE_URL}/anime/${malId}/episodes`)
    if (!res.ok) return []
    const data = await res.json()
    return data.data || []
  } catch {
    return []
  }
}
