import { collectExportData, importFromJSON } from './exportImport'
import { syncNow, isConfigured } from './githubSync'

const BACKUP_KEY = 'plotnote_auto_backup'
const MAX_BACKUP_SIZE = 4 * 1024 * 1024
const STALE_DAYS = 7

let backupTimer = null
let githubSyncTimer = null
const GITHUB_SYNC_DELAY = 30000

export function scheduleBackup() {
  if (backupTimer) clearTimeout(backupTimer)
  backupTimer = setTimeout(async () => {
    try {
      const data = await collectExportData()
      const payload = JSON.stringify(data)
      if (payload.length > MAX_BACKUP_SIZE) {
        console.warn('数据量超过 4MB，跳过自动备份')
        return
      }
      localStorage.setItem(BACKUP_KEY, JSON.stringify({
        data,
        timestamp: Date.now(),
      }))

      if (isConfigured()) {
        scheduleGitHubSync()
      }
    } catch (e) {
      console.warn('自动备份失败:', e)
    }
  }, 5000)
}

function scheduleGitHubSync() {
  if (githubSyncTimer) clearTimeout(githubSyncTimer)
  githubSyncTimer = setTimeout(async () => {
    try {
      const data = await collectExportData()
      await syncNow(data)
    } catch (e) {
      console.warn('GitHub 同步失败:', e.message)
    }
  }, GITHUB_SYNC_DELAY)
}

export function getBackupInfo() {
  try {
    const raw = localStorage.getItem(BACKUP_KEY)
    if (!raw) return null
    const { timestamp } = JSON.parse(raw)
    return { timestamp }
  } catch {
    return null
  }
}

export function getBackupAge() {
  const info = getBackupInfo()
  if (!info) return null
  return Math.floor((Date.now() - info.timestamp) / (1000 * 60 * 60 * 24))
}

export function getBackupStatus() {
  const days = getBackupAge()
  if (days === null) return 'none'
  if (days <= STALE_DAYS) return 'fresh'
  if (days <= 30) return 'stale'
  return 'old'
}

export function restoreFromBackup() {
  try {
    const raw = localStorage.getItem(BACKUP_KEY)
    if (!raw) return null
    return JSON.parse(raw).data
  } catch {
    return null
  }
}

export async function checkAndRestore() {
  const { db } = await import('../db')
  const showCount = await db.shows.count()
  if (showCount > 0) return null

  const backup = restoreFromBackup()
  if (!backup) return null
  return backup
}

export function formatBackupTime() {
  const info = getBackupInfo()
  if (!info) return ''
  const d = new Date(info.timestamp)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
