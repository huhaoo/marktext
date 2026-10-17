import assert from 'node:assert/strict'
import {
  createSettingsSyncBundle,
  getPortableDataCenterSettings,
  parseSettingsSyncBundle
} from '../packages/desktop/src/main/settingsSync/bundle.ts'

const bundle = createSettingsSyncBundle(
  { mathMacros: String.raw`\R = \mathbb{R}`, __internal__: { migrations: {} } },
  { imageFolderPath: 'assets', imageRelativeDirectoryName: 'assets' },
  new Map([['file.save', 'CmdOrCtrl+S']])
)

assert.equal(bundle.formatVersion, 1)
assert.equal(bundle.product, 'marktext')
assert.equal(bundle.dataCenter.imageFolderPath, 'assets')
assert.equal(bundle.keybindings['file.save'], 'CmdOrCtrl+S')
assert.equal(Object.hasOwn(bundle.preferences, '__internal__'), false)
assert.deepEqual(parseSettingsSyncBundle(JSON.parse(JSON.stringify(bundle))), bundle)
const parsedWithInternalKey = parseSettingsSyncBundle({
  ...bundle,
  preferences: { ...bundle.preferences, __internal__: { migrations: {} } }
})
assert.equal(Object.hasOwn(parsedWithInternalKey.preferences, '__internal__'), false)
assert.throws(
  () => parseSettingsSyncBundle({ ...bundle, product: 'other-app' }),
  /不是 MarkText 设置同步文件/
)

const localSettings = {
  imageFolderPath: String.raw`C:\Users\Administrator\AppData\Local\Programs\marktext\marktext-user-data\images`,
  screenshotFolderPath: String.raw`C:\Users\Administrator\AppData\Local\Programs\marktext\marktext-user-data\screenshot`
}
const remoteSettings = {
  imageFolderPath: String.raw`C:\Users\hh826\AppData\Local\Programs\marktext\marktext-user-data\images`,
  screenshotFolderPath: String.raw`C:\Users\hh826\AppData\Local\Programs\marktext\marktext-user-data\screenshot`,
  imageRelativeDirectoryName: 'assets',
  currentUploader: 'picgo'
}
const portableSettings = getPortableDataCenterSettings(remoteSettings)
assert.deepEqual(portableSettings, {
  imageRelativeDirectoryName: 'assets',
  currentUploader: 'picgo'
})
assert.deepEqual({ ...localSettings, ...portableSettings }, {
  ...localSettings,
  imageRelativeDirectoryName: 'assets',
  currentUploader: 'picgo'
})
for (const directory of [
  '/Users/other/Library/Application Support/marktext/images',
  String.raw`\\server\share\images`,
  'C:/Users/other/images',
  'C:images',
  '',
  null
]) {
  assert.deepEqual(getPortableDataCenterSettings({ imageFolderPath: directory }), {})
}
assert.deepEqual(getPortableDataCenterSettings({ imageFolderPath: 'assets' }), {
  imageFolderPath: 'assets'
})
// Backups retain the original local paths; only network transfer filters them.
assert.deepEqual(createSettingsSyncBundle({}, remoteSettings, {}).dataCenter, remoteSettings)
assert.deepEqual(
  parseSettingsSyncBundle(createSettingsSyncBundle({}, remoteSettings, {})).dataCenter,
  remoteSettings
)

console.log('Settings sync bundle and portable paths: ok')
