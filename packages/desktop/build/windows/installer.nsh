; installer.nsh — include via electron-builder’s nsis.include
!define PERSONAL_SETTINGS_BACKUP "$APPDATA\marktext-huhaoo"

;======================================================================
; customInstall macro is invoked by electron-builder after files are in $INSTDIR
!macro customInstall
  ; Keep the personal build separate from the official app. Never overwrite
  ; an existing personal preferences file during an update or reinstall.
  IfFileExists "$INSTDIR\marktext-user-data\preferences.json" PreserveExistingSettings
  CreateDirectory "$INSTDIR\marktext-user-data"

  ; Restore data saved by the previous personal installation before falling
  ; back to the official user's settings.
  IfFileExists "${PERSONAL_SETTINGS_BACKUP}\preferences.json" RestorePersonalSettings
  IfFileExists "$APPDATA\marktext\preferences.json" CopySettingsPreference
    Goto SkipSettingsPreference
  CopySettingsPreference:
    CopyFiles /SILENT "$APPDATA\marktext\preferences.json" "$INSTDIR\marktext-user-data"
  SkipSettingsPreference:
  IfFileExists "$APPDATA\marktext\Local Storage" CopySettingsStorage
    Goto SkipSettingsStorage
  CopySettingsStorage:
    CreateDirectory "$INSTDIR\marktext-user-data\Local Storage"
    CopyFiles /SILENT "$APPDATA\marktext\Local Storage\*" "$INSTDIR\marktext-user-data\Local Storage"
  SkipSettingsStorage:
  IfFileExists "$APPDATA\marktext\window-state.json" CopySettingsWindow
    Goto SkipSettingsWindow
  CopySettingsWindow:
    CopyFiles /SILENT "$APPDATA\marktext\window-state.json" "$INSTDIR\marktext-user-data"
  SkipSettingsWindow:
  IfFileExists "$APPDATA\marktext\recently-used-documents.json" CopySettingsRecent
    Goto SkipSettingsRecent
  CopySettingsRecent:
    CopyFiles /SILENT "$APPDATA\marktext\recently-used-documents.json" "$INSTDIR\marktext-user-data"
  SkipSettingsRecent:
  Goto FinishSettingsCopy

  RestorePersonalSettings:
    CopyFiles /SILENT "${PERSONAL_SETTINGS_BACKUP}\preferences.json" "$INSTDIR\marktext-user-data"
    IfFileExists "${PERSONAL_SETTINGS_BACKUP}\dataCenter.json" RestoreDataCenter
      Goto RestoreKeybindings
  RestoreDataCenter:
    CopyFiles /SILENT "${PERSONAL_SETTINGS_BACKUP}\dataCenter.json" "$INSTDIR\marktext-user-data"
  RestoreKeybindings:
    IfFileExists "${PERSONAL_SETTINGS_BACKUP}\keybindings.json" CopyKeybindings
      Goto RestoreSettingsSync
  CopyKeybindings:
    CopyFiles /SILENT "${PERSONAL_SETTINGS_BACKUP}\keybindings.json" "$INSTDIR\marktext-user-data"
  RestoreSettingsSync:
    IfFileExists "${PERSONAL_SETTINGS_BACKUP}\settingsSync.json" CopySettingsSync
      Goto FinishSettingsCopy
  CopySettingsSync:
    CopyFiles /SILENT "${PERSONAL_SETTINGS_BACKUP}\settingsSync.json" "$INSTDIR\marktext-user-data"

  FinishSettingsCopy:
  FileOpen $0 "$INSTDIR\marktext-user-data\.official-settings-copied" w
  FileWrite $0 "Personal settings preserved or copied.$\r$\n"
  FileClose $0
  Goto SkipSettingsCopy

  PreserveExistingSettings:
    ; Seed the persistent backup before an upgrade can replace the install
    ; directory. This also covers upgrades from the previous installer.
    CreateDirectory "${PERSONAL_SETTINGS_BACKUP}"
    CopyFiles /SILENT "$INSTDIR\marktext-user-data\preferences.json" "${PERSONAL_SETTINGS_BACKUP}"
    IfFileExists "$INSTDIR\marktext-user-data\dataCenter.json" BackupExistingDataCenter
      Goto BackupExistingKeybindings
  BackupExistingDataCenter:
    CopyFiles /SILENT "$INSTDIR\marktext-user-data\dataCenter.json" "${PERSONAL_SETTINGS_BACKUP}"
  BackupExistingKeybindings:
    IfFileExists "$INSTDIR\marktext-user-data\keybindings.json" CopyExistingKeybindings
      Goto BackupExistingSettingsSync
  CopyExistingKeybindings:
    CopyFiles /SILENT "$INSTDIR\marktext-user-data\keybindings.json" "${PERSONAL_SETTINGS_BACKUP}"
  BackupExistingSettingsSync:
    IfFileExists "$INSTDIR\marktext-user-data\settingsSync.json" CopyExistingSettingsSync
      Goto SkipSettingsCopy
  CopyExistingSettingsSync:
    CopyFiles /SILENT "$INSTDIR\marktext-user-data\settingsSync.json" "${PERSONAL_SETTINGS_BACKUP}"
