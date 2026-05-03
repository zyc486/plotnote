const BASE_URL = 'https://api.tvmaze.com'

const CN_TO_EN = {
  '老友记': 'Friends',
  '生活大爆炸': 'The Big Bang Theory',
  '权力的游戏': 'Game of Thrones',
  '绝命毒师': 'Breaking Bad',
  '行尸走肉': 'The Walking Dead',
  '纸牌屋': 'House of Cards',
  '怪奇物语': 'Stranger Things',
  '黑镜': 'Black Mirror',
  '西部世界': 'Westworld',
  '风骚律师': 'Better Call Saul',
  '越狱': 'Prison Break',
  '迷失': 'Lost',
  '英雄': 'Heroes',
  '24小时': '24',
  '国土安全': 'Homeland',
  '美国恐怖故事': 'American Horror Story',
  '真探': 'True Detective',
  '黑客军团': 'Mr. Robot',
  '使女的故事': 'The Handmaid\'s Tale',
  '王冠': 'The Crown',
  '切尔诺贝利': 'Chernobyl',
  '曼达洛人': 'The Mandalorian',
  '猎魔人': 'The Witcher',
  '鱿鱼游戏': 'Squid Game',
  '半泽直树': 'Hanzawa Naoki',
  '东京爱情故事': 'Tokyo Love Story',
  '深夜食堂': 'Midnight Diner',
  '非自然死亡': 'Unnatural',
  '逃避虽可耻但有用': 'We Married as a Job',
  '轮到你了': 'Your Turn to Kill',
  '弥留之国的爱丽丝': 'Alice in Borderland',
  '沉默的真相': 'The Long Night',
  '隐秘的角落': 'The Bad Kids',
  '开端': 'Reset',
  '人世间': 'A Lifelong Journey',
  '狂飙': 'The Knockout',
  '三体': 'Three-Body',
  '琅琊榜': 'Nirvana in Fire',
  '甄嬛传': 'Empresses in the Palace',
  '庆余年': 'Joy of Life',
  '陈情令': 'The Untamed',
  '苍兰诀': 'Love Between Fairy and Devil',
  '长相思': 'Lost You Forever',
  '知否知否应是绿肥红瘦': 'The Story of Ming Lan',
  '延禧攻略': 'Story of Yanxi Palace',
  '如懿传': 'Ruyi\'s Royal Love in the Palace',
  '都挺好': 'All is Well',
  '欢乐颂': 'Ode to Joy',
  '我的前半生': 'The First Half of My Life',
  '白夜追凶': 'Day and Night',
  '无证之罪': 'Burning Ice',
  '河神': 'Tientsin Mystic',
  '鬼吹灯': 'Candle in the Tomb',
  '盗墓笔记': 'The Lost Tomb',
  '哈利波特': 'Harry Potter',
  '指环王': 'Lord of the Rings',
  '星球大战': 'Star Wars',
  '漫威': 'Marvel',
  '复仇者联盟': 'Avengers',
  '蝙蝠侠': 'Batman',
  '超人': 'Superman',
  '蜘蛛侠': 'Spider-Man',
  '黑豹': 'Black Panther',
  '洛基': 'Loki',
  '旺达幻视': 'WandaVision',
  '鹰眼': 'Hawkeye',
  '月光骑士': 'Moon Knight',
  '女浩克': 'She-Hulk',
  '秘密入侵': 'Secret Invasion',
  '风声': 'The Message',
  '开端': 'Reset',
  '想见你': 'Someday or One Day',
  '我们与恶的距离': 'The World Between Us',
  '俗女养成记': 'The Making of an Ordinary Woman',
  '华灯初上': 'Light the Night',
  '茶金': 'Gold Leaf',
  '她和她的她': 'Shards of Her',
  '模仿犯': 'Copycat Killer',
  '谁是被害者': 'The Victims\' Game',
  '你的孩子不是你的孩子': 'On Children',
  '摩登家庭': 'Modern Family',
  '老爸老妈的浪漫史': 'How I Met Your Mother',
  '办公室': 'The Office',
  '公园与游憩': 'Parks and Recreation',
  '实习医生格蕾': 'Grey\'s Anatomy',
  '豪斯医生': 'House',
  '犯罪心理': 'Criminal Minds',
  '法律与秩序': 'Law & Order',
  '海军罪案调查处': 'NCIS',
  '神探夏洛克': 'Sherlock',
  '唐顿庄园': 'Downton Abbey',
  '黑袍纠察队': 'The Boys',
  '西部世界': 'Westworld',
  '亚特兰大': 'Atlanta',
  '继承之战': 'Succession',
  '白莲花度假村': 'The White Lotus',
  '最后生还者': 'The Last of Us',
  '龙之家族': 'House of the Dragon',
  '指环王：力量之戒': 'The Lord of the Rings: The Rings of Power',
  '安多': 'Andor',
  '欧比旺': 'Obi-Wan Kenobi',
  '波巴费特之书': 'The Book of Boba Fett',
  '爱死机器人': 'Love, Death & Robots',
  '瑞克和莫蒂': 'Rick and Morty',
  '南方公园': 'South Park',
  '辛普森一家': 'The Simpsons',
  '恶搞之家': 'Family Guy',
  '飞出个未来': 'Futurama',
  '马男波杰克': 'BoJack Horseman',
  '怪诞小镇': 'Gravity Falls',
  '阿凡达：最后的气宗': 'Avatar: The Last Airbender',
  '降世神通': 'Avatar: The Last Airbender',
  '进击的巨人': 'Attack on Titan',
  '鬼灭之刃': 'Demon Slayer',
  '咒术回战': 'Jujutsu Kaisen',
  '海贼王': 'One Piece',
  '火影忍者': 'Naruto',
  '龙珠': 'Dragon Ball',
  '名侦探柯南': 'Detective Conan',
  '死神': 'Bleach',
  '猎人': 'Hunter x Hunter',
  '钢之炼金术师': 'Fullmetal Alchemist',
  '新世纪福音战士': 'Neon Genesis Evangelion',
  '攻壳机动队': 'Ghost in the Shell',
  '银魂': 'Gintama',
  '一拳超人': 'One Punch Man',
  '我的英雄学院': 'My Hero Academia',
  '间谍过家家': 'Spy x Family',
  '电锯人': 'Chainsaw Man',
  '葬送的芙莉莲': 'Frieren: Beyond Journey\'s End',
}

