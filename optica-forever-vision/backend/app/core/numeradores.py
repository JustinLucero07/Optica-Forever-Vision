from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.configuracion import Configuracion


def siguiente_numero(db: Session, clave: str, prefijo: str, largo: int = 4) -> str:
    conf = db.execute(
        select(Configuracion).where(Configuracion.clave == clave).with_for_update()
    ).scalar_one()
    nuevo = int(conf.valor) + 1
    conf.valor = str(nuevo)
    db.flush()
    return f"{prefijo}-{str(nuevo).zfill(largo)}"
