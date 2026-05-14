const DRAFT_PREFIX = 'plotnote_draft_'

export function saveDraft(episodeId, data) {
  try {
    localStorage.setItem(DRAFT_PREFIX + episodeId, JSON.stringify({
      rating: data.rating,
      review: data.review,
      images: data.images || [],
      tags: data.tags || [],
      watchedDate: data.watchedDate || '',
      savedAt: Date.now(),
    }))
  } catch (e) {
    console.warn('Draft save failed:', e)
  }
}

export function loadDraft(episodeId) {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + episodeId)
    return raw ? JSON.parse(raw) : null
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
