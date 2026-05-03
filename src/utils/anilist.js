const ANILIST_URL = 'https://graphql.anilist.co'

const GENRE_MAP = {
  'Romance': '爱情', 'Comedy': '喜剧', 'Drama': '剧情',
  'Action': '动作', 'Sci-Fi': '科幻', 'Thriller': '惊悚',
  'Horror': '恐怖', 'Mystery': '悬疑', 'Fantasy': '奇幻',
  'Adventure': '冒险', 'Sports': '体育', 'Music': '音乐',
  'Supernatural': '奇幻', 'Slice of Life': '家庭', 'Ecchi': '剧情',
  'Mahou Shoujo': '奇幻', 'Mecha': '科幻', 'Suspense': '悬疑',
}

export async function searchAnime(query) {
  const gql = `query ($search: String) {
    Page(page: 1, perPage: 10) {
      media(search: $search, type: ANIME) {
        id
        title { romaji native english }
        episodes
        genres
        status
        coverImage { medium }
        format
        countryOfOrigin
      }
    }
  }`

  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: gql, variables: { search: query } }),
  })

  if (!res.ok) throw new Error('AniList API 请求失败')

  const data = await res.json()
  const items = data.data?.Page?.media || []

  return items.map(item => ({
    id: item.id,
    name: item.title.romaji || item.title.native || item.title.english || '',
    nativeName: item.title.native || '',
    englishName: item.title.english || '',
    episodes: item.episodes || 0,
    genres: (item.genres || []).map(g => GENRE_MAP[g] || g),
    rawGenres: item.genres || [],
    status: item.status,
    image: item.coverImage?.medium || null,
    format: item.format,
    source: 'anilist',
  }))
}

export function buildAnimeEpisodes(totalEpisodes, seasons = 1) {
  const eps = []
  if (seasons <= 1) {
    for (let i = 1; i <= (totalEpisodes || 12); i++) {
      eps.push({ season: 1, episode: i })
    }
  } else {
    const perSeason = Math.ceil((totalEpisodes || 12) / seasons)
    for (let s = 1; s <= seasons; s++) {
      for (let e = 1; e <= perSeason; e++) {
        const epNum = (s - 1) * perSeason + e
        if (epNum <= totalEpisodes) {
          eps.push({ season: s, episode: e })
        }
      }
    }
  }
  return eps
}
