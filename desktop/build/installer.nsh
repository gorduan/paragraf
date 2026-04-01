; desktop/build/installer.nsh
; Adds welcome page to the NSIS assisted installer.
; electron-builder loads this automatically from the build directory.
; License page is handled by the "license" option in electron-builder.yml.

!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend
