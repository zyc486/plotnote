# PlotNote 优化方案

> 从代码质量、用户体验、功能完成度三个维度分析，按优先级排序。

---

## 一、代码质量优化

### 1.1 【高优】统一数据访问层，消除裸调 supabase

**现状**：Stores 中定义了 `fetchEpisodes`、`fetchShows`、`fetchEpisodeRecords` 等方法，但以下页面绕过了 store，直接裸调 `supabase.from(...)`：

| 文件 | 裸调位置 |
|---|---|
| `src/pages/EpisodeList.vue:104-126` | 直接查 episodes + records |
| `src/pages/Search.vue:55-57` | 一次性拉全量 shows + episodes + records |
| `src/pages/Statistics.vue:94-96` | 同上 |
| `src/pages/Timeline.vue:52-54` | 同上 |

**问题**：
- 数据获取逻辑分散在 6+ 个文件中，修改查询逻辑需要改多处
- 本地组件状态与 Pinia store 状态不同步，同一数据存了两份
- snake_case → camelCase 转换逻辑重复（`toCamel` 在 store 和页面中各写一遍）
- 难以统一加缓存层、错误处理、重试逻辑

**改进方案**：

1. 在对应 store 中补齐缺失的查询方法：

```js
// src/stores/episodes.js — 补充
async function fetchEpisodesWithRecords(showId) {
  const userId = await getUserId()
  await fetchEpisodes(showId)  // 先获取 episodes

  // 批量获取 records
  const episodeIds = episodes.value.map(e => e.id)
  if (!episodeIds.length) return

  const { data: records } = await supabase
    .from('records')
    .select('*')
    .in('episode_id', episodeIds)
    .eq('user_id', userId)

  // 构建 Map 方便查找
  const recordsByEpisode = {}
  for (const r of (records || [])) {
    if (!recordsByEpisode[r.episode_id]) recordsByEpisode[r.episode_id] = []
    recordsByEpisode[r.episode_id].push(r)
  }
  return { episodes: episodes.value, recordsByEpisode }
}

// src/stores/shows.js — 补充全量查询（供统计/搜索/时间线用）
async function fetchAllData() {
  const userId = await getUserId()
  const [showsRes, episodesRes, recordsRes] = await Promise.all([
    supabase.from('shows').select('*').eq('user_id', userId),
    supabase.from('episodes').select('*').eq('user_id', userId),
    supabase.from('records').select('*').eq('user_id', userId),
  ])
  return {
    shows: (showsRes.data || []).map(toCamel),
    episodes: episodesRes.data || [],
    records: recordsRes.data || [],
  }
}
```

2. 修改所有页面：删除裸调代码，改为从 store 获取数据。

---

### 1.2 【高优】拆分大组件

**现状**：

| 组件 | 行数 | 职责 |
|---|---|---|
| `EpisodeRecord.vue` | ~800 | 评分 + 感想编辑 + 图片 + 多刷列表 + 选集面板 + 外部评分 + 防抖保存 |
| `ShowList.vue` | ~960 | 列表渲染 + 搜索添加 + 手动添加 + 编辑元数据 + 系列折叠 + 封面补全 |

**改进方案**：

从 `EpisodeRecord.vue` 中抽离：

```
src/components/
├── RatingPanel.vue          # 评分卡片（星标 + 滑块 + 快捷分档 + 数字输入）
├── ExternalRatings.vue      # 外部评分展示（IMDb/烂番茄/Metacritic）
├── WatchDatePicker.vue      # 观看日期选择
├── ReviewEditor.vue         # 感想编辑器（TipTap + 格式工具栏）
├── RewatchList.vue          # 多刷记录列表
├── EpisodeGrid.vue          # 右侧选集卡片网格
└── BottomNav.vue            # 底部上一集/下一集导航
```

从 `ShowList.vue` 中抽离：

```
src/components/
├── ShowCard.vue             # 单个作品卡片
├── SeriesCard.vue           # 系列卡片
├── AddShowModal.vue         # 添加弹窗（搜索 + 手动）
├── EditMetaModal.vue        # 编辑元数据弹窗
├── CategoryFilter.vue       # 分类/状态/排序过滤栏
└── StatusDropdown.vue       # 状态切换下拉
```

