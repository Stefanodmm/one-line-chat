#!/bin/bash

echo "=================================================="
echo "Iniciando servidores para desarrollo local"
echo "=================================================="
echo ""

echo "[1/2] Iniciando servidor Python..."
cd server && python server.py &
PYTHON_PID=$!
cd ..

sleep 3

echo "[2/2] Iniciando Next.js..."
npm run dev &
NEXT_PID=$!

echo ""
echo "=================================================="
echo "Servidores iniciados!"
echo ""
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:5000"
echo ""
echo "Presiona Ctrl+C para detener ambos servidores"
echo "=================================================="

# Esperar a que el usuario presione Ctrl+C
trap "kill $PYTHON_PID $NEXT_PID; exit" INT
wait

