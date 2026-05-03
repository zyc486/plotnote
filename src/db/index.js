import Dexie from 'dexie'

const db = new Dexie('PlotNote')

db.version(1).stores({
  shows: '++id, name',
  episodes: '++id, showId, season, episode',
  records: '++id, episodeId, rating, review, createdAt',
})

db.version(2).stores({
  shows: '++id, name, avgRating, ratedCount',
  episodes: '++id, showId, season, episode',
  records: '++id, episodeId, rating, createdAt',
  tags: '++id, name, isPredefined, usageCount',
})

db.version(3).stores({
  shows: '++id, name, avgRating, ratedCount, category, region',
  episodes: '++id, showId, season, episode',
  records: '++id, episodeId, rating, createdAt',
  tags: '++id, name, isPredefined, usageCount',
  genreHistory: '++id, name',
})

db.version(4).stores({
  shows: '++id, name, avgRating, ratedCount, category, region, seriesId',
  episodes: '++id, showId, season, episode',
  records: '++id, episodeId, rating, createdAt',
  tags: '++id, name, isPredefined, usageCount',
  genreHistory: '++id, name',
  series: '++id, name',
})

db.version(5).stores({
  shows: '++id, name, avgRating, ratedCount, category, region, seriesId, coverImage',
  episodes: '++id, showId, season, episode',
  records: '++id, episodeId, rating, createdAt',
  tags: '++id, name, isPredefined, usageCount',
  genreHistory: '++id, name',
  series: '++id, name',
})

db.version(6).stores({
  shows: '++id, name, avgRating, ratedCount, category, region, seriesId, coverImage, status, lastWatchedAt',
  episodes: '++id, showId, season, episode',
  records: '++id, episodeId, rating, createdAt, watchedDate',
  tags: '++id, name, isPredefined, usageCount',
  genreHistory: '++id, name',
  series: '++id, name',
})

db.version(7).stores({
  shows: '++id, name, avgRating, ratedCount, category, region, seriesId, coverImage, status, lastWatchedAt, author',
  episodes: '++id, showId, season, episode',
  records: '++id, episodeId, rating, createdAt, watchedDate',
  tags: '++id, name, isPredefined, usageCount',
  genreHistory: '++id, name',
  series: '++id, name',
})

const PREDEFINED_TAGS = [
  '剧情紧凑', '节奏慢', '演技炸裂', '特效震撼', '配乐好听',
  '反转精彩', '结尾烂', '太虐心', '太甜了', '笑点满满',
  '烧脑', '无聊', '催泪', '神作', '五星推荐',
]

const CATEGORIES = [
  { key: 'movie', label: '电影' },
  { key: 'tv', label: '电视剧' },
  { key: 'animation', label: '动画' },
  { key: 'book', label: '图书' },
]

const SHOW_STATUSES = [
  { key: 'want', label: '想看', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' },
  { key: 'watching', label: '在看', color: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400' },
  { key: 'finished', label: '已看完', color: 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
  { key: 'dropped', label: '弃了', color: 'bg-red-100 text-red-500 dark:bg-red-900/40 dark:text-red-400' },
]

const PREDEFINED_GENRES = [
  '爱情', '喜剧', '动作', '科幻', '悬疑', '恐怖',
  '犯罪', '奇幻', '冒险', '战争', '历史', '家庭',
  '青春', '职场', '音乐', '纪录片', '真人秀',
  '古装', '武侠', '仙侠', '谍战', '医疗', '律政',
  '体育', '美食', '旅行', '惊悚', '剧情', '传记',
]

const REGION_SUGGESTIONS = [
  '中国大陆', '美国', '英国', '日本', '韩国',
  '中国香港', '中国台湾', '泰国', '法国', '德国',
  '印度', '意大利', '西班牙', '加拿大', '澳大利亚',
]

export { db, PREDEFINED_TAGS, CATEGORIES, SHOW_STATUSES, PREDEFINED_GENRES, REGION_SUGGESTIONS }
