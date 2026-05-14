import { TASTEDIVE_API_KEY } from '../config'

const BASE_URL = 'https://tastedive.com/api/similar'

function getApiKey() {
  return localStorage.getItem('tastedive_api_key') || TASTEDIVE_API_KEY || ''
}

export function setTasteDiveApiKey(key) {
  if (key) {
    localStorage.setItem('tastedive_api_key', key)
  } else {
    localStorage.removeItem('tastedive_api_key')
  }
}

export function getTasteDiveApiKey() {
  return getApiKey()
}

export function hasTasteDiveKey() {
  return !!getApiKey()
}

export async function getRecommendations(query, type = 'all') {
  const key = getApiKey()
  if (!key || !query.trim()) return []

  try {
    const res = await fetch(
      `${BASE_URL}?q=${encodeURIComponent(query)}&type=${type}&k=${key}&limit=10&info=1`
    )
    if (!res.ok) throw new Error('TasteDive API 请求失败')

    const data = await res.json()
    const items = data.Similar?.Results || []

    return items.map(item => ({
      name: item.Name || '',
      type: item.Type || '',
      description: item.wTeaser || '',
      url: item.wUrl || '',
      imageUrl: item.yUrl || '',
    }))
  } catch (e) {
    console.warn('TasteDive search failed:', e.message)
    return []
  }
}