**拆分原则**：
- 每个组件只做一件事，props 进 events 出
- 业务逻辑留在页面层（或 store），组件保持纯展示 + 简单交互
- 不要为了拆分而拆分，3 个以内相似元素可以先不抽

---

### 1.3 【高优】删除死代码或启用 Dexie 离线缓存

**现状**：`src/db/index.js` 定义了完整的 Dexie schema（9 张表、7 个版本迁移），但全局搜索发现 Dexie 从未在任何 store 或页面中被 import 使用。

**方案 A：删除（如果不需要离线）**

```bash
npm uninstall dexie
rm src/db/index.js
```

同时清理 `package.json` 中的 dexie 依赖。

**方案 B：启用为离线缓存层（推荐）**

Dexie 作为本地优先存储，Supabase 作为云端同步：

```js
// src/db/sync.js — 离线优先的同步策略
import { db } from './index'
import { supabase } from '../utils/supabase'

// 写入：同时写本地和云端
async function saveRecord(data) {
  // 1. 立即写入本地 IndexedDB（毫秒级）
  const localId = await db.records.put(data)
  // 2. 异步同步到 Supabase
  syncToCloud(data).catch(err => {
    // 标记为待同步
    await db.pendingSync.put({ table: 'records', localId, action: 'create', data })
  })
  return localId
}

// 读取：优先本地，后台刷新
async function getRecords(episodeId) {
  // 1. 立即返回本地缓存
  const local = await db.records.where('episodeId').equals(episodeId).toArray()
  // 2. 后台拉取云端更新本地
  fetchFromCloud(episodeId).then(cloud => {
    db.records.bulkPut(cloud)  // 静默更新本地
  })
  return local
}

// 重试待同步队列
async function retryPendingSync() {
  const pending = await db.pendingSync.toArray()
  for (const item of pending) {
    try {
      await syncToCloud(item.data)
      await db.pendingSync.delete(item.localId)
    } catch {}
  }
}
```

离线缓存的价值：
- 断网时正常读写（地铁、飞机上写感想）
- 页面切换瞬间展示（不需要每次 loading）
- 减少 Supabase 请求量（免费额度有限）

---

### 1.4 【中优】消除重复工具函数

**现状**：以下函数在 4-5 个文件中各定义了一遍：

| 函数 | 重复位置 |
|---|---|
| `parseGenres` | EpisodeList.vue, ShowList.vue, Search.vue |
| `categoryLabel` | EpisodeList.vue, ShowList.vue, Search.vue, Statistics.vue, Timeline.vue |
| `statusLabel` / `statusColor` | EpisodeList.vue, ShowList.vue |
| `episodeLabel` | Search.vue, Statistics.vue, Timeline.vue |

而 `src/utils/helpers.js` 中已经导出了 `parseGenres`、`categoryLabel`、`statusLabel`、`statusColor`。`src/utils/terminology.js` 导出了 `episodeLabel`。

**改进方案**：

全量替换为统一导入，只此一步：

```js
// 在所有页面中统一改为
import { parseGenres, categoryLabel, statusLabel, statusColor } from '../utils/helpers'
import { episodeLabel } from '../utils/terminology'
```

> 注意：`EpisodeRecord.vue:469` 自己定义了一个 `formatDate` 函数，也可以考虑放到 `helpers.js` 中统一。

---

### 1.5 【低优】引入 TypeScript（按需渐进）

**当前风险**：
- `toCamel` 这类字段映射函数，字段名拼写错误只能在运行时暴露
- Supabase 返回的 `data` 类型是 `any`，IDE 无法自动补全
- `records` 的 `tags`/`images` 字段是 JSON 字符串，运行时手动 `JSON.parse`，类型不明确

**渐进方案**（不要求一次性全转）：

