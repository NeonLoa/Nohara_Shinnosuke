@echo off
set "APP=%~dp0"
set "APP=%APP:~0,-1%"
start "" "%APP%\node_modules\electron\dist\electron.exe" "%APP%"
