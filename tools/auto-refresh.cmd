@echo off
rem Scheduler entry point for the unattended refresh. Resolves the repo from its own location,
rem so it keeps working if the folder moves. Console output goes to %TEMP%\prsa-auto-refresh.log;
rem the structured run history lives in data\refresh-log.json.
setlocal
cd /d "%~dp0.."
echo. >> "%TEMP%\prsa-auto-refresh.log"
echo ===== %DATE% %TIME% ===== >> "%TEMP%\prsa-auto-refresh.log"
node "tools\auto-refresh.mjs" --quiet %* >> "%TEMP%\prsa-auto-refresh.log" 2>&1
if errorlevel 1 (
  echo AUTO-REFRESH FAILED - see the log above >> "%TEMP%\prsa-auto-refresh.log"
  endlocal
  rem Non-zero so Task Scheduler records the run as failed instead of a silent success.
  exit /b 1
)
endlocal
exit /b 0
