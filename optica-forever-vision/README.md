# Óptica Forever Vision — Sistema de gestión

Sistema completo de gestión para la óptica: pacientes, consultas, recetas, ventas, inventario, tesorería, turnos, reportes.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | FastAPI · SQLAlchemy 2 · Alembic · Postgres 16 · JWT |
| Frontend | React 18 · Vite · TypeScript · Tailwind · shadcn/ui · React Query · Zustand |
| Infra | Docker Compose · Redis · (Nginx en prod) |

## Estructura

```
optica-forever-vision/
├── backend/         FastAPI + SQLAlchemy + Alembic
├── frontend/        React + Vite + TS
├── nginx/           (configuración para producción)
└── docker-compose.yml
```

## Arranque (desarrollo)

Requisito: Docker + Docker Compose.

```bash
# 1) Levantar todo
docker compose up --build

# 2) En otra terminal: migraciones + seed inicial
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.scripts.seed
```

Se queda corriendo:
- Backend (FastAPI): http://localhost:8000 — docs en `/docs`
- Frontend (Vite): http://localhost:5173
- Postgres: `localhost:5432` (user/pass: `optica` / `optica`, db: `optica`)
- Redis: `localhost:6379`

## Usuarios iniciales

| Email | Rol | Contraseña |
|---|---|---|
| admin@optica.local | admin | `Admin2026!` |
| optometrista@optica.local | optometrista | `Optom2026!` |
| vendedor@optica.local | vendedor | `Vende2026!` |
| cajero@optica.local | cajero | `Caja2026!` |

> **Cambiá las contraseñas al primer login.**

## Comandos útiles

```bash
# Migraciones
docker compose exec backend alembic upgrade head           # aplicar
docker compose exec backend alembic revision --autogenerate -m "msg"   # generar nueva
docker compose exec backend alembic downgrade -1           # bajar una

# Re-seed (idempotente)
docker compose exec backend python -m app.scripts.seed

# Shell de la BD
docker compose exec db psql -U optica -d optica

# Logs en vivo
docker compose logs -f backend
docker compose logs -f frontend

# Detener todo
docker compose down

# Resetear BD (CUIDADO: borra datos)
docker compose down -v
```

## Plan de desarrollo

Ver [`../ANALISIS_Y_PLAN.md`](../ANALISIS_Y_PLAN.md) para el análisis de los Excel actuales y el roadmap por fase. Estado actual: **Fase 0 completa** (auth, layout, login). Próximo: Fase 1 (Pacientes + Consultas + Recetas).

## Roles y permisos

| Permiso | Admin | Optometrista | Vendedor | Cajero |
|---|:-:|:-:|:-:|:-:|
| Pacientes | CRUD | CRUD | leer/crear | leer |
| Consultas/Recetas | ✅ | ✅ | ❌ | ❌ |
| Productos/Inventario | ✅ | ❌ | leer | ❌ |
| Ventas | ✅ | ❌ | ✅ | leer |
| Cobros/CxC | ✅ | ❌ | ❌ | ✅ |
| Egresos/CxP | ✅ | ❌ | ❌ | leer |
| Reportes | ✅ | propios | propios | ❌ |
| Configuración/Usuarios | ✅ | ❌ | ❌ | ❌ |
