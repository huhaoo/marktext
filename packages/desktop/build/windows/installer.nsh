; installer.nsh — include via electron-builder’s nsis.include

;======================================================================
; customInstall macro is invoked by electron-builder after files are in $INSTDIR
!macro customInstall
  ; Keep the personal build separate from the official app, but seed it with
  ; the official user's settings on the first installation only.
  IfFileExists "$INSTDIR\marktext-user-data\.official-settings-copied" SkipSettingsCopy
  CreateDirectory "$INSTDIR\marktext-user-data"
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
  FileOpen $0 "$INSTDIR\marktext-user-data\.official-settings-copied" w
  FileWrite $0 "Settings copied from %APPDATA%\\marktext.$\r$\n"
  FileClose $0
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
  SkipRemoval:
!macroend
