import fsPromises from 'fs/promises'
import path from 'path'
import Store from 'electron-store'
import keytar from 'keytar'
import log from 'electron-log'
import { ipcMain } from 'electron'
import type DataCenter from '../dataCenter'
import type Keybindings from '../keyboard/shortcutHandler'
import type Preference from '../preferences'
import type {
  SettingsSyncConfig,
  SettingsSyncResult,
  SettingsSyncState
} from '@shared/types/settingsSync'
import {
  createSettingsSyncBundle,
  parseSettingsSyncBundle,
  SETTINGS_SYNC_FILE_NAME,
  SETTINGS_SYNC_INTERNAL_KEY,
  type SettingsSyncBundle
} from './bundle'

const SETTINGS_SYNC_STORE_NAME = 'settingsSync'
const SETTINGS_SYNC_SERVICE = 'marktext-settings-sync'
const SETTINGS_SYNC_TOKEN_ACCOUNT = 'github-gist-token'
const GITHUB_API_URL = 'https://api.github.com'
const GITHUB_API_VERSION = '2022-11-28'
const SETTINGS_SYNC_DESCRIPTION = 'MarkText settings sync'

interface SettingsSyncStore {
  gistId: string
}

interface GithubGistFile {
  content?: unknown
  raw_url?: unknown
  truncated?: unknown
}

interface GithubGist {
  id?: unknown
  html_url?: unknown
  files?: Record<string, GithubGistFile>
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

class SettingsSync {
  private readonly preferences: Preference
  private readonly dataCenter: DataCenter
  private readonly keybindings: Keybindings
  private readonly userDataPath: string
  private readonly store: Store<SettingsSyncStore>

  constructor(
    preferences: Preference,
    dataCenter: DataCenter,
    keybindings: Keybindings,
    userDataPath: string
  ) {
    this.preferences = preferences
    this.dataCenter = dataCenter
    this.keybindings = keybindings
    this.userDataPath = userDataPath
    this.store = new Store<SettingsSyncStore>({
      name: SETTINGS_SYNC_STORE_NAME,
      defaults: { gistId: '' }
    })
    this._listenForIpcMain()
  }

  async getState(): Promise<SettingsSyncState> {
    const gistId = this._getGistId()
    return {
      gistId,
      gistUrl: this._getGistUrl(gistId),
      hasToken: Boolean(await this._getToken())
    }
  }

  async configure(config: SettingsSyncConfig): Promise<SettingsSyncState> {
    if (typeof config.gistId !== 'undefined') {
      this.store.set('gistId', this._normalizeGistId(config.gistId))
    }

    if (config.clearToken) {
      try {
        await keytar.deletePassword(SETTINGS_SYNC_SERVICE, SETTINGS_SYNC_TOKEN_ACCOUNT)
      } catch (error) {
        log.error('Failed to clear GitHub Gist token:', error)
        throw new Error('无法清除 GitHub token。')
      }
    } else if (typeof config.token === 'string' && config.token.trim()) {
      try {
        await keytar.setPassword(
          SETTINGS_SYNC_SERVICE,
          SETTINGS_SYNC_TOKEN_ACCOUNT,
          config.token.trim()
        )
      } catch (error) {
        log.error('Failed to save GitHub Gist token:', error)
        throw new Error('无法保存 GitHub token，请检查系统凭据存储。')
      }
    }

    return this.getState()
  }

  async upload(): Promise<SettingsSyncResult> {
    const token = await this._getToken()
    if (!token) {
      throw new Error('上传设置前，请先填写 GitHub token。')
    }

    const bundle = await this._createBundle()
    const gistId = this._getGistId()
    const files = {
      [SETTINGS_SYNC_FILE_NAME]: {
        content: JSON.stringify(bundle, null, 2)
      }
    }
    const body = gistId
      ? { description: SETTINGS_SYNC_DESCRIPTION, files }
      : { description: SETTINGS_SYNC_DESCRIPTION, public: false, files }
    const gist = (await this._request(
      gistId ? `/gists/${gistId}` : '/gists',
      gistId ? 'PATCH' : 'POST',
      token,
      body
    )) as GithubGist
    const savedGistId = typeof gist.id === 'string' ? gist.id : gistId
    if (!savedGistId) {
      throw new Error('GitHub 没有返回有效的 Gist ID。')
    }

    this.store.set('gistId', savedGistId)
    return {
      gistId: savedGistId,
      gistUrl: typeof gist.html_url === 'string' ? gist.html_url : this._getGistUrl(savedGistId)
    }
  }

  async download(): Promise<SettingsSyncResult> {
    const gistId = this._getGistId()
    if (!gistId) {
      throw new Error('下载设置前，请先填写 Gist ID 或 Gist URL。')
    }

    const token = await this._getToken()
    const gist = (await this._request(`/gists/${gistId}`, 'GET', token)) as GithubGist
    const file = gist.files?.[SETTINGS_SYNC_FILE_NAME]
    if (!file) {
      throw new Error(`Gist 中没有找到 ${SETTINGS_SYNC_FILE_NAME}。`)
    }

    const content = await this._getFileContent(file, token)
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new Error('Gist 中的设置文件不是有效 JSON。')
    }
    const bundle = parseSettingsSyncBundle(parsed)
    const backupPath = await this._backupCurrentSettings()
    await this._applyBundle(bundle)

