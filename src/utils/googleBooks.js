const GOOGLE_BOOKS_URL = 'https://www.googleapis.com/books/v1/volumes'
const IS_DEV = import.meta.env.DEV
const DOUBAN_URL = 'https://book.douban.com/j/subject_suggest'
const PROXY_URL = 'https://api.allorigins.win/raw?url='

function mapGoogleBooks(items) {
  return (items || []).slice(0, 10).map(item => {
    const info = item.volumeInfo || {}
    const imageLinks = info.imageLinks || {}
    return {
      id: item.id,
      name: info.title || '',
      authors: info.authors || [],
      genres: info.categories || [],
      image: imageLinks.thumbnail || imageLinks.smallThumbnail || null,
      publishedDate: info.publishedDate || '',
      pageCount: info.pageCount || 0,
      language: info.language || '',
      description: info.description || '',
      isbn: (info.industryIdentifiers || []).find(i => i.type === 'ISBN_13')?.identifier || '',
      source: 'google',
    }
  })
}

function mapDoubanBooks(data) {
  const items = (data || []).filter(item => item.type === 'b')
  return items.slice(0, 10).map(item => {
    const authorName = (item.author_name || '').trim()
    const authors = authorName ? authorName.split(/\s*\/\s*/) : []
    return {
      id: item.id,
      name: item.title || '',
      authors,
      genres: [],
      image: item.pic || null,
      publishedDate: item.year || '',
      pageCount: 0,
      language: '',
      description: '',
      isbn: '',
      source: 'douban',
    }
  })
}

async function searchGoogleBooks(query) {
  try {
    const res = await fetch(`${GOOGLE_BOOKS_URL}?q=${encodeURIComponent(query)}&maxResults=10&langRestrict=zh`)
    if (!res.ok) return []
    const data = await res.json()
    return mapGoogleBooks(data.items || [])
  } catch {
    return []
  }
}

async function searchDoubanBooks(query) {
  try {
    let res
    if (IS_DEV) {
      res = await fetch(`/api/douban-book/j/subject_suggest?q=${encodeURIComponent(query)}`)
    } else {
      res = await fetch(`${DOUBAN_URL}?q=${encodeURIComponent(query)}`)
      if (!res.ok) {
        res = await fetch(`${PROXY_URL}${encodeURIComponent(`${DOUBAN_URL}?q=${encodeURIComponent(query)}`)}`, { signal: AbortSignal.timeout(8000) })
      }
    }
    if (!res.ok) return []
    return mapDoubanBooks(await res.json())
  } catch {
    return []
  }
}

export async function searchBooks(query) {
  if (!query.trim()) return []

  const [googleResults, doubanResults] = await Promise.all([
    searchGoogleBooks(query),
    searchDoubanBooks(query),
  ])

  if (googleResults.length > 0) return googleResults
  if (doubanResults.length > 0) return doubanResults

  throw new Error('图书搜索失败，请检查网络')
}

export function buildBookChapters(totalChapters, volumes = 1) {
  const chapters = []
  if (volumes <= 1) {
    for (let i = 1; i <= (totalChapters || 1); i++) {
      chapters.push({ season: 1, episode: i })
    }
  } else {
    const perVolume = Math.ceil((totalChapters || 1) / volumes)
    for (let v = 1; v <= volumes; v++) {
      for (let c = 1; c <= perVolume; c++) {
        const chNum = (v - 1) * perVolume + c
        if (chNum <= totalChapters) {
          chapters.push({ season: v, episode: c })
        }
      }
    }
  }
  return chapters
}
