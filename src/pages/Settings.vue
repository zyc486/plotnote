<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  getToken, setToken, getRepo, setRepo,
  testConnection, ensureRepo, isConfigured,
  getSyncStatus, formatSyncTime, disconnect,
  uploadData, downloadData,
} from '../utils/githubSync'
import { collectExportData, importFromData, exportToJSON, importFromJSON } from '../utils/exportImport'
import { useTheme } from '../utils/theme'

import { setOmdbApiKey, getOmdbApiKey, hasOmdbKey } from '../utils/omdb'
import { setTasteDiveApiKey, getTasteDiveApiKey, hasTasteDiveKey } from '../utils/tasteDive'

const props = defineProps(['toast'])
const router = useRouter()
const { isDark, toggleTheme } = useTheme()

const tokenInput = ref('')
const repoInput = ref('plotnote-data')
const connected = ref(false)
const userName = ref('')
const syncing = ref(false)
const lastSyncInfo = ref('')
const syncStatus = ref(null)
const importInput = ref(null)
const omdbKeyInput = ref('')
const tasteDiveKeyInput = ref('')

onMounted(() => {
  omdbKeyInput.value = getOmdbApiKey()
  tasteDiveKeyInput.value = getTasteDiveApiKey()
})

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
    props.toast?.(`导入成功: ${r.shows}部, ${r.episodes}条, ${r.records}条记录`, 'success')
  } catch (e) { props.toast?.('导入失败: ' + e.message, 'error') }
  event.target.value = ''
}

onMounted(() => {
  tokenInput.value = getToken()
  repoInput.value = getRepo() || 'plotnote-data'
  connected.value = isConfigured()
  syncStatus.value = getSyncStatus()
  lastSyncInfo.value = formatSyncTime()

  if (connected.value) {
    verifyToken()
  }
})

async function verifyToken() {
  try {
    const user = await testConnection(tokenInput.value)
    userName.value = user.login
    connected.value = true
  } catch {
    connected.value = false
    userName.value = ''
  }
}

async function handleConnect() {
  const token = tokenInput.value.trim()
  if (!token) {
    props.toast?.('请输入 Token', 'warning')
    return
  }

  try {
    const user = await testConnection(token)
    userName.value = user.login
    setToken(token)
    setRepo(repoInput.value.trim() || 'plotnote-data')
    await ensureRepo(token)
    connected.value = true
    props.toast?.(`已连接 GitHub 账号: ${user.login}`, 'success')
  } catch (e) {
    props.toast?.('连接失败: ' + e.message, 'error')
  }
}

function handleDisconnect() {
  disconnect()
  connected.value = false
  userName.value = ''
  syncStatus.value = null
  lastSyncInfo.value = ''
  props.toast?.('已断开 GitHub 连接', 'info')
}

async function handleUpload() {
  if (syncing.value) return
  syncing.value = true
  try {
    const data = await collectExportData()
    await uploadData(data)
    syncStatus.value = getSyncStatus()
    lastSyncInfo.value = formatSyncTime()
    props.toast?.('数据已上传到 GitHub', 'success')
  } catch (e) {
    props.toast?.('上传失败: ' + e.message, 'error')
  } finally {
    syncing.value = false
  }
}

async function handleDownload() {
  if (syncing.value) return
  syncing.value = true
  try {
    const data = await downloadData()
    if (!data) {
      props.toast?.('GitHub 上没有数据', 'warning')
      return
    }
    await importFromData(data, true)
    syncStatus.value = getSyncStatus()
    lastSyncInfo.value = formatSyncTime()
    props.toast?.('数据已从 GitHub 恢复', 'success')
  } catch (e) {
    props.toast?.('下载失败: ' + e.message, 'error')
  } finally {
    syncing.value = false
  }
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
      </div>
    </section>

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

    <section class="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">第三方 API 配置</h2>
      <div class="space-y-4">
        <div>
          <label class="block text-sm text-gray-500 dark:text-gray-400 mb-1">
            OMDb API Key
            <span v-if="hasOmdbKey()" class="ml-1 text-emerald-500">✓ 已配置</span>
          </label>
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
        <div>
          <label class="block text-sm text-gray-500 dark:text-gray-400 mb-1">
            TasteDive API Key
            <span v-if="hasTasteDiveKey()" class="ml-1 text-emerald-500">✓ 已配置</span>
          </label>
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

    <section class="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">GitHub 云同步</h2>

      <div v-if="connected" class="mb-4">
        <div class="flex items-center gap-2 mb-2">
          <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span class="text-sm text-gray-700 dark:text-gray-300">
            已连接: <strong>{{ userName }}</strong>
          </span>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          仓库: {{ repoInput }}
          <span v-if="lastSyncInfo"> · 最后同步: {{ lastSyncInfo }}</span>
          <span v-if="syncStatus && !syncStatus.success" class="text-red-400"> · 上次同步失败</span>
        </p>
      </div>

      <div v-if="!connected" class="space-y-3 mb-4">
        <div>
          <label class="block text-sm text-gray-500 dark:text-gray-400 mb-1">GitHub Token</label>
          <input
            v-model="tokenInput"
            type="password"
            placeholder="ghp_xxxxxxxxxxxx"
            class="w-full bg-white dark:bg-gray-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
            在 GitHub → Settings → Developer settings → Personal access tokens 创建，勾选 repo 权限
          </p>
        </div>
        <div>
          <label class="block text-sm text-gray-500 dark:text-gray-400 mb-1">仓库名（可选）</label>
          <input
            v-model="repoInput"
            type="text"
            placeholder="plotnote-data"
            class="w-full bg-white dark:bg-gray-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">留空则自动创建 plotnote-data 私有仓库</p>
        </div>
        <button
          @click="handleConnect"
          class="w-full bg-gray-800 hover:bg-gray-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          连接 GitHub
        </button>
      </div>

      <div v-if="connected" class="space-y-3">
        <div class="flex gap-2">
          <button
            @click="handleUpload"
            :disabled="syncing"
            class="flex-1 bg-gray-800 hover:bg-gray-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            {{ syncing ? '同步中...' : '↑ 上传到 GitHub' }}
          </button>
          <button
            @click="handleDownload"
            :disabled="syncing"
            class="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            {{ syncing ? '同步中...' : '↓ 从 GitHub 恢复' }}
          </button>
        </div>
        <button
          @click="handleDisconnect"
          class="w-full text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 text-sm py-2 transition"
        >
          断开连接
        </button>
      </div>
    </section>

    <section class="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6">
      <h2 class="text-lg font-semibold mb-3">同步说明</h2>
      <ul class="text-sm text-gray-500 dark:text-gray-400 space-y-2">
        <li>• 数据存储在你的 GitHub 私有仓库中，只有你能访问</li>
        <li>• 每次添加/修改/删除作品后自动同步（防抖 30 秒）</li>
        <li>• 打开页面时自动拉取最新数据</li>
        <li>• 你也可以随时手动点击上传或恢复</li>
        <li>• GitHub 仓库有完整版本历史，误操作可回退</li>
      </ul>
    </section>
  </div>
</template>
