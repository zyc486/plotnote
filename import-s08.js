// 在 PlotNote 页面的浏览器控制台中运行此脚本
// 前提：已登录，且已有"生活大爆炸"作品

async function importS08() {
  // 1. 查找生活大爆炸
  const { data: shows } = await supabase.from('shows').select('id,name').like('name', '%生活大爆炸%')
  if (!shows || shows.length === 0) {
    console.error('未找到生活大爆炸，请先添加该作品')
    return
  }
  const showId = shows[0].id
  console.log('找到作品:', shows[0].name, 'ID:', showId)

  // 2. 获取第八季的剧集
  const { data: episodes } = await supabase
    .from('episodes')
    .select('id,season,episode')
    .eq('show_id', showId)
    .eq('season', 8)
    .order('episode')

  if (!episodes || episodes.length === 0) {
    console.error('未找到第八季剧集')
    return
  }
  console.log(`找到 ${episodes.length} 集`)

  // 3. 第八季评分数据
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

  // 4. 为每集创建记录
  const { data: { user } } = await supabase.auth.getUser()
  let success = 0

  for (const ep of episodes) {
    const r = ratings[ep.episode]
    if (!r) continue

    // 插入记录
    const { data: record, error } = await supabase
      .from('records')
      .insert({
        user_id: user.id,
        episode_id: ep.id,
        rating: r.rating,
        review: r.review,
        images: '[]',
        tags: '[]',
        watched_date: '',
      })
      .select()
      .single()

    if (error) {
      console.error(`第${ep.episode}集失败:`, error.message)
    } else {
      // 设置为活跃记录
      await supabase.from('episodes').update({ active_record_id: record.id }).eq('id', ep.id)
      success++
    }
  }

  console.log(`导入完成！成功 ${success}/${episodes.length} 集`)

  // 5. 更新作品统计
  await supabase.from('shows').update({
    rated_count: success,
    avg_rating: Math.round(Object.values(ratings).reduce((s, r) => s + r.rating, 0) / Object.keys(ratings).length * 10) / 10,
  }).eq('id', showId)

  console.log('统计已更新，刷新页面查看')
}

importS08()
