import { OMDB_API_KEY } from '../config'

const BASE_URL = 'https://www.omdbapi.com/'

function getApiKey() {
  return localStorage.getItem('omdb_api_key') || OMDB_API_KEY || ''
}

export function setOmdbApiKey(key) {
  if (key) {
    localStorage.setItem('omdb_api_key', key)
  } else {
    localStorage.removeItem('omdb_api_key')
  }
}

export function getOmdbApiKey() {
  return getApiKey()
}

export function hasOmdbKey() {
  return !!getApiKey()
}

export async function getRatingsByImdbId(imdbId) {
  const key = getApiKey()
  if (!key || !imdbId) return null

  try {
    const res = await fetch(`${BASE_URL}?i=${encodeURIComponent(imdbId)}&apikey=${key}`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.Response === 'False') return null
    return parseRatings(data)
  } catch {
    return null
  }
}

export async function getRatingsByTitle(title, type, year) {
  const key = getApiKey()
  if (!key || !title) return null

  try {
    let url = `${BASE_URL}?t=${encodeURIComponent(title)}&apikey=${key}`
    if (type) url += `&type=${type}`
    if (year) url += `&y=${year}`

    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (data.Response === 'False') return null
    return parseRatings(data)
  } catch {
    return null
  }
}

function parseRatings(data) {
  const ratings = data.Ratings || []
  const rt = ratings.find(r => r.Source === 'Rotten Tomatoes')
  const metacritic = ratings.find(r => r.Source === 'Metacritic')

  return {
    imdbRating: data.imdbRating || '',
    imdbVotes: data.imdbVotes || '',
    rtRating: rt ? rt.Value : '',
    metacritic: metacritic ? metacritic.Value : '',
    poster: data.Poster && data.Poster !== 'N/A' ? data.Poster : '',
    title: data.Title || '',
    year: data.Year || '',
    plot: data.Plot || '',
    genre: data.Genre || '',
    director: data.Director || '',
    actors: data.Actors || '',
    imdbId: data.imdbID || '',
  }
}
