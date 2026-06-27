@echo off
:: iniciar-optica.bat — Arranca el sistema Óptica Forever Vision
:: Coloca este archivo en: C:\Optica\optica-forever-vision\deploy\

echo ================================================
echo   OPTICA FOREVER VISION — Iniciando sistema...
echo ================================================

:: Esperar a que Docker Desktop termine de arrancar (por si se ejecuta en startup)
timeout /t 20 /nobreak > nul

:: Ir a la carpeta deploy
cd /d "%~dp0"

:: Levantar los servicios
docker compose -f docker-compose.prod.yml --env-file .env up -d

if %ERRORLEVEL% EQU 0 (
    echo.
    echo  [OK] Sistema iniciado correctamente
    echo       Accede en:  http://localhost
    echo.
) else (
    echo.
    echo  [ERROR] No se pudo iniciar. Revisa Docker Desktop.
    echo.
    pause
)
