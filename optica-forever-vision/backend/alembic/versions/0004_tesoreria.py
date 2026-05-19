"""fase3: tesoreria — cuentas bancarias, cobros, egresos, cxp

Revision ID: 0004_tesoreria
Revises: 0003_comercial
Create Date: 2026-05-05

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0004_tesoreria"
down_revision: Union[str, None] = "0003_comercial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE cuentas_bancarias (
            id           SERIAL PRIMARY KEY,
            nombre       VARCHAR(100)  NOT NULL,
            tipo         VARCHAR(30)   NOT NULL,
            saldo_actual NUMERIC(12,2) NOT NULL DEFAULT 0,
            activa       BOOLEAN       NOT NULL DEFAULT true
        );

        INSERT INTO cuentas_bancarias (nombre, tipo) VALUES
            ('Efectivo',       'efectivo'),
            ('Banco Pichincha', 'banco'),
            ('Produbanco',     'banco'),
            ('JEP',            'banco'),
            ('Jardín Azuayo',  'banco'),
            ('DeUna',          'electronico');

        CREATE TABLE cuentas_por_pagar (
            id                SERIAL PRIMARY KEY,
            proveedor         VARCHAR(150)  NOT NULL,
            concepto          VARCHAR(255)  NOT NULL,
            monto_total       NUMERIC(10,2) NOT NULL,
            monto_pagado      NUMERIC(10,2) NOT NULL DEFAULT 0,
            fecha_emision     DATE          NOT NULL,
            fecha_vencimiento DATE,
            estado            VARCHAR(20)   NOT NULL DEFAULT 'pendiente',
            referencia        VARCHAR(100),
            notas             TEXT,
            created_at        TIMESTAMP     NOT NULL DEFAULT now(),
            updated_at        TIMESTAMP     NOT NULL DEFAULT now()
        );

        CREATE TABLE cobros (
            id                  SERIAL PRIMARY KEY,
            numero              VARCHAR(20)   NOT NULL UNIQUE,
            venta_id            INTEGER       REFERENCES ventas(id) ON DELETE SET NULL,
            paciente_id         INTEGER       REFERENCES pacientes(id) ON DELETE SET NULL,
            cuenta_bancaria_id  INTEGER       NOT NULL REFERENCES cuentas_bancarias(id) ON DELETE RESTRICT,
            fecha               DATE          NOT NULL,
            concepto            VARCHAR(255)  NOT NULL,
            monto               NUMERIC(10,2) NOT NULL,
            metodo_pago         VARCHAR(30)   NOT NULL,
            referencia          VARCHAR(100),
            notas               TEXT,
            usuario_id          INTEGER       NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            created_at          TIMESTAMP     NOT NULL DEFAULT now()
        );

        CREATE INDEX ix_cobros_fecha    ON cobros (fecha);
        CREATE INDEX ix_cobros_venta_id ON cobros (venta_id);

        CREATE TABLE egresos (
            id                  SERIAL PRIMARY KEY,
            numero              VARCHAR(20)   NOT NULL UNIQUE,
            cuenta_bancaria_id  INTEGER       NOT NULL REFERENCES cuentas_bancarias(id) ON DELETE RESTRICT,
            cxp_id              INTEGER       REFERENCES cuentas_por_pagar(id) ON DELETE SET NULL,
            fecha               DATE          NOT NULL,
            categoria           VARCHAR(100)  NOT NULL,
            concepto            VARCHAR(255)  NOT NULL,
            monto               NUMERIC(10,2) NOT NULL,
            metodo_pago         VARCHAR(30)   NOT NULL,
            referencia          VARCHAR(100),
            notas               TEXT,
            usuario_id          INTEGER       NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            created_at          TIMESTAMP     NOT NULL DEFAULT now()
        );

        CREATE INDEX ix_egresos_fecha ON egresos (fecha);

        INSERT INTO configuraciones (clave, valor, descripcion) VALUES
            ('numerador_cobro',   '0', 'Último número de cobro'),
            ('numerador_egreso',  '0', 'Último número de egreso')
        ON CONFLICT (clave) DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("""
        DELETE FROM configuraciones WHERE clave IN ('numerador_cobro', 'numerador_egreso');
        DROP TABLE IF EXISTS egresos;
        DROP TABLE IF EXISTS cobros;
        DROP TABLE IF EXISTS cuentas_por_pagar;
        DROP TABLE IF EXISTS cuentas_bancarias;
    """)
