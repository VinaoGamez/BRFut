@echo off
setlocal EnableExtensions
title BR Fut - Modo Offline (build estatico)

rem ============================================================================
rem  BR Fut - build estatico + servidor local, sem API.
rem
rem  Gera dist/ com as variaveis de offline embutidas e sobe com o servidor
rem  HTTP do Python na porta 5081. Serve para testar o mesmo pacote que vai
rem  para os testers, sem depender do Vite.
rem ============================================================================

set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
set "PORT=5081"
set "URL=http://127.0.0.1:%PORT%/home.html"

cd /d "%PROJECT_DIR%"

rem --- variaveis de ambiente do modo offline -------------------------------
set "BRFUT_AUTH_REQUIRED=false"
set "BRFUT_API_ORIGIN="
set "BRFUT_LOCAL_API_TARGET=http://127.0.0.1:9/"

echo.
echo  BR FUT - OFFLINE (BUILD ESTATICO)
echo  ================================
echo.

where node.exe >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js nao foi encontrado.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias... ^(so na primeira vez^)
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo ERRO: nao foi possivel instalar as dependencias.
    pause
    exit /b 1
  )
  echo.
)

echo Gerando o build em dist\ ...
call npm.cmd run build
if errorlevel 1 (
  echo.
  echo ERRO: o build falhou.
  pause
  exit /b 1
)

netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo Ja existe algo escutando na porta %PORT%.
  for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    taskkill /PID %%p /F >nul 2>nul
  )
  timeout /t 2 /nobreak >nul
)

echo.
echo Endereco: %URL%
echo Mantenha esta janela aberta durante o uso.
echo.

where py.exe >nul 2>nul
if errorlevel 1 (
  where python.exe >nul 2>nul
  if errorlevel 1 (
    echo ERRO: Python nao foi encontrado. Instale o Python para servir o build.
    pause
    exit /b 1
  )
  start "" "%URL%"
  python -m http.server %PORT% --bind 0.0.0.0 --directory dist
  exit /b
)

start "" "%URL%"
py -m http.server %PORT% --bind 0.0.0.0 --directory dist
