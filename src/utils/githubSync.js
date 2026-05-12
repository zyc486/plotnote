const TOKEN_KEY = 'plotnote_github_token'
const REPO_KEY = 'plotnote_github_repo'
const SYNC_STATUS_KEY = 'plotnote_sync_status'
const API = 'https://api.github.com'

const FILE_NAME = 'data.json'
const REPO_NAME = 'plotnote-data'

function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return hash.toString(36)
}

let syncing = false

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export function getRepo() {
  return localStorage.getItem(REPO_KEY) || ''
}

export function setRepo(repo) {
  if (repo) {
    localStorage.setItem(REPO_KEY, repo)
  } else {
    localStorage.removeItem(REPO_KEY)
  }
}

export function getSyncStatus() {
  try {
    const raw = localStorage.getItem(SYNC_STATUS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveSyncStatus(status) {
  localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(status))
}

export function isConfigured() {
  return !!getToken() && !!getRepo()
}

export function isSyncing() {
  return syncing
}

function headers(token) {
  return {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  }
}

export async function testConnection(token) {
  const res = await fetch(`${API}/user`, { headers: headers(token) })
  if (!res.ok) throw new Error('Token 无效或已过期')
  const user = await res.json()
  return { login: user.login, name: user.name || user.login }
}

export async function ensureRepo(token) {
  const repoName = getRepo() || REPO_NAME
  setRepo(repoName)

  const res = await fetch(`${API}/repos/${(await testConnection(token)).login}/${repoName}`, {
    headers: headers(token),
  })

  if (res.status === 404) {
    const createRes = await fetch(`${API}/user/repos`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        name: repoName,
        private: true,
        auto_init: true,
        description: 'PlotNote cloud sync data',
      }),
    })
    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}))
      throw new Error(err.message || '创建仓库失败')
    }
    return createRes.json()
  }

  if (!res.ok) throw new Error('检查仓库失败')
  return res.json()
}

async function getFile(token, repo, path) {
  const user = await testConnection(token)
  const res = await fetch(`${API}/repos/${user.login}/${repo}/contents/${path}`, {
    headers: headers(token),
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error('读取文件失败')
  return await res.json()
}

async function putFile(token, repo, path, content, sha, message) {
  const user = await testConnection(token)
  const body = {
    message: message || `sync ${new Date().toISOString()}`,
    content: btoa(unescape(encodeURIComponent(content))),
  }
  if (sha) body.sha = sha

  const res = await fetch(`${API}/repos/${user.login}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || '上传文件失败')
  }
  return await res.json()
}

let lastUploadedHash = ''

export async function uploadData(data) {
  if (syncing) return null
  syncing = true

  try {
    const token = getToken()
    const repo = getRepo()
    if (!token || !repo) throw new Error('未配置 GitHub')

    const payload = JSON.stringify(data, null, 2)
    const payloadHash = simpleHash(payload)
    if (payloadHash === lastUploadedHash) {
      return { lastSync: Date.now(), direction: 'upload', success: true, skipped: true }
    }

    const existing = await getFile(token, repo, FILE_NAME)
    const sha = existing ? existing.sha : null

    const result = await putFile(token, repo, FILE_NAME, payload, sha, `PlotNote sync ${new Date().toLocaleString('zh-CN')}`)

    const status = {
      lastSync: Date.now(),
      direction: 'upload',
      success: true,
    }
    saveSyncStatus(status)
    lastUploadedHash = payloadHash
    return status
  } catch (e) {
    const status = {
      lastSync: Date.now(),
      direction: 'upload',
      success: false,
      error: e.message,
    }
    saveSyncStatus(status)
    throw e
  } finally {
    syncing = false
  }
}

export async function downloadData() {
  if (syncing) return null
  syncing = true

  try {
    const token = getToken()
    const repo = getRepo()
    if (!token || !repo) throw new Error('未配置 GitHub')

    const file = await getFile(token, repo, FILE_NAME)
    if (!file) return null

    const content = decodeURIComponent(escape(atob(file.content)))
    const data = JSON.parse(content)

    const status = {
      lastSync: Date.now(),
      direction: 'download',
      success: true,
    }
    saveSyncStatus(status)
    return data
  } catch (e) {
    const status = {
      lastSync: Date.now(),
      direction: 'download',
      success: false,
      error: e.message,
    }
    saveSyncStatus(status)
    throw e
  } finally {
    syncing = false
  }
}

export async function smartSync(localData) {
  if (!isConfigured()) return null
  if (syncing) return null
  syncing = true

  try {
    const token = getToken()
    const repo = getRepo()
    if (!token || !repo) throw new Error('未配置 GitHub')

    const existing = await getFile(token, repo, FILE_NAME)

    if (!existing) {
      const payload = JSON.stringify(localData, null, 2)
      await putFile(token, repo, FILE_NAME, payload, null, `PlotNote sync ${new Date().toLocaleString('zh-CN')}`)
      lastUploadedHash = simpleHash(payload)
      saveSyncStatus({ lastSync: Date.now(), direction: 'upload', success: true })
      return { direction: 'upload', data: localData }
    }

    const remoteContent = decodeURIComponent(escape(atob(existing.content)))
    const remoteData = JSON.parse(remoteContent)

    const localTime = new Date(localData.exportedAt || 0).getTime()
    const remoteTime = new Date(remoteData.exportedAt || 0).getTime()

    if (remoteTime > localTime) {
      saveSyncStatus({ lastSync: Date.now(), direction: 'download', success: true })
      return { direction: 'download', data: remoteData }
    }

    const payload = JSON.stringify(localData, null, 2)
    const payloadHash = simpleHash(payload)
    if (payloadHash === lastUploadedHash) {
      saveSyncStatus({ lastSync: Date.now(), direction: 'skip', success: true })
      return { direction: 'skip', data: localData }
    }

    await putFile(token, repo, FILE_NAME, payload, existing.sha, `PlotNote sync ${new Date().toLocaleString('zh-CN')}`)
    lastUploadedHash = payloadHash
    saveSyncStatus({ lastSync: Date.now(), direction: 'upload', success: true })
    return { direction: 'upload', data: localData }
  } catch (e) {
    saveSyncStatus({ lastSync: Date.now(), direction: 'sync', success: false, error: e.message })
    throw e
  } finally {
    syncing = false
  }
}

export async function syncNow(data) {
  if (!isConfigured()) return null
  try {
    return await uploadData(data)
  } catch (e) {
    console.warn('GitHub 同步失败:', e.message)
    throw e
  }
}

export function formatSyncTime() {
  const status = getSyncStatus()
  if (!status || !status.lastSync) return ''
  const d = new Date(status.lastSync)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function disconnect() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REPO_KEY)
  localStorage.removeItem(SYNC_STATUS_KEY)
}
