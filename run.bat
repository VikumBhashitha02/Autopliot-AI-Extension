@echo off
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=
echo Starting AutoPilot AI Desktop Application...
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
