!macro NSIS_HOOK_PREINSTALL
  RMDir /r "$INSTDIR\backend"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  CreateDirectory "$DOCUMENTS\Cat Canvas\Backups\Installers"
  CopyFiles /SILENT "$EXEPATH" "$DOCUMENTS\Cat Canvas\Backups\Installers\Cat-Canvas-${VERSION}-setup.exe"
!macroend
