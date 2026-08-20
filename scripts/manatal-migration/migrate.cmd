@echo off
rem Double-click this, or run it from a terminal, to migrate Manatal into Sync.
rem
rem It does nothing clever: it checks first, asks before writing anything, and stops on the first
rem thing that is not right. Everything it does can be done by hand with `uv run migrate.py`;
rem this exists so nobody has to know that.

setlocal
cd /d "%~dp0"

where uv >nul 2>nul
if errorlevel 1 (
  echo.
  echo   uv is not installed, and this needs it to run.
  echo   Install it from https://docs.astral.sh/uv/ and run this again.
  echo.
  pause
  exit /b 1
)

echo.
echo   Manatal to Sync migration
echo   =========================
echo.
echo   Step 1 of 3: checking that everything is ready. Nothing is changed by this.
echo.

uv run migrate.py --check
if errorlevel 1 (
  echo.
  echo   Something above is not ready yet. Nothing has been changed.
  echo   Fix the items marked STOP and run this again.
  echo.
  pause
  exit /b 1
)

echo.
echo   Step 2 of 3: moving people across.
echo.
echo   This can take a while, and it says how far along it is as it goes. It is safe to stop
echo   it and start it again: it remembers what it has done and picks up where it left off.
echo.
set /p GO="   Type yes to start, or press Enter to stop: "
if /i not "%GO%"=="yes" (
  echo.
  echo   Stopped. Nothing has been changed.
  echo.
  pause
  exit /b 0
)

uv run migrate.py
set MOVED=%errorlevel%

echo.
echo   Step 3 of 3: what happened.
echo.
uv run migrate.py --report

if %MOVED% neq 0 (
  echo.
  echo   Some people did not move across. Running this again retries only those.
  echo.
)

echo.
echo   The CVs that were moved still have to be read by the platform before those profiles
echo   are filled in. Once that has happened, run this again to finish them.
echo.
pause
exit /b %MOVED%
