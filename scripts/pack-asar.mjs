import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(repoRoot, 'app')
const outputPath = path.join(repoRoot, 'dist', 'MarkText-math-macros', 'resources', 'app.asar')
const requiredRuntimeModules = [
  'ced',
  'font-list',
  'keytar',
  'native-keymap',
  path.join('@vscode', 'ripgrep-win32-x64')
]

const align4 = (value) => value + ((4 - (value % 4)) % 4)

async function collect(directory, relative = '') {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  entries.sort((left, right) => left.name.localeCompare(right.name))

  const files = {}
  const records = []
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    const entryRelative = relative ? path.join(relative, entry.name) : entry.name
    if (entry.isDirectory()) {
      const child = await collect(entryPath, entryRelative)
      files[entry.name] = { files: child.files }
      records.push(...child.records)
      continue
    }
    if (!entry.isFile()) {
      throw new Error('Unsupported filesystem entry: ' + entryPath)
    }

    const content = await fs.readFile(entryPath)
    const fileEntry = {}
    files[entry.name] = fileEntry
    records.push({ entry: fileEntry, content })
  }

  return { files, records }
}

function makePayload(records) {
  let offset = 0
  const payload = []
  for (const record of records) {
    record.entry.offset = String(offset)
    record.entry.size = record.content.length
    offset += record.content.length
    payload.push(record.content)
  }
  return payload
}

async function main() {
  for (const modulePath of requiredRuntimeModules) {
    await fs.access(path.join(sourceRoot, 'node_modules', modulePath))
  }
  const tree = await collect(sourceRoot)
  const payload = makePayload(tree.records)
  const header = { files: tree.files }
  const headerString = JSON.stringify(header)
  const headerBytes = Buffer.from(headerString, 'utf8')

  // Chromium's Pickle layout, matching @electron/asar:
  // [payloadSize:uint32][headerStringLength:uint32][headerString + padding]
  const headerPayloadSize = 4 + align4(headerBytes.length)
  const headerPickle = Buffer.alloc(4 + headerPayloadSize)
  headerPickle.writeUInt32LE(headerPayloadSize, 0)
  headerPickle.writeUInt32LE(headerBytes.length, 4)
  headerBytes.copy(headerPickle, 8)

  const sizePickle = Buffer.alloc(8)
  sizePickle.writeUInt32LE(4, 0)
  sizePickle.writeUInt32LE(headerPickle.length, 4)

  const output = Buffer.concat([
    sizePickle,
    headerPickle,
    ...payload
  ])
  await fs.writeFile(outputPath, output)

  console.log('Packed ' + output.length + ' bytes into ' + outputPath)
  console.log('Header entries: ' + Object.keys(tree.files).length + ' root entries')
}

await main()
