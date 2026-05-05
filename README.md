# PlotNote - 剧评记录应用

## 项目概述

PlotNote 是一个基于 Vue 3 的个人剧评记录应用，支持记录电视剧、电影、动画和图书的观看/阅读体验。用户可以为每集/每章添加评分、评论、图片和标签，并查看统计数据。

**核心价值**：帮助用户系统化地记录和回顾自己的观影/阅读体验，支持多维度的数据分析和搜索。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue 3 | ^3.5.33 | 前端框架 |
| Vite | - | 构建工具 |
| Pinia | ^3.0.4 | 状态管理 |
| Vue Router | ^4.6.4 | 路由管理 |
| Dexie | ^4.4.2 | IndexedDB 封装（本地数据库） |
| Tailwind CSS | ^3.4.19 | 样式框架 |
| PostCSS + Autoprefixer | - | CSS 处理 |

## 功能特性

### 1. 多类型内容管理
- **电视剧**：通过 TVMaze API 搜索，支持中英文，自动获取剧集列表，支持设置季数/集数
- **电影**：通过 TMDB API 搜索，内置默认 Key 开箱即用，搜索后直接添加，无需设置集数
- **动画**：通过 AniList API 搜索，支持中日英多语言标题，搜索后直接添加
- **图书**：通过豆瓣图书 API 搜索，中文搜索效果好，搜索后直接添加
- **封面图片**：添加内容时自动从 API 获取封面图片，首页列表和详情页均展示封面，支持通过编辑功能手动修改

### 2. 记录系统
- **评分**：0-10 分滑块，支持一位小数
- **评论**：文本评论，自动保存（500ms 防抖）
- **图片**：支持上传、粘贴、拖拽排序，最多 30 张，自动压缩
- **标签**：预定义标签 + 自定义标签，支持搜索，最多 20 个
- **多刷记录**：同一集/章可创建多条记录，支持设置主记录

### 3. 数据管理
- **自动保存**：评分、评论、图片、标签变更后自动保存到 IndexedDB
- **草稿缓存**：使用 localStorage 缓存未保存的编辑内容
- **导入导出**：JSON 格式备份和恢复，支持跨设备迁移
- **GitHub 云同步**：通过 Personal Access Token 将数据同步到私有 GitHub 仓库，支持跨设备实时同步
- **自动备份**：每次数据变更后自动备份到 localStorage（5 秒防抖，4MB 上限，7 天过期）
- **设置页面**：集中管理导出、导入、主题切换、GitHub 云同步配置

### 4. 统计分析
- 全剧平均分
- 已评/总数进度
- 最高分/最低分剧集
- 各季平均分对比

### 5. 搜索功能
- 全文搜索：名称、评论、标签、地区、类型
- 筛选：分类、最低评分、指定标签
- 结果按相关性和评分排序

### 6. 其他功能
- **系列管理**：将多个作品归类到同一系列（如"齐木楠雄的灾难"第一季、第二季），首页列表中同系列作品自动合并为一个卡片，显示系列名、紫色"系列"徽章、作品数量和整体均分，点击可展开查看各子作品
- **地区/类型标签**：支持自定义和历史记录
- **深色/浅色主题**：首页顶部栏提供主题切换按钮，切换后持久化到 localStorage
- **快速跳转**：按 S01E01 格式跳转到指定剧集
- **集数选择器**：底部弹窗快速切换剧集

## 项目结构