```ts
// src/types/database.ts — 先定义核心类型
export interface Show {
  id: number
  user_id: string
  name: string
  avg_rating: number
  rated_count: number
  total_episodes: number
  category: string
  region: string
  genres: string  // JSON string
  cover_image: string
  author: string
  status: string
  series_id: number | null
  start_date: string | null
  finish_date: string | null
  last_watched_at: string | null
}

export interface Episode {
  id: number
  user_id: string
  show_id: number
  season: number
  episode: number
  active_record_id: number | null
}

export interface Record {
  id: number
  user_id: string
  episode_id: number
  rating: number
  review: string
  images: string  // JSON string
  tags: string    // JSON string
  created_at: string
  watched_date: string
}
```

然后在 `vite.config.js` 中启用 `@vitejs/plugin-vue` 的 TS 支持（已内置），从 store 文件开始逐文件加 `<script setup lang="ts">`。

---

### 1.6 【中优】搜索页改为服务端过滤

**现状**：`Search.vue` 的 `doSearch()` 每次拉取用户全部 shows + episodes + records（三张表全量），然后在客户端循环过滤。数据量上千条时：

- 首屏加载：三张表总计可能 10MB+，移动网络下加载数秒
- 每次输入都重新拉全量（虽然有防抖，但 payload 太大）

**改进方案**：

利用 Supabase 的 `ilike()` 做服务端过滤：

```js
// 替代当前的 doSearch 中的全量拉取
async function doSearch() {
  const q = query.value.trim().toLowerCase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // 1. 按名称搜索 shows（服务端过滤）
  if (q) {
    const { data: shows } = await supabase
      .from('shows')
      .select('*')
      .eq('user_id', user.id)
      .ilike('name', `%${q}%`)
      .limit(20)
    // ...
  }

  // 2. 按 review 内容搜索 records（服务端过滤）
  if (q) {
    const { data: records } = await supabase
      .from('records')
      .select('*, episodes!inner(show_id, shows!inner(name))')
      .eq('user_id', user.id)
      .ilike('review', `%${q}%`)
      .limit(20)
    // ...
  }
}
```

> 注意：`tags` 和 `genres` 存储为 JSON 字符串，Supabase 的 `ilike` 也可以模糊匹配 JSON 字符串，但精确度有限。更好的方案是将 tags 拆为关联表（见 1.7）。

---

### 1.7 【低优】tags/genres 存储规范化

**现状**：`records.tags` 和 `shows.genres` 以 JSON 字符串存储（`JSON.stringify(['标签1', '标签2'])`）。导致：
- 无法在数据库层做精确的标签筛选
- 无法统计标签使用频率
- 存储冗余（同一标签名在每条记录里重复存）

**改进方案**：

如果后续需要复杂的标签功能，可以拆表：

```sql
-- 标签表
CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  name TEXT NOT NULL,
  UNIQUE(user_id, name)
);

-- 记录-标签关联表
CREATE TABLE record_tags (
  record_id INTEGER REFERENCES records(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (record_id, tag_id)
);
```

但如果不是高频需求，可以暂时保持现状。JSON 字符串方案在数据量 < 5000 条时完全够用。

---

## 二、用户体验优化

### 2.1 【高优】移动端选集面板交互重设计

**现状**：`EpisodeRecord.vue` 中右侧选集面板在 `md` 以下默认 `hidden`，需要点击顶部一个不起眼的"面板"按钮才能显示。

**问题**：
- 按钮文案"面板"语义模糊，用户不知道点了会看到什么
- 打开后面板覆盖在主编辑区上方，不是并排布局
- 选集导航是高频操作，应该始终可见

**改进方案**：

移动端改为底部 Sheet 弹窗：

```vue
<!-- 移动端底部选集面板 -->
<Transition name="slide-up">
  <div v-if="showSidebarMobile" class="fixed inset-x-0 bottom-0 z-40 
    max-h-[60vh] bg-white dark:bg-zinc-900 rounded-t-2xl shadow-2xl 
    border-t border-zinc-200 dark:border-zinc-800 overflow-y-auto">
    
    <!-- 拖拽指示条 -->
    <div class="flex justify-center pt-2 pb-1">
      <div class="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600"></div>
    </div>
    
    <!-- 选集内容（复用 EpisodeGrid 组件） -->
    <EpisodeGrid ... />
  </div>
</Transition>

<!-- 遮罩层 -->
<Transition name="fade">
  <div v-if="showSidebarMobile" @click="showSidebarMobile = false" 
    class="fixed inset-0 bg-black/50 z-30"></div>
</Transition>
```

