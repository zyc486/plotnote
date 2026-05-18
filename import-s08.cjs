const https = require('https')

const SUPABASE_URL = 'lzpnvqzhmvifdomnwgsz.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6cG52cXpobXZpZmRvbW53Z3N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDExNzYsImV4cCI6MjA5NDU3NzE3Nn0.6rX5efbdBMq32p-spFeiDTL-HwNSZCkDFuDlW_d76ZA'

// 第八季评分数据
const ratings = {
  1: { rating: 6, review: '不是很喜欢吵架 可怜的霍华德' },
  2: { rating: 7, review: '结尾不错' },
  3: { rating: 8, review: '开球这段很好玩' },
  4: { rating: 5, review: '不好玩 笑点略低俗 可怜霍华德' },
  5: { rating: 7, review: '好玩 女生们那边有点奔放' },
  6: { rating: 8, review: '矿井好玩 霍华黛特好玩' },
  7: { rating: 7, review: '怪医生还挺好玩' },
  8: { rating: 8, review: '整体不错 温馨轻松 除了小霍' },
  9: { rating: 7, review: '谢尔顿还挺好的' },
  10: { rating: 8, review: '有意义 好玩' },
  11: { rating: 7, review: '圣诞节主题 但无尘室有点无聊' },
  12: { rating: 7, review: '整体不错 拉杰很好玩' },
  13: { rating: 8, review: '女朋友还是狗的游戏很好玩' },
  14: { rating: 8, review: '黑历史好看' },
  15: { rating: 10, review: '母亲去世 霍华德迈向成熟' },
  16: { rating: 9, review: '伯纳黛特成为了霍华德的守护神' },
  17: { rating: 6, review: '结尾有点吓人 整体略微无聊' },
  18: { rating: 9, review: '生命总会消逝 爱会永远延续' },
  19: { rating: 6, review: '乒乓球这段还挺好玩' },
  20: { rating: 7, review: '莱纳德佩妮这段不太好看' },
  21: { rating: 6, review: '略显无聊' },
  22: { rating: 8, review: '拉杰真的很好玩' },
  23: { rating: 7, review: '霍华德那边很好玩' },
  24: { rating: 9, review: '谢尔顿拿出戒指很感人' },
}

function api(path, method, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : ''
    const headers = {
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const url = new URL(path, `https://${SUPABASE_URL}`)
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers,
    }, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(body)
          if (res.statusCode >= 400) reject(new Error(json.message || body))
          else resolve(json)
        } catch { reject(new Error(body)) }
      })
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

async function main() {
  const email = process.argv[2]
  const password = process.argv[3]
  if (!email || !password) {
    console.log('用法: node import-s08.cjs 邮箱 密码')
    console.log('例如: node import-s08.cjs 123@qq.com 123456')
    return
  }

  console.log('=== 生活大爆炸第八季 评分导入工具 ===\n')

  // 登录
  console.log('\n登录中...')
  const loginRes = await api(`https://${SUPABASE_URL}/auth/v1/token?grant_type=password`, 'POST', { email, password })
  const token = loginRes.access_token
  const userId = loginRes.user.id
  console.log('登录成功!')

  // 查找生活大爆炸
  console.log('\n查找作品...')
  const shows = await api(`https://${SUPABASE_URL}/rest/v1/shows?name=like.*生活大爆炸*&user_id=eq.${userId}&select=id,name`, 'GET', null, token)
  if (!shows.length) {
    console.log('未找到生活大爆炸，请先在应用中添加该作品')
    return
    return
  }
  const showId = shows[0].id
  console.log(`找到: ${shows[0].name} (ID: ${showId})`)

  // 获取第八季剧集
  console.log('\n获取第八季剧集...')
  const episodes = await api(`https://${SUPABASE_URL}/rest/v1/episodes?show_id=eq.${showId}&season=eq.8&user_id=eq.${userId}&select=id,episode&order=episode`, 'GET', null, token)
  console.log(`找到 ${episodes.length} 集`)

  if (episodes.length === 0) {
    console.log('未找到第八季剧集')
    return
    return
  }

  // 导入评分
  console.log('\n导入评分...')
  let success = 0
  for (const ep of episodes) {
    const r = ratings[ep.episode]
    if (!r) continue

    try {
      const records = await api(`https://${SUPABASE_URL}/rest/v1/records`, 'POST', {
        user_id: userId,
        episode_id: ep.id,
        rating: r.rating,
        review: r.review,
        images: '[]',
        tags: '[]',
        watched_date: '',
      }, token)

      const record = records[0]
      await api(`https://${SUPABASE_URL}/rest/v1/episodes?id=eq.${ep.id}`, 'PATCH', { active_record_id: record.id }, token)
      console.log(`  第${String(ep.episode).padStart(2, '0')}集: ${r.rating}分 - ${r.review}`)
      success++
    } catch (e) {
      console.log(`  第${ep.episode}集失败: ${e.message}`)
    }
  }

  // 更新作品统计
  const avgRating = Math.round(Object.values(ratings).reduce((s, r) => s + r.rating, 0) / 24 * 10) / 10
  await api(`https://${SUPABASE_URL}/rest/v1/shows?id=eq.${showId}`, 'PATCH', {
    rated_count: success,
    avg_rating: avgRating,
  }, token)

  console.log(`\n导入完成! 成功 ${success}/24 集`)
  console.log(`平均分: ${avgRating}`)
  console.log('\n刷新页面查看结果')

  rl.close()
}

main().catch(e => {
  console.error('错误:', e.message)
  process.exit(1)
})