```
plotnote/
├── public/
│   └── _redirects               # Cloudflare Pages SPA 路由规则
├── src/
│   ├── components/          # 可复用组件
│   │   ├── ConfirmDialog.vue    # 统一确认弹窗
│   │   ├── CoverImage.vue       # 封面图片组件（带文字兜底）
│   │   ├── GenreSelector.vue    # 分类/地区/类型选择器
│   │   ├── ImageManager.vue     # 图片上传和管理
│   │   ├── TagSelector.vue      # 标签选择器
│   │   └── Toast.vue            # 消息提示组件
│   ├── composposables/
│   │   └── useToast.js          # Toast 组合式函数
│   ├── db/
│   │   └── index.js             # Dexie 数据库定义和常量
│   ├── pages/               # 页面组件
│   │   ├── ShowList.vue         # 首页：内容列表
│   │   ├── EpisodeList.vue      # 剧集列表页
│   │   ├── EpisodeRecord.vue    # 记录编辑页
│   │   ├── Search.vue           # 搜索页面
│   │   ├── Settings.vue         # 设置页面（导出/导入/主题/云同步）
│   │   ├── Statistics.vue       # 统计页面
│   │   └── Timeline.vue         # 观看时间线
│   ├── router/
│   │   └── index.js             # 路由配置
│   ├── stores/              # Pinia 状态管理
│   │   ├── shows.js             # 内容数据
│   │   ├── episodes.js          # 剧集数据
│   │   ├── records.js           # 记录数据
│   │   └── tags.js              # 标签数据
│   ├── utils/               # 工具函数
│   │   ├── anilist.js           # AniList API
│   │   ├── autoBackup.js        # 自动备份 + GitHub 云同步
│   │   ├── debounce.js          # 防抖/节流
│   │   ├── draftCache.js        # 草稿缓存
│   │   ├── exportImport.js      # 导入导出
│   │   ├── githubSync.js        # GitHub 云同步核心模块
│   │   ├── googleBooks.js       # 豆瓣图书 API
│   │   ├── imageUtils.js        # 图片压缩
│   │   ├── markdown.js          # Markdown 渲染
│   │   ├── terminology.js       # 术语映射
│   │   ├── theme.js             # 主题切换
│   │   ├── tmdb.js              # TMDB API
│   │   └── tvmaze.js            # TVMaze API
│   ├── App.vue              # 根组件
│   ├── main.js              # 应用入口
│   └── style.css            # 全局样式
├── 文档/                    # 项目文档
│   ├── README.md            # 本文档
│   └── 功能升级规划.md       # 功能规划
├── index.html               # HTML 入口
├── package.json             # 依赖配置
├── .gitignore               # Git 忽略规则
├── vite.config.js           # Vite 配置
├── tailwind.config.js       # Tailwind 配置
└── postcss.config.js        # PostCSS 配置
```

## 核心模块说明

### 数据库设计 (db/index.js)

使用 Dexie（IndexedDB 封装），版本 5，包含以下表：

| 表名 | 主要字段 | 说明 |
|------|----------|------|
| shows | id, name, avgRating, ratedCount, category, region, genres, seriesId, coverImage | 内容条目 |
| episodes | id, showId, season, episode, activeRecordId | 剧集/章节 |
| records | id, episodeId, rating, review, images, tags, createdAt | 评分记录 |
| tags | id, name, isPredefined, usageCount | 标签 |
| genreHistory | id, name | 类型历史记录 |
| series | id, name | 系列 |

**关键常量**：
- `CATEGORIES`: movie(电影), tv(电视剧), animation(动画), book(图书)
- `PREDEFINED_TAGS`: 15 个预定义标签
- `PREDEFINED_GENRES`: 29 个预定义类型
- `REGION_SUGGESTIONS`: 15 个地区建议

### 路由配置 (router/index.js)

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | ShowList | 首页，内容列表 |
| `/show/:id` | EpisodeList | 剧集列表 |
| `/episode/:id` | EpisodeRecord | 记录编辑 |
| `/statistics` | Statistics | 统计页面 |
| `/search` | Search | 搜索页面 |

### 状态管理 (stores/)

**shows.js**：
- `fetchShows()`: 获取所有内容
- `addShow(name, episodes, metadata)`: 添加新内容（metadata 支持 `coverImage` 字段自动保存封面）
- `updateShowMeta(showId, metadata)`: 更新内容元数据（支持更新 `coverImage`）
- `updateShowStats(showId)`: 重新计算平均分和已评数量
- `deleteShow(showId)`: 删除内容及关联数据
- `getAllSeries()`, `createSeries(name)`: 系列管理

**episodes.js**：
- `fetchEpisodes(showId)`: 获取剧集列表
- `getAdjacentEpisodes(episodeId)`: 获取相邻剧集
- `deleteEpisode(episodeId)`: 删除剧集及记录

**records.js**：
- `createRecord(episodeId, rating, review, images, tags)`: 创建记录
- `updateRecord(recordId, data)`: 更新记录
- `setActiveRecord(episodeId, recordId)`: 设置主记录
- `deleteRecord(recordId)`: 删除记录

**tags.js**：
- `initTags()`: 初始化预定义标签
- `addCustomTag(name)`: 添加自定义标签
- `incrementUsage(tagId)`, `decrementUsage(tagId)`: 使用计数
- `searchTags(input)`: 模糊搜索标签

### API 集成 (utils/)

**tvmaze.js**：电视剧搜索
- 内置 130+ 中英文剧名映射
- `searchShows(query)`: 搜索电视剧（返回 `show.image.medium` 封面）
- `getShowEpisodes(showId)`: 获取剧集列表
- 类型和地区自动映射

**tmdb.js**：电影搜索
- 使用 `api.tmdb.org` 域名（国内可直接访问，无需代理）
- 内置默认 Read Access Token，支持用户自定义 Key（localStorage 存储）
- 同时支持 v3 API Key（32位字符串）和 v4 Read Access Token（JWT）两种格式
- `searchMovies(query)`: 搜索电影（返回 `poster_path` 拼接的封面 URL）
- `hasCustomTmdbKey()`: 检查是否使用自定义 Key
- 类型 ID 到中文映射

