; Use electron-builder's native NSIS lifecycle and registry identity (APP_GUID).
; Do not delete files or registrations in preInit: merely opening/cancelling
; the wizard must preserve the installed game. Native NSIS handles upgrades,
; the selected directory and /D, shortcuts and the uninstall registration.

!macro customInstall
  ; Remove only duplicate entries made by the old custom script, AFTER the
  ; native installer has installed the application and registered its uninstaller.
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BR Fut"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BR Fut 0.2.1"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BRFut"
!macroend
