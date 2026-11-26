@echo off
setlocal EnableExtensions
title BR Fut - Modo Offline (sem API)

rem ============================================================================
rem  BR Fut - execucao local sem API/VPS.
rem
rem  A API (api.brfut.com.br) esta fora do ar. Sem desligar a exigencia de
rem  autenticacao, o jogo trava no boot esperando o servidor. Aquiligamos
rem  BRFUT_AUTH_REQUIRED=false e apontamos o proxy /api para uma porta fechada,
rem  que falha na hora em vez de esperar timeout.
rem
rem  O projeto e sempre a pasta deste arquivo - nao caminho fixo.
rem ============================================================================

set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
set "PORT=5080"
set "URL=http://127.0.0.1:%PORT%/home.html"
set "LOCAL_IP="

cd /d "%PROJECT_DIR%"

rem --- variaveis de ambiente do modo offline -------------------------------
set "BRFUT_AUTH_REQUIRED=false"
set "BRFUT_API_ORIGIN="
set "BRFUT_LOCAL_API_TARGET=http://127.0.0.1:9/"

echo.
echo  BR FUT - MODO OFFLINE
echo  =====================
echo.
echo  API desligada. O jogo abre direto na tela inicial.
echo.

where node.exe >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js nao foi encontrado.
  echo Instale o Node.js 18 ou superior e execute este arquivo novamente.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
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

netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo Ja existe algo escutando na porta %PORT%.
  echo Fechando o servidor anterior...
  for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    taskkill /PID %%p /F >nul 2>nul
  )
  timeout /t 2 /nobreak >nul
)

for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "$ip = Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254*' -and $_.PrefixOrigin -ne 'WellKnown' } ^| Select-Object -First 1 -ExpandProperty IPAddress; if ($ip) { $ip }"`) do set "LOCAL_IP=%%i"

echo Endereco: %URL%
if defined LOCAL_IP echo Celular na mesma rede: http://%LOCAL_IP%:%PORT%/home.html
echo.
echo Mantenha esta janela aberta durante o uso.
echo Para encerrar, pressione Ctrl+C ou feche a janela.
echo.

start "" "%URL%"
call npm.cmd run dev -- --host 0.0.0.0 --port %PORT%

if errorlevel 1 (
  echo.
  echo O servidor foi encerrado com erro.
  pause
)
