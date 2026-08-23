export const SETTINGS_SYNC_FORMAT_VERSION = 1
export const SETTINGS_SYNC_FILE_NAME = 'marktext-settings.json'
export const SETTINGS_SYNC_INTERNAL_KEY = '__internal__'

export interface SettingsSyncBundle {
  formatVersion: typeof SETTINGS_SYNC_FORMAT_VERSION
  product: 'marktext'
  preferences: Record<string, unknown>
  dataCenter: Record<string, unknown>
  keybindings: Record<string, string>
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

const omitInternalKeys = (value: Record<string, unknown>): Record<string, unknown> => {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== SETTINGS_SYNC_INTERNAL_KEY)
  )
}

export const createSettingsSyncBundle = (
  preferences: Record<string, unknown>,
  dataCenter: Record<string, unknown>,
  keybindings: Map<string, string> | Record<string, string>
): SettingsSyncBundle => ({
  formatVersion: SETTINGS_SYNC_FORMAT_VERSION,
  product: 'marktext',
  preferences: omitInternalKeys(preferences),
  dataCenter: omitInternalKeys(dataCenter),
  keybindings: keybindings instanceof Map ? Object.fromEntries(keybindings) : { ...keybindings }
})

export const parseSettingsSyncBundle = (value: unknown): SettingsSyncBundle => {
  if (!isRecord(value)) {
    throw new Error('设置同步文件必须是 JSON 对象。')
  }
  if (value.formatVersion !== SETTINGS_SYNC_FORMAT_VERSION) {
    throw new Error(`不支持的设置同步版本：${String(value.formatVersion)}`)
  }
  if (value.product !== 'marktext') {
    throw new Error('这不是 MarkText 设置同步文件。')
  }
  if (!isRecord(value.preferences)) {
    throw new Error('设置同步文件缺少有效的 preferences。')
  }
  if (!isRecord(value.dataCenter)) {
    throw new Error('设置同步文件缺少有效的 dataCenter。')
  }
  if (!isRecord(value.keybindings)) {
    throw new Error('设置同步文件缺少有效的 keybindings。')
  }

  const keybindings: Record<string, string> = {}
  for (const [key, accelerator] of Object.entries(value.keybindings)) {
    if (typeof accelerator !== 'string') {
      throw new Error(`快捷键 "${key}" 的值不是字符串。`)
    }
    keybindings[key] = accelerator
  }

  return {
    formatVersion: SETTINGS_SYNC_FORMAT_VERSION,
    product: 'marktext',
    preferences: omitInternalKeys(value.preferences),
    dataCenter: omitInternalKeys(value.dataCenter),
    keybindings
  }
}
