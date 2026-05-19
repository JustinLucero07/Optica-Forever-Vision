"""Seed inicial: usuarios y configuraciones base.

Idempotente: se puede correr varias veces.

Uso (dentro del contenedor):
    python -m app.scripts.seed
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models.configuracion import Configuracion
from app.models.user import User, UserRole

USUARIOS = [
    ("admin@optica.local",        "Administrador", UserRole.ADMIN,        "Admin2026!"),
    ("optometrista@optica.local", "Optometrista",  UserRole.OPTOMETRISTA, "Optom2026!"),
    ("vendedor@optica.local",     "Vendedor",      UserRole.VENDEDOR,     "Vende2026!"),
    ("cajero@optica.local",       "Cajero",        UserRole.CAJERO,       "Caja2026!"),
]

# Continuamos la numeración desde el último valor de los Excel actuales.
# El sistema entrega el siguiente: P139, C119, Venta95, Orden 124.
CONFIGURACIONES = [
    ("nombre_optica",       "Óptica Forever Vision",     "Nombre comercial"),
    ("direccion_optica",    "Av. 24 de mayo y Puyo",     "Dirección del local"),
    ("telefono_optica",     "593998674908",              "Teléfono principal"),
    ("telefono_optica_2",   "979100495",                 "Teléfono secundario"),
    ("pais_codigo",         "593",                       "Código país (Ecuador)"),
    ("numerador_paciente",  "138",                       "Último código P# emitido"),
    ("numerador_consulta",  "118",                       "Último código C# emitido"),
    ("numerador_venta",     "94",                        "Último número de venta"),
    ("numerador_orden",     "123",                       "Último número de orden"),
    ("numerador_factura",   "0",                         "Último número de factura interna"),
]


def seed_usuarios(db: Session) -> None:
    print("Usuarios:")
    for email, nombre, rol, password in USUARIOS:
        existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if existing:
            print(f"  = {email:<32} (ya existe)")
            continue
        user = User(
            email=email,
            full_name=nombre,
            role=rol,
            password_hash=hash_password(password),
        )
        db.add(user)
        print(f"  + {email:<32} rol={rol.value:<14} password={password}")


def seed_configuraciones(db: Session) -> None:
    print("Configuraciones:")
    for clave, valor, descripcion in CONFIGURACIONES:
        existing = db.execute(
            select(Configuracion).where(Configuracion.clave == clave)
        ).scalar_one_or_none()
        if existing:
            print(f"  = {clave:<25} (ya existe)")
            continue
        db.add(Configuracion(clave=clave, valor=valor, descripcion=descripcion))
        print(f"  + {clave:<25} = {valor}")


def run() -> None:
    db = SessionLocal()
    try:
        seed_usuarios(db)
        seed_configuraciones(db)
        db.commit()
        print("\n[OK] Seed completado.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
