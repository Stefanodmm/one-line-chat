@echo off
echo ==================================================
echo Iniciando servidores para desarrollo local
echo ==================================================
echo.

echo [1/2] Iniciando servidor Python...
start "Servidor Python" cmd /k "cd server && python server.py"

timeout /t 3 /nobreak >nul

echo [2/2] Iniciando Next.js...
start "Next.js Dev" cmd /k "npm run dev"

echo.
echo ==================================================
echo Servidores iniciados!
echo.
echo Frontend: http://localhost:3000
echo Backend: http://localhost:5000
echo.
echo Presiona cualquier tecla para cerrar esta ventana...
pause >nul