    return {
      gistId,
      gistUrl: typeof gist.html_url === 'string' ? gist.html_url : this._getGistUrl(gistId),
      backupPath
    }
  }

  private async _createBundle(): Promise<SettingsSyncBundle> {
    const dataCenter = await this.dataCenter.getAll()
    return createSettingsSyncBundle(
      this.preferences.getAll() as unknown as Record<string, unknown>,
      dataCenter,
      this.keybindings.getUserKeybindings()
    )
  }

  private async _backupCurrentSettings(): Promise<string> {
    const backupDirectory = path.join(this.userDataPath, 'settings-sync-backups')
    await fsPromises.mkdir(backupDirectory, { recursive: true })
    const timestamp = new Date().toISOString().replace(/[.:]/g, '-')
    const backupPath = path.join(backupDirectory, `before-import-${timestamp}.json`)
    const bundle = await this._createBundle()
    await fsPromises.writeFile(backupPath, JSON.stringify(bundle, null, 2), 'utf8')
    return backupPath
  }

  private async _applyBundle(bundle: SettingsSyncBundle): Promise<void> {
    const preferenceKeys = new Set(Object.keys(this.preferences.getAll()))
    const preferenceUpdates = this._pickKnownKeys(bundle.preferences, preferenceKeys)
    this.preferences.setItems(preferenceUpdates)

    const currentDataCenter = await this.dataCenter.getAll()
    const dataCenterKeys = new Set(Object.keys(currentDataCenter))
    const dataCenterUpdates = this._pickKnownKeys(bundle.dataCenter, dataCenterKeys)
    await this.dataCenter.setItems(dataCenterUpdates)

    const saved = await this.keybindings.setUserKeybindings(Object.entries(bundle.keybindings))
    if (!saved) {
      throw new Error('快捷键设置保存失败。')
    }
  }

  private _pickKnownKeys(
    source: Record<string, unknown>,
    knownKeys: Set<string>
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(source).filter(
        ([key]) => key !== SETTINGS_SYNC_INTERNAL_KEY && knownKeys.has(key)
      )
    )
  }

  private async _getFileContent(file: GithubGistFile, token: string): Promise<string> {
    if (file.truncated === true && typeof file.raw_url === 'string') {
      return this._requestText(file.raw_url, token)
    }
    if (typeof file.content === 'string') {
      return file.content
    }
    throw new Error(`${SETTINGS_SYNC_FILE_NAME} 内容不可用。`)
  }

  private async _request(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH',
    token: string,
    body?: unknown
  ): Promise<unknown> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
      'User-Agent': 'MarkText settings sync'
    }
    if (token) headers.Authorization = `Bearer ${token}`
    if (typeof body !== 'undefined') headers['Content-Type'] = 'application/json'

    const response = await fetch(`${GITHUB_API_URL}${endpoint}`, {
      method,
      headers,
      body: typeof body === 'undefined' ? undefined : JSON.stringify(body)
    })
    const responseText = await response.text()
    let responseBody: unknown = responseText
    try {
      responseBody = JSON.parse(responseText)
    } catch {
      // Keep the plain-text response for a useful error message.
    }

    if (!response.ok) {
      const message =
        isRecord(responseBody) && typeof responseBody.message === 'string'
          ? responseBody.message
          : responseText || response.statusText
      throw new Error(`GitHub Gist 请求失败（${response.status}）：${message}`)
    }
    return responseBody
  }

  private async _requestText(url: string, token: string): Promise<string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.raw',
      'User-Agent': 'MarkText settings sync'
    }
    if (token) headers.Authorization = `Bearer ${token}`
    const response = await fetch(url, { headers })
    const content = await response.text()
    if (!response.ok) {
      throw new Error(`GitHub Gist 文件下载失败（${response.status}）：${content}`)
    }
    return content
  }

  private async _getToken(): Promise<string> {
    try {
      return (
        (await keytar.getPassword(SETTINGS_SYNC_SERVICE, SETTINGS_SYNC_TOKEN_ACCOUNT))?.trim() ?? ''
      )
    } catch (error) {
      log.error('Failed to read GitHub Gist token:', error)
      return ''
    }
  }

  private _getGistId(): string {
    return this.store.get('gistId') || ''
  }

  private _getGistUrl(gistId: string): string {
    return gistId ? `https://gist.github.com/${gistId}` : ''
  }

  private _normalizeGistId(value: string): string {
    const input = value.trim()
    if (!input) return ''

    let candidate = input
    try {
      const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`)
      const segments = url.pathname.split('/').filter(Boolean)
      if (segments.length > 0) {
        candidate = segments[segments.length - 1] ?? ''
      }
    } catch {
      // Treat the value as a plain Gist ID below.
    }

    if (!candidate || !/^[a-zA-Z0-9_-]+$/.test(candidate)) {
      throw new Error('Gist ID 或 URL 无效。')
    }
    return candidate
  }

  private _listenForIpcMain(): void {
    // Importing this class creates exactly one Accessor, so these handlers are
    // registered once during main-process startup.
    ipcMain.handle('mt::settings-sync::configure', (_event, config: SettingsSyncConfig) =>
      this.configure(config)
    )
    ipcMain.handle('mt::settings-sync::download', () => this.download())
    ipcMain.handle('mt::settings-sync::get-state', () => this.getState())
    ipcMain.handle('mt::settings-sync::upload', () => this.upload())
  }
}

export default SettingsSync
