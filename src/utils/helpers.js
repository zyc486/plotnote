import { supabase } from './supabase'
import { CATEGORIES, SHOW_STATUSES } from '../constants'

let cachedUserId = null

export async function getUserId() {
  if (cachedUserId) return cachedUserId
  const { data: { user } } = await supabase.auth.getUser()
  cachedUserId = user?.id || null
  return cachedUserId
}

export function clearCachedUserId() {
  cachedUserId = null
}

export function parseGenres(show) {
  if (Array.isArray(show.genres)) return show.genres
  try { return JSON.parse(show.genres) } catch { return [] }
}

export function categoryLabel(key) {
  const cat = CATEGORIES.find(c => c.key === key)
  return cat ? cat.label : ''
}

export function statusLabel(key) {
  const s = SHOW_STATUSES.find(st => st.key === key)
  return s ? s.label : ''
}

export function statusColor(key) {
  const s = SHOW_STATUSES.find(st => st.key === key)
  return s ? s.color : ''
}

export function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
