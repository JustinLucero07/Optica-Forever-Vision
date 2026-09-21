"""Reglas de coherencia entre método de pago y tipo de cuenta.

- Cuenta de efectivo (caja)      → solo efectivo.
- Cuenta bancaria / electrónica  → transferencia, depósito o cheque (nunca efectivo).
  En cobros tampoco tarjeta: la tarjeta entra directo a la máquina (datáfono).
- Cuenta "máquina/datáfono"      → en cobros solo tarjeta.
"""
import re

from fastapi import HTTPException

_MAQUINA = re.compile(r"maquina|máquina|dataf|datáf|\bpos\b", re.IGNORECASE)


def es_tarjeta(metodo: str) -> bool:
    return (metodo or "").lower().startswith("tarjeta")


def es_cuenta_maquina(cuenta) -> bool:
    return (cuenta.tipo or "").lower() == "otro" and bool(_MAQUINA.search(cuenta.nombre or ""))


def validar_metodo_cuenta(cuenta, metodo: str, es_ingreso: bool) -> None:
    tipo = (cuenta.tipo or "").lower()
    m = (metodo or "").lower()

    if tipo == "efectivo":
        if m != "efectivo":
            raise HTTPException(
                status_code=422,
                detail=f"«{cuenta.nombre}» es una cuenta de efectivo: solo admite el método efectivo",
            )
        return

    if tipo in ("banco", "electronico"):
        if m == "efectivo":
            raise HTTPException(
                status_code=422,
                detail=f"«{cuenta.nombre}» es una cuenta bancaria: no admite efectivo (el efectivo va a la caja). Usa transferencia, depósito o cheque",
            )
        if es_ingreso and es_tarjeta(m):
            raise HTTPException(
                status_code=422,
                detail=f"Los cobros con tarjeta entran a la máquina, no a «{cuenta.nombre}». Elige la cuenta de la máquina/datáfono",
            )
        return

    if es_ingreso and es_cuenta_maquina(cuenta) and not es_tarjeta(m):
        raise HTTPException(
            status_code=422,
            detail=f"«{cuenta.nombre}» solo recibe cobros con tarjeta",
        )
