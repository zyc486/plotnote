<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  getToken, setToken, getRepo, setRepo,
  testConnection, ensureRepo, isConfigured,
  getSyncStatus, formatSyncTime, disconnect,
  smartSync,
} from '../utils/githubSync'
import { collectExportData, importFromData, exportToJSON, importFromJSON } from '../utils/exportImport'
import { useTheme } from '../utils/theme'

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

async function handleSync() {
  if (syncing.value) return
  syncing.value = true
  try {
    const localData = await collectExportData()
    const result = await smartSync(localData)
    
    if (result.direction === 'download') {
      await importFromData(result.data)
      props.toast?.('数据已从 GitHub 同步到本地', 'success')
    } else {
      props.toast?.('本地数据已同步到 GitHub', 'success')
    }
    
    syncStatus.value = getSyncStatus()
    lastSyncInfo.value = formatSyncTime()
  } catch (e) {
    props.toast?.('同步失败: ' + e.message, 'error')
  } finally {
    syncing.value = false
  }
}
</script>

<template>
  <div class="max-w-xl mx-auto p-4 sm:p-6">
    <header class="flex items-center justify-between mb-6 sm:mb-8">
      <h1 class="text-xl sm:text-2xl font-bold">设置</h1>
      <button @click="router.back()" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm px-2 sm:px-3 py-1.5 sm:py-2 transition">
        ← 返回
      </button>
    </header>

    <section class="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
      <h2 class="text-base sm:text-lg font-semibold mb-3 sm:mb-4">数据管理</h2>
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

    <section class="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
      <h2 class="text-base sm:text-lg font-semibold mb-3 sm:mb-4">外观</h2>
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

    <section class="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
      <h2 class="text-base sm:text-lg font-semibold mb-3 sm:mb-4">GitHub 云同步</h2>

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
        <button
          @click="handleSync"
          :disabled="syncing"
          class="w-full bg-gray-800 hover:bg-gray-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          {{ syncing ? '同步中...' : '同步数据' }}
        </button>
        <button
          @click="handleDisconnect"
          class="w-full text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 text-sm py-2 transition"
        >
          断开连接
        </button>
      </div>
    </section>
  </div>
</template>