同时将顶部按钮改为更直观的图标 + 文字：

```vue
<button @click="showSidebarMobile = true" 
  class="md:hidden flex items-center gap-1 text-xs text-amber-500">
  <svg><!-- 网格图标 --></svg>
  选集 ({{ episodesStore.episodes.length }})
</button>
```

---

### 2.2 【高优】添加撤销功能

**现状**：评分滑块拖错、感想误删后没有恢复手段。TipTap 自带 undo/redo（Ctrl+Z），但评分、图片删除等操作没有。

**改进方案**：

1. 评分操作添加 toast 提示 + 撤销按钮：

```js
// EpisodeRecord.vue — 评分变更时
let lastRating = null

watch(rating, (newVal, oldVal) => {
  if (skipWatchers) return
  lastRating = oldVal
  // 显示带撤销按钮的 toast
  props.toast?.(`评分已更新: ${oldVal} → ${newVal}`, 'undo', () => {
    rating.value = lastRating  // 撤销
  })
})
```

2. Toast 组件支持 undo 回调：

```vue
<!-- Toast.vue 中增加 undo 类型的支持 -->
<div v-if="type === 'undo'" class="flex items-center gap-3">
  <span>{{ message }}</span>
  <button @click="handleUndo" class="text-amber-500 font-medium text-xs">
    撤销
  </button>
</div>
```

---

### 2.3 【中优】加载体验优化

**现状问题与改进**：

| 场景 | 当前 | 改进 |
|---|---|---|
| 统计页首次加载 | 拉取全量数据后一次性计算，无进度 | 如果数据量 > 500 条，加一个骨架屏或进度条 |
| 搜索页 | 防抖期间无反馈 | debounce 期间显示一个微弱脉冲动画（已在首页 loading 中有类似实现，复用即可） |
| 图片上传 | 无进度 | 大图上传时添加进度条 |
| 路由切换 | EpisodeRecord 切换集时全量重载 | 同 show 下切换集可以复用已有的 episodes 数据 |

**EpisodeRecord 路由切换优化**：

```js
// 当前：每次切换集都重新 fetchEpisodes + fetchEpisodeScores
// 优化：如果 showId 没变，复用 episodes 缓存
watch(() => route.params.id, async (newId, oldId) => {
  if (!newId || newId === oldId) return

  const ep = await episodesStore.getEpisode(Number(newId))
  if (ep && ep.show_id === episode.value?.show_id) {
    // 同一 show 下切换，跳过 fetchEpisodes
    skipFetchEpisodes = true
  }
  await initPage()
})
```

---

### 2.4 【中优】错误处理统一

**现状**：不同地方对错误的处理方式不统一：

- `console.warn('fetchEpisodeScores:', error.message)` — 静默
- `props.toast?.('添加失败: ' + e.message, 'error')` — 用户可见
- 空 catch 块 `catch {}` — 完全吞掉
- `console.error('Global error:', err, info)` — 仅控制台

**改进方案**：

在 `utils/` 下建立一个统一的错误处理函数：

```js
// src/utils/errorHandler.js
export function handleError(err, context, toastFn) {
  // 开发环境打印详细信息
  if (import.meta.env.DEV) {
    console.error(`[${context}]`, err)
  }

  // 网络错误
  if (err.message?.includes('fetch') || err.message?.includes('network')) {
    toastFn?.('网络连接失败，请检查网络', 'error')
    return
  }

  // Supabase 权限错误
  if (err.code === 'PGRST301' || err.code === '42501') {
    toastFn?.('数据访问权限不足', 'error')
    return
  }

  // 其他错误
  toastFn?.(err.message || '操作失败，请重试', 'error')
}
```

所有 `catch` 块统一调用此函数，禁止空 `catch {}`。

---

### 2.5 【低优】封面图片体验优化

