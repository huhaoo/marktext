import assert from 'node:assert/strict'
import {
  createSettingsSyncBundle,
  parseSettingsSyncBundle
} from '../packages/desktop/src/main/settingsSync/bundle.ts'

const bundle = createSettingsSyncBundle(
  { mathMacros: String.raw`\R = \mathbb{R}` },
  { imageFolderPath: 'assets', imageRelativeDirectoryName: 'assets' },
  new Map([['file.save', 'CmdOrCtrl+S']])
)

assert.equal(bundle.formatVersion, 1)
assert.equal(bundle.product, 'marktext')
assert.equal(bundle.dataCenter.imageFolderPath, 'assets')
assert.equal(bundle.keybindings['file.save'], 'CmdOrCtrl+S')
assert.deepEqual(parseSettingsSyncBundle(JSON.parse(JSON.stringify(bundle))), bundle)
assert.throws(
  () => parseSettingsSyncBundle({ ...bundle, product: 'other-app' }),
  /不是 MarkText 设置同步文件/
)

console.log('Settings sync bundle: ok')