**anilist.js**：动画搜索
- GraphQL API
- `searchAnime(query)`: 搜索动画（返回 `coverImage.medium` 封面）
- 支持 romaji/native/english 标题

**googleBooks.js**：图书搜索
- 使用豆瓣图书 suggest API（国内直连，无需代理）
- `searchBooks(query)`: 搜索图书（返回 `pic` 封面 URL）
- 按页数生成章节数（页数需用户手动设置，因豆瓣 API 不返回页数信息）
- `buildBookChapters(totalChapters, volumes)`: 按页数和卷数生成章节结构

### 工具函数 (utils/)

**terminology.js**：术语映射
- 根据 category 返回不同术语（集/部/章，季/卷）
- `episodeLabel(ep, category)`: 生成剧集标签

**imageUtils.js**：图片处理
- `compressImage(file)`: 压缩图片（最大 1200px，质量 0.7）
- `generateImageId()`: 生成唯一 ID

**draftCache.js**：草稿缓存
- 使用 localStorage 存储未保存的编辑内容
- `saveDraft()`, `loadDraft()`, `clearDraft()`

**debounce.js**：防抖节流
- `debounce(fn, delay)`: 防抖函数
- `throttle(fn, limit)`: 节流函数

## 部署

### 在线地址

**https://plotnote.pages.dev**

### 代码仓库

**https://github.com/zyc486/plotnote**（公开仓库）

数据同步仓库：`zyc486/plotnote-data`（私有仓库，存放用户的观看记录数据）

### 部署平台：Cloudflare Pages

项目使用 Cloudflare Pages 自动部署，每次推送到 GitHub 的 `main` 分支会自动触发构建和部署。

**构建配置**：

| 配置项 | 值 |
|--------|------|
| 项目名称 | `plotnote` |
| 生产分支 | `main` |
| 框架预设 | `Vue` |
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |

**部署流程**：
1. 代码推送到 GitHub `main` 分支
2. Cloudflare Pages 自动检测变更
3. 自动执行 `npm install` 和 `npm run build`
4. 将 `dist/` 目录部署到全球 CDN
5. 约 1-2 分钟后上线

**SPA 路由**：项目包含 `public/_redirects` 文件，内容为 `/* /index.html 200`，确保 Vue Router 的 history 模式在刷新时不出现 404。

### 数据同步：GitHub 云同步

用户可通过**设置页**配置 GitHub Personal Access Token 实现跨设备数据同步：

- 数据存储在私有仓库 `plotnote-data` 的 `data.json` 文件中
- 数据变更后自动触发上传（30 秒防抖）
- 打开页面时自动拉取最新数据
- Token 存储在浏览器 localStorage 中，不会上传到代码仓库

**Token 权限要求**：classic token 勾选 `repo` scope 即可。

## 开发指南

### 启动开发服务器

```bash
npm install
npm run dev
```

访问 http://localhost:5173

### 构建生产版本

```bash
npm run build
npm run preview
```

### API Key 配置

**TMDB API Key**（电影搜索，可选）：
- 已内置默认 Key，无需配置即可使用
- 支持两种格式：
  - **v3 API Key**：32位字符串（如 `7157a16f4818bec98675eedca8405b79`），通过 URL 参数 `api_key=` 传递
  - **v4 Read Access Token**：JWT 格式（以 `eyJ` 开头），通过 `Authorization: Bearer` 请求头传递
- 如默认 Key 失效，可自行获取：
  1. 访问 https://www.themoviedb.org/settings/api
  2. 注册并获取 API Key 或 Read Access Token
  3. 在电影搜索页面点击"TMDB 设置"输入

### 数据备份

定期使用导出功能备份数据：
- 点击首页右上角"导出"按钮
- 生成 JSON 文件包含所有数据
- 使用"导入"按钮恢复数据

## 更新日志

### 2026-05-02 (v5)
**系列分组卡片 + UI 交互优化**
- **系列分组**：首页列表中同系列作品（如"齐木楠雄的灾难"第一季、第二季）自动合并为一个卡片，显示系列名、紫色"系列"徽章、作品数量和整体均分，点击可展开/收起查看各子作品，子作品可独立点击进入详情
- **主题按钮位置统一**：移除全局浮动主题按钮，改为仅在首页顶部栏右侧显示，避免页面切换时按钮位置跳动
- **评分页返回按钮修复**：左上角按钮文字从作品名改为"← 返回"，点击使用 `router.back()` 返回上一浏览页面（而非固定跳转路由），作品名仅在顶部中间显示
- **评分页布局清理**：顶部栏恢复对称内边距，移除不再需要的额外右侧间距