**现状**：封面加载失败时处理不统一：
- `EpisodeList.vue` — `@error="$event.target.style.display = 'none'"`（隐藏 img，显示背景文字）
- `ShowList.vue` — 同上
- `CoverImage.vue` 组件已封装，但只有部分地方使用

**改进方案**：

统一使用 `CoverImage.vue` 组件，在该组件内处理：
1. 加载中 → 显示骨架 shimmer
2. 加载失败 → 显示首字或渐变色占位
3. 加载成功 → 渐变淡入

```vue
<!-- CoverImage.vue 增强版 -->
<template>
  <div class="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800">
    <!-- 加载骨架 -->
    <div v-if="loading" class="absolute inset-0 animate-pulse bg-gray-300 dark:bg-gray-700" />
    
    <!-- 图片 -->
    <img
      v-show="!errored"
      :src="src"
      @load="loading = false"
      @error="errored = true; loading = false"
      class="w-full h-full object-cover transition-opacity duration-300"
      :class="{ 'opacity-0': loading, 'opacity-100': !loading && !errored }"
      loading="lazy"
    />
    
    <!-- 降级占位 -->
    <div v-if="errored || !src" 
      class="absolute inset-0 flex items-center justify-center p-2"
      :class="placeholderClass">
      <span class="text-xs text-center">{{ name?.charAt(0) || '?' }}</span>
    </div>
  </div>
</template>
```

---

## 三、功能补全

### 3.1 【中优】评分趋势折线图

**现状**：统计页只有 CSS 柱状图，无法直观看到"这季剧集质量是上升还是下降"。

**改进方案**（纯 CSS，不引入图表库）：

在作品详情 tab 中增加一季内的逐集评分折线：

```vue
<!-- Statistics.vue — 作品细节 tab 中增加 -->
<div class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border">
  <h3 class="text-sm text-gray-500 mb-3">逐集评分趋势</h3>
  <div class="flex items-end gap-0.5 h-32">
    <div v-for="(point, i) in episodeRatingTrend" :key="i"
      class="flex-1 flex flex-col items-center justify-end h-full">
      <!-- 折线由相邻柱顶连线组成（SVG 覆盖） -->
      <div class="w-full rounded-t bg-indigo-400/60" 
        :style="{ height: (point.rating / 10 * 100) + '%' }"></div>
    </div>
  </div>
</div>
```

如果需要真正的折线图，可以引入一个极轻量的库（如 `chart.js` 的 tree-shaked 版本约 20KB gzipped）。

---

### 3.2 【中优】年度回顾

类似 Spotify Wrapped，展示用户每年的观看总结。

**数据来源**：已有 `records.watched_date` 和 `records.rating`，需要的计算：
- 年度观看总数（按集/部维度）
- 年度平均分
- 最高分作品
- 最常看的类型
- 月度热力图

**实现方式**：在 Statistics 页面新增一个 tab "年度回顾"，按年份筛选。

```js
// 年度回顾计算
function getYearReview(year) {
  const yearRecords = allRecords.value.filter(r => {
    const d = r.watchedDate ? new Date(r.watchedDate) : null
    return d && d.getFullYear() === year
  })
  return {
    totalEpisodes: yearRecords.length,
    avgRating: /* ... */,
    topShows: /* ... */,
    mostWatchedMonth: /* ... */,
    categoryBreakdown: /* ... */,
  }
}
```

---

### 3.3 【低优】导出格式扩展

**现状**：只支持 JSON 格式的导入导出。

**改进方案**：

在 `exportImport.js` 中增加 Markdown 导出：

