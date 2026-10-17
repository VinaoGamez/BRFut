; Custom NSIS installer script for BR Fut
; Overrides electron-builder's default registry key to avoid stale install paths

; Override the registry key used to remember install location
; This MUST be defined before electron-builder's template reads it
!define INSTALL_REGISTRY_KEY "HKCU\Software\BRFut"
!define INSTALL_REGISTRY_KEY_NAME "InstallDir"

InstallDir "$LOCALAPPDATA\Programs\BR Fut"

; Detect and remove any previous installation before installing
!macro preInit
  ; Remove ALL old registry entries that could contain stale paths
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BR Fut"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BR Fut 0.2.1"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BRFut"
  DeleteRegKey HKCU "Software\BRFut"
  DeleteRegKey HKCU "Software\br.com.brfut.desktop"
  DeleteRegKey HKLM "Software\br.com.brfut.desktop"
  
  ; Remove old installation directories
  IfFileExists "$LOCALAPPDATA\Programs\BR Fut" 0 +2
    RMDir /r "$LOCALAPPDATA\Programs\BR Fut"
  IfFileExists "$PROGRAMFILES\BR Fut" 0 +2
    RMDir /r "$PROGRAMFILES\BR Fut"
  IfFileExists "$PROGRAMFILES32\BR Fut" 0 +2
    RMDir /r "$PROGRAMFILES32\BR Fut"
  
  ; Write fresh registry entries
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BR Fut" "DisplayName" "BR Fut"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BR Fut" "DisplayIcon" "$LOCALAPPDATA\Programs\BR Fut\BR Fut.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BR Fut" "UninstallString" '"$LOCALAPPDATA\Programs\BR Fut\Uninstall BR Fut.exe" /S'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BR Fut" "QuietUninstallString" '"$LOCALAPPDATA\Programs\BR Fut\Uninstall BR Fut.exe" /S'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BR Fut" "InstallLocation" "$LOCALAPPDATA\Programs\BR Fut"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BR Fut" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BR Fut" "NoRepair" 1
  WriteRegStr HKCU "Software\BRFut" "InstallDir" "$LOCALAPPDATA\Programs\BR Fut"
!macroend

; Set the install directory in the uninstall registry
!macro customInstall
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BR Fut" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BR Fut" "DisplayName" "BR Fut"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BR Fut" "DisplayIcon" "$INSTDIR\BR Fut.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BR Fut" "UninstallString" '"$INSTDIR\Uninstall BR Fut.exe" /S'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BR Fut" "QuietUninstallString" '"$INSTDIR\Uninstall BR Fut.exe" /S'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BR Fut" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BR Fut" "NoRepair" 1
  WriteRegStr HKCU "Software\BRFut" "InstallDir" "$INSTDIR"
!macroend
