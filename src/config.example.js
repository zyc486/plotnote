// API Key 配置模板
// 复制此文件为 config.js 并填入你的真实 Key
// config.js 已在 .gitignore 中，不会被提交

// TMDB API Key（用于电影搜索）
// 已内置默认 Key，可替换为你自己的
// 支持两种格式：
//   - v3 API Key：32位字符串（如 '7157a16f4818bec98675eedca8405b79'）
//   - v4 Read Access Token：JWT 格式（以 'eyJ' 开头）
// 获取地址：https://www.themoviedb.org/settings/api
export const TMDB_API_KEY = ''

// OMDb API Key（用于 IMDB/烂番茄评分，免费额度 1000 次/天）
// 免费申请：omdbapi.com/apikey.aspx
export const OMDB_API_KEY = ''

// TasteDive API Key（用于作品推荐）
// 免费申请：tastedive.com/read/api
export const TASTEDIVE_API_KEY = ''

// GitHub 云同步配置
// Token 建议通过设置页面配置，会存储在浏览器 localStorage 中
export const GITHUB_TOKEN = ''
export const GITHUB_REPO = 'plotnote-data'