```js
// src/utils/exportImport.js — 新增
export async function exportToMarkdown() {
  const data = await collectExportData()

  let md = '# PlotNote 导出\n\n'
  md += `> 导出时间：${new Date().toLocaleString()}\n\n`

  for (const show of data.shows) {
    md += `## ${show.name}\n\n`
    md += `- 分类：${show.category}  |  地区：${show.region}  |  均分：${show.avgRating}\n\n`

    const episodes = data.episodes.filter(e => e.showId === show.id)
    for (const ep of episodes) {
      const record = data.records.find(r => r.episodeId === ep.id)
      if (!record) continue

      md += `### S${String(ep.season).padStart(2,'0')}E${String(ep.episode).padStart(2,'0')}\n\n`
      md += `**评分**：${record.rating > 0 ? '★'.repeat(Math.round(record.rating/2)) + ` ${record.rating}/10` : '未评分'}\n\n`
      // Markdown 内容直接保留（TipTap 已输出 HTML，需要转 Markdown 或用 turndown 库）
      if (record.review) md += `${record.review}\n\n`
      if (record.tags?.length) md += `标签：${record.tags.join(', ')}\n\n`
      md += `---\n\n`
    }
  }

  // 触发下载
  const blob = new Blob([md], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `plotnote-export-${new Date().toISOString().split('T')[0]}.md`
  a.click()
}
```

---

### 3.4 【低优】分享功能

生成剧评卡片图片用于分享。

**技术方案**：利用 `html2canvas` 将感想区域渲染为图片。

```js
// 在 EpisodeRecord 中增加分享按钮
async function shareReview() {
  const el = document.querySelector('.review-content')
  if (!el) return

  const canvas = await html2canvas(el, {
    backgroundColor: isDark.value ? '#18181b' : '#ffffff',
    scale: 2,
  })

  // 尝试原生分享 API
  if (navigator.share && navigator.canShare) {
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'review.png', { type: 'image/png' })
      await navigator.share({
        title: `${show.value?.name} - ${episodeLabel.value}`,
        text: `评分：${rating.value}/10`,
        files: [file],
      })
    })
  } else {
    // 降级：下载图片
    const link = document.createElement('a')
    link.download = `review-${episode.value?.id}.png`
    link.href = canvas.toDataURL()
    link.click()
  }
}
```

---

## 四、优化优先级路线图

```
Phase 1（本周） — 代码质量基线
├── 1.1 统一数据访问层（消除裸调 supabase）     ⭐ 影响最大
├── 1.3 启用 Dexie 离线缓存 或 删除死代码        ⭐ 架构决策
└── 1.4 消除重复工具函数                          ⭐ 工作量小

Phase 2（2周内） — 组件重构 + 体验
├── 1.2 拆分大组件 (EpisodeRecord / ShowList)     工作量中等
├── 1.6 搜索页服务端过滤                          性能提升明显
├── 2.1 移动端选集面板交互                        体验提升明显
└── 2.3 加载体验优化                              多场景改善

Phase 3（1个月内） — 功能 + 类型
├── 2.2 撤销功能
├── 2.4 统一错误处理
├── 2.5 封面图片体验
├── 3.1 评分趋势图
└── 3.2 年度回顾

Phase 4（按需） — 锦上添花
├── 1.5 TypeScript 渐进引入
├── 1.7 tags/genres 存储规范化
├── 3.3 导出格式扩展
└── 3.4 分享功能
```

---

## 五、一些具体的代码修复建议（快速见效）

### 5.1 `EpisodeRecord.vue` 的 `review` 变量未使用

L38 定义了 `const review = ref('')` 但实际感想内容来自 TipTap editor，`review` 变量只被 watch 但从未被赋值或渲染。建议删除这个变量，所有 review 读写走 `editor.value?.getHTML()` / `editor.value?.commands.setContent()`。

### 5.2 `EpisodeRecord.vue:345` 残留的 textarea 引用

L345 有 `const textarea = document.querySelector('textarea')`，但页面中已经没有 textarea 了（已替换为 TipTap EditorContent）。这段代码应删除。

### 5.3 `Timeline.vue:131` 的 `stripMarkdown` 已过时

`stripMarkdown` 用正则去掉 Markdown 格式，但现在 review 存储的是 HTML（TipTap 输出）。应该改为 `stripHtml`：

```js
function stripHtml(html) {
  if (!html) return ''
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.textContent || '').trim().slice(0, 120)
}
```

### 5.4 `.env` 文件不应提交到 Git

检查 `.gitignore` 是否包含 `.env`。当前 git status 是 clean 的，但 `.env` 文件的 592 字节可能存在泄露风险。确认 `.env` 已加入 `.gitignore`，如果之前提交过需要用 `git rm --cached .env` 移除追踪。
