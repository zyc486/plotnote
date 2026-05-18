const fs = require('fs')
const https = require('https')

// 读取 markdown 文件
const content = fs.readFileSync('./S08.md', 'utf-8')

// 解析每集的评分和评价
const episodeRegex = /8-(\d+)（(\d+)分\s*(.*?)）/g
const episodes = []
let match

while ((match = episodeRegex.exec(content)) !== null) {
  const episode = parseInt(match[1])
  const rating = parseInt(match[2])
  const review = match[3].trim()
  episodes.push({ episode, rating, review })
}

console.log(`解析到 ${episodes.length} 集`)

// 从 TVMaze 获取封面
function fetchCover() {
  return new Promise((resolve) => {
    https.get('https://api.tvmaze.com/singlesearch/shows?q=the+big+bang+theory', (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const show = JSON.parse(data)
          resolve(show.image?.medium || '')
        } catch { resolve('') }
      })
    }).on('error', () => resolve(''))
  })
}

async function main() {
  const coverImage = await fetchCover()
  console.log('封面:', coverImage || '未获取到')

  const now = new Date().toISOString()
  const exportData = {
    version: 3,
    exportedAt: now,
    shows: [{
      id: 1,
      name: '生活大爆炸 第八季',
      avg_rating: Math.round(episodes.reduce((s, e) => s + e.rating, 0) / episodes.length * 10) / 10,
      rated_count: episodes.length,
      total_episodes: episodes.length,
      category: 'tv',
      region: '美国',
      genres: '["喜剧"]',
      cover_image: coverImage,
      status: 'finished',
      last_watched_at: now,
    }],
    episodes: episodes.map(ep => ({
      id: ep.episode,
      show_id: 1,
      season: 8,
      episode: ep.episode,
      active_record_id: ep.episode,
    })),
    records: episodes.map(ep => ({
      id: ep.episode,
      episode_id: ep.episode,
      rating: ep.rating,
      review: ep.review,
      images: '[]',
      tags: '[]',
      created_at: now,
      watched_date: '',
    })),
    tags: [],
    genreHistory: [],
    series: [],
  }

  fs.writeFileSync('./S08-import.json', JSON.stringify(exportData, null, 2))
  console.log('已生成 S08-import.json')
  console.log(`共 ${episodes.length} 集，平均分 ${exportData.shows[0].avg_rating}`)
}

main()