SkipSettingsCopy:

  ; Ask the user if they want to register file associations
  MessageBox MB_YESNO|MB_ICONQUESTION \
  "Do you want to associate Markdown files (.md, .markdown, .mmd, .mdown, .mdtext, .mdx) with MarkText?" /SD IDNO IDNO SkipAssoc

  ;— User clicked YES, perform the registry writes —
  WriteRegStr HKCU "Software\Classes\.md"       "" "MarkText.Document"
  WriteRegStr HKCU "Software\Classes\.markdown" "" "MarkText.Document"
  WriteRegStr HKCU "Software\Classes\.mmd"      "" "MarkText.Document"
  WriteRegStr HKCU "Software\Classes\.mdown"    "" "MarkText.Document"
  WriteRegStr HKCU "Software\Classes\.mdtxt"    "" "MarkText.Document"
  WriteRegStr HKCU "Software\Classes\.mdtext"   "" "MarkText.Document"
  WriteRegStr HKCU "Software\Classes\.mdx"      "" "MarkText.Document"

  WriteRegStr HKCU "Software\Classes\MarkText.Document" \
    "" "MarkText Markdown Document"
  WriteRegExpandStr HKCU "Software\Classes\MarkText.Document\DefaultIcon" \
    "" "$INSTDIR\resources\icons\md.ico,0"
  WriteRegExpandStr HKCU "Software\Classes\MarkText.Document\shell\open\command" \
    "" '"$INSTDIR\marktext.exe" "%1"'

SkipAssoc:
!macroend

;======================================================================
; customUnInstall macro cleans up on uninstall
!macro customUnInstall
  ; Keep personal settings outside the installation directory so a full
  ; uninstall followed by a reinstall does not lose LaTeX macros or sync IDs.
  IfFileExists "$INSTDIR\marktext-user-data\preferences.json" BackupPersonalSettings
    Goto AskDeleteSettings
  BackupPersonalSettings:
    CreateDirectory "${PERSONAL_SETTINGS_BACKUP}"
    CopyFiles /SILENT "$INSTDIR\marktext-user-data\preferences.json" "${PERSONAL_SETTINGS_BACKUP}"
    IfFileExists "$INSTDIR\marktext-user-data\dataCenter.json" BackupDataCenter
      Goto BackupKeybindings
  BackupDataCenter:
    CopyFiles /SILENT "$INSTDIR\marktext-user-data\dataCenter.json" "${PERSONAL_SETTINGS_BACKUP}"
  BackupKeybindings:
    IfFileExists "$INSTDIR\marktext-user-data\keybindings.json" CopyBackupKeybindings
      Goto BackupSettingsSync
  CopyBackupKeybindings:
    CopyFiles /SILENT "$INSTDIR\marktext-user-data\keybindings.json" "${PERSONAL_SETTINGS_BACKUP}"
  BackupSettingsSync:
    IfFileExists "$INSTDIR\marktext-user-data\settingsSync.json" CopyBackupSettingsSync
      Goto AskDeleteSettings
  CopyBackupSettingsSync:
    CopyFiles /SILENT "$INSTDIR\marktext-user-data\settingsSync.json" "${PERSONAL_SETTINGS_BACKUP}"

  AskDeleteSettings:
  ; Delete the open command subtree
  DeleteRegKey HKCU "Software\Classes\MarkText.Document\shell\open\command"
  DeleteRegKey HKCU "Software\Classes\MarkText.Document\shell\open"
  DeleteRegKey HKCU "Software\Classes\MarkText.Document\shell"

  ; Delete the DefaultIcon and ProgID
  DeleteRegKey HKCU "Software\Classes\MarkText.Document\DefaultIcon"
  DeleteRegKey HKCU "Software\Classes\MarkText.Document"

  ; Delete each extension mapping
  DeleteRegKey HKCU "Software\Classes\.md"
  DeleteRegKey HKCU "Software\Classes\.markdown"
  DeleteRegKey HKCU "Software\Classes\.mmd"
  DeleteRegKey HKCU "Software\Classes\.mdown"
  DeleteRegKey HKCU "Software\Classes\.mdtxt"
  DeleteRegKey HKCU "Software\Classes\.mdtext"
  DeleteRegKey HKCU "Software\Classes\.mdx"

  MessageBox MB_YESNO "Do you want to delete user settings?" /SD IDNO IDNO SkipRemoval
    SetShellVarContext current
    RMDir /r "$APPDATA\marktext"
    RMDir /r "${PERSONAL_SETTINGS_BACKUP}"
  SkipRemoval:
!macroend
