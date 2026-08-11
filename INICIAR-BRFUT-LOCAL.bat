@echo off
setlocal EnableExtensions
title BR Fut - Servidor Local

set "PROJECT_DIR=%USERPROFILE%\Documents\Matchday-Alpha"
set "PORT=5080"
set "URL=http://127.0.0.1:%PORT%/home.html"
set "LOCAL_IP="

for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "$ip = Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254*' -and $_.PrefixOrigin -ne 'WellKnown' } ^| Select-Object -First 1 -ExpandProperty IPAddress; if ($ip) { $ip }"`) do set "LOCAL_IP=%%i"

echo.
echo  BR FUT - SERVIDOR LOCAL
echo  =======================
echo.

if not exist "%PROJECT_DIR%\package.json" (
  echo ERRO: projeto nao encontrado em:
  echo %PROJECT_DIR%
  echo.
  pause
  exit /b 1
)

cd /d "%PROJECT_DIR%"

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js e npm nao foram encontrados.
  echo Instale o Node.js e execute este arquivo novamente.
  echo.
  pause
  exit /b 1
)

if not exist "%PROJECT_DIR%\node_modules\vite\bin\vite.js" (
  echo Instalando dependencias do projeto...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo ERRO: nao foi possivel instalar as dependencias.
    pause
    exit /b 1
  )
)

netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo O servidor ja esta ativo na porta %PORT%.
  start "" "%URL%"
  exit /b 0
)

echo Endereco: %URL%
if defined LOCAL_IP echo Celular na mesma rede: http://%LOCAL_IP%:%PORT%/home.html
echo Mantenha esta janela aberta durante os testes.
echo Para encerrar, pressione Ctrl+C ou feche a janela.
echo.

start "" "%URL%"
call npm.cmd run dev -- --host 0.0.0.0 --port %PORT%

if errorlevel 1 (
  echo.
  echo O servidor foi encerrado com erro.
  pause
)
