"""fase4: turnos + ordenes de trabajo

Revision ID: 0005_agenda
Revises: 0004_tesoreria
Create Date: 2026-05-05

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0005_agenda"
down_revision: Union[str, None] = "0004_tesoreria"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE turnos (
            id                SERIAL PRIMARY KEY,
            paciente_id       INTEGER      REFERENCES pacientes(id) ON DELETE SET NULL,
            optometrista_id   INTEGER      REFERENCES users(id)     ON DELETE SET NULL,
            creado_por_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            fecha             DATE         NOT NULL,
            hora_inicio       TIME         NOT NULL,
            hora_fin          TIME,
            motivo            VARCHAR(255) NOT NULL,
            estado            VARCHAR(30)  NOT NULL DEFAULT 'pendiente',
            notas             TEXT,
            created_at        TIMESTAMP    NOT NULL DEFAULT now(),
            updated_at        TIMESTAMP    NOT NULL DEFAULT now()
        );

        CREATE INDEX ix_turnos_fecha ON turnos (fecha);

        CREATE TABLE ordenes_trabajo (
            id                  SERIAL PRIMARY KEY,
            numero              VARCHAR(20)   NOT NULL UNIQUE,
            paciente_id         INTEGER       NOT NULL REFERENCES pacientes(id)  ON DELETE RESTRICT,
            consulta_id         INTEGER       REFERENCES consultas(id)           ON DELETE SET NULL,
            venta_id            INTEGER       REFERENCES ventas(id)              ON DELETE SET NULL,
            lab_proveedor       VARCHAR(150)  NOT NULL,
            fecha_envio         DATE          NOT NULL,
            fecha_entrega_est   DATE,
            fecha_entrega_real  DATE,
            estado              VARCHAR(30)   NOT NULL DEFAULT 'pendiente',
            tipo                VARCHAR(30)   NOT NULL,
            descripcion         TEXT          NOT NULL,
            precio_lab          NUMERIC(10,2),
            notas               TEXT,
            created_at          TIMESTAMP     NOT NULL DEFAULT now(),
            updated_at          TIMESTAMP     NOT NULL DEFAULT now()
        );

        CREATE INDEX ix_ordenes_paciente ON ordenes_trabajo (paciente_id);
        CREATE INDEX ix_ordenes_estado   ON ordenes_trabajo (estado);

        INSERT INTO configuraciones (clave, valor, descripcion) VALUES
            ('numerador_orden', '123', 'Último número de orden de trabajo')
        ON CONFLICT (clave) DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("""
        DROP TABLE IF EXISTS ordenes_trabajo;
        DROP TABLE IF EXISTS turnos;
    """)
