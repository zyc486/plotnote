const BASE_URL = 'https://openlibrary.org'

export async function searchBooksOpenLibrary(query) {
  if (!query.trim()) return []

  try {
    const res = await fetch(`${BASE_URL}/search.json?q=${encodeURIComponent(query)}&limit=10`)
    if (!res.ok) throw new Error('Open Library API 请求失败')

    const data = await res.json()
    const items = data.docs || []

    return items.map(item => {
      const coverId = item.cover_i
      return {
        id: item.key || '',
        name: item.title || '',
        authors: item.author_name || [],
        publishedDate: item.first_publish_year ? String(item.first_publish_year) : '',
        image: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null,
        imageLarge: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null,
        isbn: item.isbn?.[0] || '',
        pageCount: item.number_of_pages_median || 0,
        language: item.language?.[0] || '',
        publisher: item.publisher?.[0] || '',
        source: 'openlibrary',
      }
    })
  } catch (e) {
    console.warn('Open Library search failed:', e.message)
    return []
  }
}

export function getCoverUrlByIsbn(isbn, size = 'M') {
  if (!isbn) return null
  return `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg`
}
