const DRAFT_PREFIX = 'plotnote_draft_'
const MAX_DRAFTS = 20
const DRAFT_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

function cleanOldDrafts() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(DRAFT_PREFIX)) {
      keys.push(key)
    }
  }

  const entries = []
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const data = JSON.parse(raw)
        entries.push({ key, savedAt: data.savedAt || 0 })
      }
    } catch {
      // corrupted entry, remove it
      localStorage.removeItem(key)
    }
  }

  // Remove expired drafts
  const now = Date.now()
  for (const entry of entries) {
    if (now - entry.savedAt > DRAFT_TTL) {
      localStorage.removeItem(entry.key)
    }
  }

  // Remove oldest drafts if over limit
  const remaining = entries
    .filter(e => now - e.savedAt <= DRAFT_TTL)
    .sort((a, b) => b.savedAt - a.savedAt)

  if (remaining.length > MAX_DRAFTS) {
    for (const entry of remaining.slice(MAX_DRAFTS)) {
      localStorage.removeItem(entry.key)
    }
  }
}

export function saveDraft(episodeId, data) {
  try {
    cleanOldDrafts()
    // Don't store image data in drafts to avoid localStorage overflow
    const draftData = {
      rating: data.rating,
      review: data.review,
      tags: data.tags || [],
      watchedDate: data.watchedDate || '',
      savedAt: Date.now(),
    }
    localStorage.setItem(DRAFT_PREFIX + episodeId, JSON.stringify(draftData))
  } catch (e) {
    console.warn('Draft save failed:', e)
  }
}

export function loadDraft(episodeId) {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + episodeId)
    if (!raw) return null
    const data = JSON.parse(raw)
    // Check if draft is expired
    if (data.savedAt && Date.now() - data.savedAt > DRAFT_TTL) {
      localStorage.removeItem(DRAFT_PREFIX + episodeId)
      return null
    }
    return data
  } catch (e) {
    return null
  }
}

export function clearDraft(episodeId) {
  try {
    localStorage.removeItem(DRAFT_PREFIX + episodeId)
  } catch (e) {}
}

export function hasDraft(episodeId) {
  return localStorage.getItem(DRAFT_PREFIX + episodeId) !== null
}
