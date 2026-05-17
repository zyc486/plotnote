<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { collectExportData, importFromData, exportToJSON, importFromJSON, deduplicateShows } from '../utils/exportImport'
import { useTheme } from '../utils/theme'
import { useShowsStore } from '../stores/shows'
import { useAuthStore } from '../stores/auth'
import { setTmdbApiKey, getTmdbApiKey, hasCustomTmdbKey } from '../utils/tmdb'
import { setOmdbApiKey, getOmdbApiKey, hasOmdbKey } from '../utils/omdb'
import { setTasteDiveApiKey, getTasteDiveApiKey, hasTasteDiveKey } from '../utils/tasteDive'

const props = defineProps(['toast'])
const router = useRouter()
const store = useShowsStore()
const authStore = useAuthStore()
const { isDark, toggleTheme } = useTheme()

const importInput = ref(null)
const tmdbKeyInput = ref('')
const omdbKeyInput = ref('')
const tasteDiveKeyInput = ref('')

onMounted(() => {
  tmdbKeyInput.value = getTmdbApiKey()
  omdbKeyInput.value = getOmdbApiKey()
  tasteDiveKeyInput.value = getTasteDiveApiKey()
})

function saveTmdbKey() {
  setTmdbApiKey(tmdbKeyInput.value.trim())
  props.toast?.(tmdbKeyInput.value.trim() ? 'TMDB API Key 已保存' : 'TMDB API Key 已清除（使用默认）', 'success')
}

function saveOmdbKey() {
  setOmdbApiKey(omdbKeyInput.value.trim())
  props.toast?.(omdbKeyInput.value.trim() ? 'OMDb API Key 已保存' : 'OMDb API Key 已清除', 'success')
}

function saveTasteDiveKey() {
  setTasteDiveApiKey(tasteDiveKeyInput.value.trim())
  props.toast?.(tasteDiveKeyInput.value.trim() ? 'TasteDive API Key 已保存' : 'TasteDive API Key 已清除', 'success')
}

async function handleExport() {
  try { await exportToJSON(); props.toast?.('导出成功', 'success') }
  catch (e) { props.toast?.('导出失败: ' + e.message, 'error') }
}

async function handleImport(event) {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    const r = await importFromJSON(file)
    await store.fetchShows()
    props.toast?.(`导入成功: ${r.shows}部, ${r.episodes}条, ${r.records}条记录`, 'success')
  } catch (e) { props.toast?.('导入失败: ' + e.message, 'error') }
  event.target.value = ''
}

