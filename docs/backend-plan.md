# 后端同步方案规划

## 背景

当前项目使用 GitHub 仓库同步数据，存在以下问题：
- 每次需要手动上传/下载
- 多次同步导致数据重复
- GitHub 在国内访问不稳定

## 目标用户

两人使用（你和女朋友），需要：
- 各自独立账号登录
- 数据自动同步
- 国内访问速度快

---

## 方案对比

| 维度 | Cloudflare Workers + D1 | Vercel + Supabase | GitHub 同步（当前） |
|------|------------------------|-------------------|-------------------|
| **速度** | 够用 | 快 | 慢 |
| **复杂度** | 中等 | 低 | 低 |
| **登录系统** | 需自己写 | 自带 | 无 |
| **数据库** | SQLite | PostgreSQL | IndexedDB |
| **免费额度** | 10万请求/天 | 500MB + 5万用户 | 无限 |
| **国内访问** | 不用梯子 | 不用梯子 | 要梯子 |
| **部署前端** | 需额外配置 | 一键导入 | - |
| **数据管理** | 命令行 | 网页后台 | - |

---

## 方案一：Vercel + Supabase（推荐）

### 优点
- **自带登录系统**：几行代码搞定，不用自己写认证
- **数据库可视化**：网页后台直接查看、编辑数据
- **API 自动生成**：不用写后端代码
- **速度快**：服务器在亚洲，国内访问快
- **免费够用**：500MB 数据库 + 5万月活用户

### 技术栈
- **Vercel**：前端托管（类似 GitHub Pages）
- **Supabase**：后端服务（PostgreSQL + 认证 + API）

### 代码示例
```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, key)

// 查询 - 就这么简单
const { data } = await supabase.from('shows').select('*')

// 登录 - 自带的
await supabase.auth.signInWithPassword({ email, password })
```

### 实现步骤
1. 注册 [Supabase](https://supabase.com)（可用 GitHub 登录）
2. 创建项目，建数据库表
3. 前端接入 Supabase SDK
4. 部署到 Vercel

---

## 方案二：Cloudflare Workers + D1

### 优点
- 完全掌控代码
- 边缘计算，延迟低
- 免费额度大（10万请求/天）

### 缺点
- 需要手写每个 API 接口
- 登录验证需要自己实现（~100行代码）
- 数据库操作用命令行
- 调试不方便

### 技术栈
- **Cloudflare Workers**：API 服务器
- **Cloudflare D1**：SQLite 数据库

### 代码示例
```javascript
// 需要自己写 Worker API
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/shows') {
      const shows = await env.DB.prepare('SELECT * FROM shows').all()
      return new Response(JSON.stringify(shows))
    }
    // ... 每个接口都要写
  }
}
```

### 实现步骤
1. 创建 Cloudflare Worker
2. 创建 D1 数据库，建表
3. 编写所有 API 接口
4. 实现登录验证
5. 前端接入 API

---

## 决策

**推荐方案：Vercel + Supabase**

原因：
1. 两人使用场景，Supabase 免费额度足够
2. 自带登录系统，省去大量开发工作
3. 网页后台管理数据，方便直观
4. 国内访问速度好

---

## 备注

此文档为规划阶段，待确认后实施。
