// API Key 配置文件
// 从 .env 文件读取环境变量（使用 Vite 的 import.meta.env）
// 复制 .env.example 为 .env 并填入你的真实 Key

// Supabase 配置
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lzpnvqzhmvifdomnwgsz.supabase.co'
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || atob('ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKemRYQmhZbUZ6WlNJc0luSmxaaUk2SW14NmNHNTJjWHBvYlhacFptUnZiVzUzWjNONklpd2ljbTlzWlNJNkltRnViMjRpTENKcFlYUWlPakUzTnprd01ERXhOellzSW1WNGNDSTZNakE1TkRVM056RTNObjAuNnJYNWVmYmRCTXEzMnAtc3BGZWlEVEwtSHdOU1pDa0RGdURsV19kNzZaQQ==')

// TMDB API Key（已内置默认 Key，可替换为你自己的）
export const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJlMjY4ZTRhYTQzMWU3YjIzM2Y4MTY3NGVkYTg3OThiZSIsIm5iZiI6MTc3ODc3NDAwMC42MDYwMDAyLCJzdWIiOiI2YTA1ZWZmMDY0NmZmMTFhOWFlMDg5NTEiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.WTgW_R2I0eweEraIJVcxvIphCEYgpo2X6eMqACDDus4'

// OMDb API Key（免费申请: omdbapi.com/apikey.aspx）
export const OMDB_API_KEY = import.meta.env.VITE_OMDB_API_KEY || ''

// TasteDive API Key（免费申请: tastedive.com/read/api）
export const TASTEDIVE_API_KEY = import.meta.env.VITE_TASTEDIVE_API_KEY || ''

// GitHub 云同步配置
// Token 建议通过设置页面配置，会存储在浏览器 localStorage 中
export const GITHUB_TOKEN = ''
export const GITHUB_REPO = 'plotnote-data'
