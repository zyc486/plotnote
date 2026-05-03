const IS_DEV = import.meta.env.DEV
const DOUBAN_URL = 'https://book.douban.com/j/subject_suggest'
const PROXY_URL = 'https://api.allorigins.win/raw?url='

function mapBooks(data) {
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
      source: 'douban',
    }
  })
}

export async function searchBooks(query) {
  if (IS_DEV) {
    const res = await fetch(`/api/douban-book/j/subject_suggest?q=${encodeURIComponent(query)}`)
    if (!res.ok) throw new Error('豆瓣图书搜索请求失败')
    return mapBooks(await res.json())
  }

  try {
    const res = await fetch(`${DOUBAN_URL}?q=${encodeURIComponent(query)}`)
    if (!res.ok) throw new Error('请求失败')
    return mapBooks(await res.json())
  } catch {
    const proxyRes = await fetch(`${PROXY_URL}${encodeURIComponent(`${DOUBAN_URL}?q=${encodeURIComponent(query)}`)}`, { signal: AbortSignal.timeout(8000) })
    if (!proxyRes.ok) throw new Error('豆瓣图书搜索请求失败')
    return mapBooks(await proxyRes.json())
  }
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
