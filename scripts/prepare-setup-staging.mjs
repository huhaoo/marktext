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
  'set "OFFICIAL_USER_DATA=%APPDATA%\\marktext"',
  'set "MIGRATION_MARKER=%DEST%\\marktext-user-data\\.official-settings-copied"',
  '',
  'if not exist "%DEST%" mkdir "%DEST%"',
  'if not exist "%DEST%\\marktext-user-data" mkdir "%DEST%\\marktext-user-data"',
  'if not exist "%MIGRATION_MARKER%" call :copy_official_settings',
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
  '',
  ':copy_official_settings',
  'if not exist "%OFFICIAL_USER_DATA%" goto :mark_settings_copied',
  'if not exist "%DEST%\\marktext-user-data\\preferences.json" if exist "%OFFICIAL_USER_DATA%\\preferences.json" copy /Y "%OFFICIAL_USER_DATA%\\preferences.json" "%DEST%\\marktext-user-data\\preferences.json" >nul',
  'if not exist "%DEST%\\marktext-user-data\\Local Storage\\leveldb" if exist "%OFFICIAL_USER_DATA%\\Local Storage\\leveldb" robocopy "%OFFICIAL_USER_DATA%\\Local Storage\\leveldb" "%DEST%\\marktext-user-data\\Local Storage\\leveldb" /E /XF LOCK /R:1 /W:1 /NFL /NDL /NJH /NJS /NP >nul',
  'if not exist "%DEST%\\marktext-user-data\\window-state.json" if exist "%OFFICIAL_USER_DATA%\\window-state.json" copy /Y "%OFFICIAL_USER_DATA%\\window-state.json" "%DEST%\\marktext-user-data\\window-state.json" >nul',
  'if not exist "%DEST%\\marktext-user-data\\recently-used-documents.json" if exist "%OFFICIAL_USER_DATA%\\recently-used-documents.json" copy /Y "%OFFICIAL_USER_DATA%\\recently-used-documents.json" "%DEST%\\marktext-user-data\\recently-used-documents.json" >nul',
  '',
  ':mark_settings_copied',
  '> "%MIGRATION_MARKER%" echo MarkText settings copied on %DATE% %TIME%',
  'exit /b 0',
  ''
].join('\r\n')

await fs.mkdir(installerRoot, { recursive: true })
await fs.mkdir(userDataRoot, { recursive: true })
await fs.writeFile(path.join(installerRoot, 'install.cmd'), installScript)
await fs.writeFile(path.join(userDataRoot, '.keep'), '')

console.log('Prepared setup staging: ' + stagingRoot)
