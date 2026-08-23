export interface SettingsSyncState {
  gistId: string
  gistUrl: string
  hasToken: boolean
}

export interface SettingsSyncConfig {
  gistId?: string
  token?: string
  clearToken?: boolean
}

export interface SettingsSyncResult {
  gistId: string
  gistUrl: string
  backupPath?: string
}
