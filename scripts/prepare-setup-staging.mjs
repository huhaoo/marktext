import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const stagingRoot = path.join(repoRoot, 'dist', 'MarkText-math-macros')
const installerRoot = path.join(stagingRoot, '__installer')
const userDataRoot = path.join(stagingRoot, 'marktext-user-data')

const installScript = [
  '@echo off',
  'setlocal',
  '',
  'set "SOURCE=%~dp0.."',
  'set "DEST=%LOCALAPPDATA%\\Programs\\MarkText-math-macros"',
  '',
  'if not exist "%DEST%" mkdir "%DEST%"',
  'if not exist "%DEST%\\marktext-user-data" mkdir "%DEST%\\marktext-user-data"',
  'robocopy "%SOURCE%" "%DEST%" /E /XD "%SOURCE%\\__installer" /R:1 /W:1 /NFL /NDL /NJH /NJS /NP',
  'set "COPY_CODE=%ERRORLEVEL%"',
  '',
  'if %COPY_CODE% GEQ 8 (',
  '  echo MarkText files could not be copied. Robocopy code: %COPY_CODE%',
  '  exit /b %COPY_CODE%',
  ')',
  '',
  'if exist "%DEST%\\marktext.exe" (',
  '  start "" "%DEST%\\marktext.exe" --user-data-dir "%DEST%\\marktext-user-data"',
  ')',
  '',
  'exit /b 0',
  ''
].join('\r\n')

await fs.mkdir(installerRoot, { recursive: true })
await fs.mkdir(userDataRoot, { recursive: true })
await fs.writeFile(path.join(installerRoot, 'install.cmd'), installScript)
await fs.writeFile(path.join(userDataRoot, '.keep'), '')

console.log('Prepared setup staging: ' + stagingRoot)
