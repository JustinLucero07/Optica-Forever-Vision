from fastapi import APIRouter

from app.api.v1 import auth, categorias, consultas, creditos, ordenes, pacientes, productos, reportes, tesoreria, turnos, ventas, whatsapp

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(pacientes.router)
api_router.include_router(consultas.router)
api_router.include_router(categorias.router)
api_router.include_router(productos.router)
api_router.include_router(ventas.router)
api_router.include_router(tesoreria.router)
api_router.include_router(turnos.router)
api_router.include_router(ordenes.router)
api_router.include_router(reportes.router)
api_router.include_router(creditos.router)
api_router.include_router(whatsapp.router)
