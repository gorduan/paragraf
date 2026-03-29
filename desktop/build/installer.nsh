; desktop/build/installer.nsh
; Adds welcome page and license page to the NSIS assisted installer.
; electron-builder loads this automatically from the build directory.

!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro licensePage
  !insertmacro MUI_PAGE_LICENSE "${BUILD_RESOURCES_DIR}\license.rtf"
!macroend