async function handleDeduplicate() {
  try {
    const count = await deduplicateShows()
    await store.fetchShows()
    if (count > 0) {
      props.toast?.(`已清理 ${count} 个重复作品`, 'success')
    } else {
      props.toast?.('没有发现重复数据', 'info')
    }
  } catch (e) { props.toast?.('清理失败: ' + e.message, 'error') }
}

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="max-w-xl mx-auto p-4 md:p-6">
    <header class="flex items-center justify-between mb-8">
      <h1 class="text-2xl font-bold">设置</h1>
      <button @click="router.back()" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm px-3 py-2 transition">
        ← 返回
      </button>
    </header>

    <!-- 账号 -->
    <section class="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">账号</h2>
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-700 dark:text-gray-300">
          {{ authStore.user?.email || '未登录' }}
        </span>
        <button
          @click="handleLogout"
          class="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 text-sm px-3 py-1.5 rounded-lg transition"
        >
          退出登录
        </button>
      </div>
    </section>

    <!-- 数据管理 -->
    <section class="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">数据管理</h2>
      <div class="space-y-3">
        <div class="flex gap-2">
          <button
            @click="handleExport"
            class="flex-1 bg-gray-800 hover:bg-gray-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            导出数据 (JSON)
          </button>
          <button
            @click="importInput?.click()"
            class="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            导入数据 (JSON)
          </button>
          <input ref="importInput" type="file" accept=".json" class="hidden" @change="handleImport" />
        </div>
        <button
          @click="handleDeduplicate"
          class="w-full bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          清理重复数据
        </button>
        <p class="text-xs text-gray-500 dark:text-gray-400">如果因多次同步导致数据重复，点击此按钮清理（保留最新版本）</p>
      </div>
    </section>

    <!-- 外观 -->
    <section class="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">外观</h2>
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-700 dark:text-gray-300">深色模式</span>
        <button
          @click="toggleTheme"
          class="relative w-14 h-7 rounded-full transition-colors duration-300"
          :class="isDark ? 'bg-indigo-600' : 'bg-gray-300'"
        >
          <span
            class="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-300 flex items-center justify-center text-xs"
            :class="isDark ? 'translate-x-7' : 'translate-x-0.5'"
          >
            {{ isDark ? '🌙' : '☀' }}
          </span>
        </button>
      </div>
    </section>

    <!-- 第三方数据设置 -->
    <section class="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6 mb-6">
      <h2 class="text-lg font-semibold mb-5">第三方数据设置</h2>

      <!-- 电影：TMDB -->
      <div class="mb-6">
        <div class="flex items-center gap-2 mb-3">
          <span class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-bold">影</span>
          <div>
            <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">电影</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">TMDB API · 搜索电影、获取封面</p>
          </div>
          <span v-if="hasCustomTmdbKey()" class="ml-auto px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">自定义 Key</span>
          <span v-else class="ml-auto px-2 py-0.5 text-xs rounded-full bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400">使用默认</span>
        </div>
        <div class="flex gap-2">
          <input
            v-model="tmdbKeyInput"
            type="password"
            placeholder="API Key 或 Read Access Token（留空使用默认）"
            class="flex-1 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
          <button @click="saveTmdbKey" class="px-3 py-2 bg-gray-800 hover:bg-gray-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-lg text-sm transition">保存</button>
        </div>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
          <a href="https://www.themoviedb.org/settings/api" target="_blank" class="text-indigo-500 hover:underline">免费申请</a>
          · 已内置默认 Key，失效时可配置自己的
        </p>
      </div>

      <!-- 电视剧：TVMaze -->
      <div class="mb-6">
        <div class="flex items-center gap-2 mb-3">
          <span class="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 text-sm font-bold">剧</span>
          <div>
            <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">电视剧</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">TVMaze API · 搜索剧集、自动获取季集</p>
          </div>
          <span class="ml-auto px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">免费 · 无需配置</span>
        </div>
      </div>

      <!-- 动画：AniList + Jikan -->
      <div class="mb-6">
        <div class="flex items-center gap-2 mb-3">
          <span class="w-8 h-8 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center text-pink-600 dark:text-pink-400 text-sm font-bold">番</span>
          <div>
            <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">动画</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">AniList + Jikan API · 搜索动画、多语言标题</p>
          </div>
          <span class="ml-auto px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">免费 · 无需配置</span>
        </div>
      </div>

      <!-- 图书：豆瓣 -->
      <div class="mb-6">
        <div class="flex items-center gap-2 mb-3">
          <span class="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 text-sm font-bold">书</span>
          <div>
            <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">图书</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">豆瓣图书 API · 搜索中文图书</p>
          </div>
          <span class="ml-auto px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">免费 · 无需配置</span>
        </div>
      </div>

      <div class="border-t border-gray-200 dark:border-gray-700 pt-5">
        <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">可选扩展</h3>

        <!-- OMDb（IMDB评分） -->
        <div class="mb-5">
          <div class="flex items-center gap-2 mb-2">
            <h4 class="text-sm text-gray-600 dark:text-gray-400">OMDb API Key</h4>
            <span v-if="hasOmdbKey()" class="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">✓ 已配置</span>
          </div>
          <div class="flex gap-2">
            <input
              v-model="omdbKeyInput"
              type="password"
              placeholder="免费申请: omdbapi.com/apikey.aspx"
              class="flex-1 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <button @click="saveOmdbKey" class="px-3 py-2 bg-gray-800 hover:bg-gray-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-lg text-sm transition">保存</button>
          </div>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">获取 IMDB、烂番茄评分（免费额度 1000 次/天）</p>
        </div>

        <!-- TasteDve（推荐） -->
        <div>
          <div class="flex items-center gap-2 mb-2">
            <h4 class="text-sm text-gray-600 dark:text-gray-400">TasteDive API Key</h4>
            <span v-if="hasTasteDiveKey()" class="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">✓ 已配置</span>
          </div>
          <div class="flex gap-2">
            <input
              v-model="tasteDiveKeyInput"
              type="password"
              placeholder="免费申请: tastedive.com/read/api"
              class="flex-1 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <button @click="saveTasteDiveKey" class="px-3 py-2 bg-gray-800 hover:bg-gray-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-lg text-sm transition">保存</button>
          </div>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">获取作品推荐（类似电影/剧集/图书推荐）</p>
        </div>
      </div>
    </section>

    <!-- 同步说明 -->
    <section class="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6">
      <h2 class="text-lg font-semibold mb-3">数据同步</h2>
      <ul class="text-sm text-gray-500 dark:text-gray-400 space-y-2">
        <li>• 数据自动保存到云端，无需手动同步</li>
        <li>• 两人各自使用独立账号，数据完全隔离</li>
        <li>• 随时可以通过导出功能备份数据</li>
      </ul>
    </section>
  </div>
</template>