### 2026-05-02 (v4)
**TMDB 电影搜索 & 图书搜索国内可用性修复 + 添加流程简化 + 详情页智能适配**
- 电影搜索：API 域名从 `api.themoviedb.org`（国内被墙）切换为 `api.tmdb.org`（国内可直连）
- 图书搜索：从 Google Books API（`googleapis.com` 国内被墙）切换为豆瓣图书 suggest API
- 简化添加流程：电影、图书、动画搜索后直接添加，不再需要设置集数/章节数，只有电视剧保留季数/集数设置
- 详情页智能适配：单集内容（电影等）点击后直接跳转评分页，不再显示列表
- 单季电视剧（如甄嬛传）隐藏季筛选栏和"S01"前缀，直接显示"第 X 集"
- 多季电视剧保持 S01E01 格式和季筛选功能
- 跳转输入框按类型自适应：多季用"S5E10"格式，单季只需输入集数

### 2026-05-02 (v3)
**电影搜索优化**
- TMDB API 内置默认 Read Access Token，电影搜索开箱即用
- 移除强制 API Key 配置流程，改为可选的高级设置
- 搜索页面新增折叠式 TMDB 设置入口，支持自定义/恢复默认 Key
- 改进错误提示，区分默认 Key 失效和自定义 Key 无效

### 2026-05-02 (v2)
**封面图片功能**
- 数据库升级至版本 5，`shows` 表新增 `coverImage` 字段
- 添加内容时自动从 API 获取封面图片（搜索添加和手动添加均支持）
- 首页列表卡片左侧显示封面缩略图（64x88px），无封面时显示占位图标
- 剧集列表详情页顶部左侧显示大封面（96x136px）
- 编辑弹窗新增封面图片 URL 输入框，支持实时预览和手动修改
- 所有四类 API 均已支持返回封面 URL：TVMaze、TMDB、AniList、Google Books
- 导入导出功能自动兼容封面字段

### 2026-05-02 (v1)
**初始文档创建**
- 完成项目代码全面分析
- 创建 README.md 文档，包含：
  - 项目概述和技术栈
  - 完整功能特性说明
  - 详细的项目结构
  - 核心模块说明（数据库、路由、状态管理、API、工具函数）
  - 开发指南
  - 更新日志机制

**文档目的**：使新窗口的 AI 能够快速理解项目结构和功能，无需重新阅读所有源代码，直接基于本文档继续开发任务。

### 2026-05-03 (v7)
**Cloudflare Pages 部署 + 代码仓库上线**
- 代码推送到 GitHub 公开仓库 `zyc486/plotnote`
- 部署到 Cloudflare Pages，在线地址：https://plotnote.pages.dev
- 创建 `public/_redirects` 文件解决 SPA 路由 404 问题
- 创建 `.gitignore` 排除 `node_modules`、`dist` 等文件
- 每次推送到 `main` 分支自动触发重新构建和部署

### 2026-05-03 (v6)
**GitHub 云同步 + 设置页面 + UX 全面优化**
- **GitHub 云同步**：新建 `githubSync.js` 核心模块，通过 GitHub REST API 实现数据上传/下载，支持自动创建私有数据仓库 `plotnote-data`
- **设置页面**：新建 `Settings.vue`，集中管理导出、导入、主题切换、GitHub 云同步配置
- **自动备份 + 云同步集成**：`autoBackup.js` 在本地备份后自动触发 GitHub 同步（30 秒防抖），页面加载时自动拉取最新数据
- **导出导入重构**：`exportImport.js` 拆分为 `collectExportData()`（仅收集数据）和 `exportToJSON()`（数据+下载），新增 `importFromData()` 支持程序化导入
- **UX 优化（15 项）**：
  - 时间线点击区域扩大，可点击整行跳转
  - TagSelector 集成到集数记录页
  - 多季作品季标签水平滚动
  - 首页状态快速切换（卡片上直接切换想看/在看/看完/弃坑）
  - 全局统计入口（导航栏新增统计按钮）
  - 元数据展示优化（分类、状态、地区、类型标签）
  - Markdown 编辑/预览双模式
  - 封面图放大查看
  - 返回搜索按钮
  - 统一确认弹窗（ConfirmDialog 替代 window.confirm）
- **封面图组件**：新建 `CoverImage.vue`，带 `@error` 兜底，图片加载失败时显示作品名称文字
- **Markdown 渲染**：新建 `markdown.js`，轻量级 Markdown 渲染和纯文本提取
