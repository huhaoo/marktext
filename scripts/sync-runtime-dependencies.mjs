import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(
  repoRoot,
  'dist',
  'MarkText-math-macros',
  'resources',
  'app.asar.unpacked',
  'node_modules'
)
const targetRoot = path.join(repoRoot, 'app', 'node_modules')
const modules = [
  'ced',
  'font-list',
  'keytar',
  'native-keymap',
  path.join('@vscode', 'ripgrep-win32-x64')
]

for (const modulePath of modules) {
  const source = path.join(sourceRoot, modulePath)
  const target = path.join(targetRoot, modulePath)
  await fs.access(source)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.cp(source, target, { recursive: true, force: true })
}

console.log('Synchronized runtime dependencies: ' + modules.join(', '))
