@echo off
setlocal EnableExtensions
title BR Fut - Gerar instalador desktop

rem ============================================================================
rem  BR Fut - empacotamento Windows.
rem
rem  Gera um instalador .exe em release\. O app roda sem API, sem VPS e sem
rem  Python: o build ja sai com as variaveis de modo offline embutidas.
rem
rem  Uso:
rem    GERAR-INSTALADOR.bat          -> instalador .exe
rem    GERAR-INSTALADOR.bat --dir    -> so a pasta, para testar sem instalar
rem
rem  Primeira vez demora alguns minutos (baixa o Electron). Depois, poucos.
rem ============================================================================

set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
cd /d "%PROJECT_DIR%"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo   Node.js nao encontrado no PATH.
  echo   Instale em https://nodejs.org e rode de novo.
  echo.
  pause
  exit /b 1
)

echo.
echo   Node:  %~dp0node -v
node -v
echo.

if not exist "node_modules\electron\dist\electron.exe" (
  echo   Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo   Falha na instalacao das dependencias.
    pause
    exit /b 1
  )
)

node scripts\build-desktop.mjs %*
if errorlevel 1 (
  echo.
  echo   Falha ao empacotar.
  pause
  exit /b 1
)

echo.
echo   Pronto. O instalador esta em:
echo   %PROJECT_DIR%\release
echo.
if not "%~1"=="--dir" start "" "%PROJECT_DIR%\release"
pause