function findEnglishNames(query) {
  const q = query.trim().toLowerCase()
  const results = []
  for (const [cn, en] of Object.entries(CN_TO_EN)) {
    if (cn.includes(query.trim()) || q.includes(cn.toLowerCase())) {
      results.push({ cn, en })
    }
  }
  return results
}

export async function searchShows(query) {
  const trimmed = query.trim()
  if (!trimmed) return []

  let allResults = []

  const cnMatches = findEnglishNames(trimmed)
  for (const match of cnMatches) {
    try {
      const res = await fetch(`${BASE_URL}/search/shows?q=${encodeURIComponent(match.en)}`)
      if (res.ok) {
        const data = await res.json()
        const mapped = data.map(item => ({
          id: item.show.id,
          name: item.show.name,
          cnName: match.cn,
          language: item.show.language,
          genres: item.show.genres || [],
          status: item.show.status,
          premiered: item.show.premiered,
          image: item.show.image?.medium || null,
          summary: item.show.summary || '',
        }))
        allResults.push(...mapped)
      }
    } catch {}
  }

  const directRes = await fetch(`${BASE_URL}/search/shows?q=${encodeURIComponent(trimmed)}`)
  if (directRes.ok) {
    const directData = await directRes.json()
    const directMapped = directData.map(item => ({
      id: item.show.id,
      name: item.show.name,
      cnName: null,
      language: item.show.language,
      genres: item.show.genres || [],
      status: item.show.status,
      premiered: item.show.premiered,
      image: item.show.image?.medium || null,
      summary: item.show.summary || '',
    }))
    allResults.push(...directMapped)
  }

  const seen = new Set()
  allResults = allResults.filter(item => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })

  return allResults
}

export async function getShowEpisodes(showId) {
  const res = await fetch(`${BASE_URL}/shows/${showId}/episodes`)
  if (!res.ok) throw new Error('获取剧集信息失败')
  const data = await res.json()
  return data.map(ep => ({
    season: ep.season,
    episode: ep.number,
    name: ep.name,
    airdate: ep.airdate,
  }))
}

export function buildEpisodesFromApi(episodes) {
  const result = []
  for (const ep of episodes) {
    if (ep.season > 0 && ep.episode > 0) {
      result.push({ season: ep.season, episode: ep.episode })
    }
  }
  return result
}

const GENRE_MAP = {
  'Romance': '爱情',
  'Comedy': '喜剧',
  'Drama': '剧情',
  'Action': '动作',
  'Science-Fiction': '科幻',
  'Thriller': '惊悚',
  'Horror': '恐怖',
  'Crime': '犯罪',
  'Mystery': '悬疑',
  'Fantasy': '奇幻',
  'Adventure': '冒险',
  'War': '战争',
  'History': '历史',
  'Family': '家庭',
  'Music': '音乐',
  'Documentary': '纪录片',
  'Reality': '真人秀',
  'Sports': '体育',
  'Supernatural': '奇幻',
  'Medical': '医疗',
  'Legal': '律政',
  'Western': '冒险',
  'Anime': '动画',
  'Espionage': '谍战',
}

const LANGUAGE_REGION_MAP = {
  'English': '美国',
  'Chinese': '中国大陆',
  'Japanese': '日本',
  'Korean': '韩国',
  'Thai': '泰国',
  'French': '法国',
  'German': '德国',
  'Spanish': '西班牙',
  'Hindi': '印度',
  'Italian': '意大利',
}

export function mapGenresToChinese(englishGenres) {
  if (!englishGenres?.length) return []
  const mapped = []
  for (const g of englishGenres) {
    const cn = GENRE_MAP[g]
    if (cn && !mapped.includes(cn)) mapped.push(cn)
  }
  return mapped
}

export function inferRegionFromLanguage(language) {
  return LANGUAGE_REGION_MAP[language] || ''
}
