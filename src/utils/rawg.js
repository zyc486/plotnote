import { RAWG_API_KEY } from '../config'

const BASE = 'https://api.rawg.io/api'

function getKey() {
  return RAWG_API_KEY
}

export function hasRawgKey() {
  return !!getKey()
}

export function setRawgApiKey(key) {
  localStorage.setItem('plotnote_rawg_key', key)
}

export function getRawgApiKey() {
  return localStorage.getItem('plotnote_rawg_key') || getKey()
}

function getEffectiveKey() {
  return localStorage.getItem('plotnote_rawg_key') || getKey()
}

export async function searchGames(query) {
  const key = getEffectiveKey()
  if (!key) return []

  const res = await fetch(`${BASE}/games?key=${key}&search=${encodeURIComponent(query)}&page_size=10&search_precise=true`)
  if (!res.ok) return []

  const data = await res.json()
  return (data.results || []).map(g => ({
    id: g.id,
    name: g.name,
    image: g.background_image || '',
    released: g.released || '',
    rating: g.rating || 0,
    platforms: (g.platforms || []).map(p => p.platform?.name).filter(Boolean),
    genres: (g.genres || []).map(genre => genre.name).filter(Boolean),
    esrbRating: g.esrb_rating?.name || '',
  }))
}

export async function getGameDetails(gameId) {
  const key = getEffectiveKey()
  if (!key) return null

  const res = await fetch(`${BASE}/games/${gameId}?key=${key}`)
  if (!res.ok) return null

  const g = await res.json()
  return {
    id: g.id,
    name: g.name,
    image: g.background_image || '',
    released: g.released || '',
    rating: g.rating || 0,
    platforms: (g.platforms || []).map(p => p.platform?.name).filter(Boolean),
    genres: (g.genres || []).map(genre => genre.name).filter(Boolean),
    developers: (g.developers || []).map(d => d.name).filter(Boolean),
    publishers: (g.publishers || []).map(p => p.name).filter(Boolean),
    description: g.description_raw || '',
    esrbRating: g.esrb_rating?.name || '',
    website: g.website || '',
  }
}
