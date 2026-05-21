export const PREDEFINED_TAGS = [
  '剧情紧凑', '节奏慢', '演技炸裂', '特效震撼', '配乐好听',
  '反转精彩', '结尾烂', '太虐心', '太甜了', '笑点满满',
  '烧脑', '无聊', '催泪', '神作', '五星推荐',
]

export const CATEGORIES = [
  { key: 'movie', label: '电影' },
  { key: 'tv', label: '电视剧' },
  { key: 'animation', label: '动画' },
  { key: 'book', label: '图书' },
  { key: 'game', label: '游戏' },
]

export const SHOW_STATUSES = [
  { key: 'want', label: '想看', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' },
  { key: 'watching', label: '在看', color: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400' },
  { key: 'finished', label: '已看完', color: 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
  { key: 'dropped', label: '弃了', color: 'bg-red-100 text-red-500 dark:bg-red-900/40 dark:text-red-400' },
]

export const PREDEFINED_GENRES = [
  '爱情', '喜剧', '动作', '科幻', '悬疑', '恐怖',
  '犯罪', '奇幻', '冒险', '战争', '历史', '家庭',
  '青春', '职场', '音乐', '纪录片', '真人秀',
  '古装', '武侠', '仙侠', '谍战', '医疗', '律政',
  '体育', '美食', '旅行', '惊悚', '剧情', '传记',
]

export const MILESTONES = [
  { type: 'episodes', threshold: 50, label: '50集达成', message: '你已经观看了50集！继续加油！' },
  { type: 'episodes', threshold: 100, label: '百集里程碑', message: '100集！你是一个真正的追剧达人！' },
  { type: 'episodes', threshold: 200, label: '200集达成', message: '200集！观影量惊人！' },
  { type: 'episodes', threshold: 500, label: '500集大师', message: '500集！你是真正的影迷！' },
  { type: 'episodes', threshold: 1000, label: '千集传奇', message: '1000集！传奇般的观影量！' },
  { type: 'shows', threshold: 10, label: '10部达成', message: '已经看了10部作品，库存在壮大！' },
  { type: 'shows', threshold: 20, label: '20部达成', message: '20部作品！你的品味越来越广了！' },
  { type: 'shows', threshold: 50, label: '50部里程碑', message: '50部！你的影库真丰富！' },
  { type: 'shows', threshold: 100, label: '百部传奇', message: '100部作品！影迷中的影迷！' },
  { type: 'ratings', threshold: 20, label: '20条评分', message: '已经记录了20条评分，数据开始有参考价值了！' },
  { type: 'ratings', threshold: 50, label: '50条评分', message: '50条评分！你的评分体系越来越成熟了！' },
  { type: 'ratings', threshold: 100, label: '百评达人', message: '100条评分！你对自己的喜好了如指掌！' },
]

export const GAME_GENRES = [
  '动作', '冒险', '角色扮演', '策略', '射击', '竞速',
  '体育', '模拟', '解谜', '恐怖', '生存', '沙盒',
  '平台', '格斗', '卡牌', '独立', 'MMORPG', 'Roguelike',
  '视觉小说', '音游', '塔防', '战棋', '开放世界',
]

export const REGION_SUGGESTIONS = [
  '中国大陆', '美国', '英国', '日本', '韩国',
  '中国香港', '中国台湾', '泰国', '法国', '德国',
  '印度', '意大利', '西班牙', '加拿大', '澳大利亚',
]
