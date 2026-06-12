#!/bin/bash
# Limpieza definitiva de Docker cuando los contenedores se bloquean

echo "=== Matando shims de containerd ==="
pkill -9 -f "containerd-shim" 2>/dev/null && echo "OK" || echo "No habia shims"
sleep 2

echo ""
echo "=== Deteniendo snap docker ==="
snap stop docker 2>/dev/null; sleep 2

echo ""
echo "=== Limpiando estado huerfano de containerd ==="
rm -rf /run/snap.docker/containerd/daemon/io.containerd.runtime.v2.task/moby/ 2>/dev/null
rm -rf /run/containerd/io.containerd.runtime.v2.task/moby/ 2>/dev/null
echo "OK"

echo ""
echo "=== Reiniciando snap docker ==="
snap start docker 2>/dev/null; sleep 3

echo ""
echo "=== Removiendo todos los contenedores ==="
docker rm -f $(docker ps -aq) 2>/dev/null || true
echo "OK"

echo ""
echo "=== Liberando puertos ==="
fuser -k 6379/tcp 8001/tcp 5173/tcp 5434/tcp 2>/dev/null || true
echo "OK"

echo ""
echo "=== Agregando usuario al grupo docker ==="
usermod -aG docker justin

echo ""
echo "======================================================"
echo " LISTO. Corre en tu terminal (SIN sudo):"
echo "   docker compose up --build"
echo "======================================================"
