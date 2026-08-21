import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sfxPath = 'C:\\Program Files\\7-Zip-Zstandard\\7z.sfx'
const archivePath = path.join(repoRoot, 'dist', 'work', 'marktext-math-macros.7z')
const outputPath = path.join(repoRoot, 'dist', 'marktext-math-macros-0.19.1-setup.exe')

const config = [
  ';!@Install@!UTF-8!',
  'Title="MarkText math macros 0.19.1"',
  'BeginPrompt="Install MarkText math macros for the current user?"',
  'RunProgram="cmd.exe /c __installer\\install.cmd"',
  ';!@InstallEnd@!',
  ''
].join('\n')

const [sfx, archive] = await Promise.all([
  fs.readFile(sfxPath),
  fs.readFile(archivePath)
])
await fs.writeFile(outputPath, Buffer.concat([
  sfx,
  Buffer.from(config, 'utf8'),
  archive
]))

console.log('Created ' + outputPath)
console.log('Installer bytes: ' + (sfx.length + Buffer.byteLength(config) + archive.length))
