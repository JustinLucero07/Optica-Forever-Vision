"""fase1: pacientes + consultas + recetas

Revision ID: 0002_pacientes_consultas
Revises: 0001_initial
Create Date: 2026-05-05

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002_pacientes_consultas"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE pacientes (
            id               SERIAL PRIMARY KEY,
            numero           VARCHAR(20)  NOT NULL UNIQUE,
            cedula           VARCHAR(20),
            nombres          VARCHAR(150) NOT NULL,
            apellidos        VARCHAR(150) NOT NULL,
            fecha_nacimiento DATE,
            genero           VARCHAR(20),
            telefono         VARCHAR(20),
            telefono_2       VARCHAR(20),
            email            VARCHAR(255),
            direccion        TEXT,
            ocupacion        VARCHAR(100),
            created_at       TIMESTAMP NOT NULL DEFAULT now(),
            updated_at       TIMESTAMP NOT NULL DEFAULT now()
        );

        CREATE INDEX ix_pacientes_cedula    ON pacientes (cedula);
        CREATE INDEX ix_pacientes_nombres   ON pacientes (nombres);
        CREATE INDEX ix_pacientes_apellidos ON pacientes (apellidos);
        CREATE INDEX ix_pacientes_telefono  ON pacientes (telefono);

        CREATE TABLE consultas (
            id                SERIAL PRIMARY KEY,
            numero            VARCHAR(20)  NOT NULL UNIQUE,
            paciente_id       INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
            optometrista_id   INTEGER NOT NULL REFERENCES users(id)     ON DELETE RESTRICT,
            fecha             DATE    NOT NULL,

            motivo_consulta   TEXT,
            antecedentes      TEXT,

            avsc_od           VARCHAR(20),
            avsc_oi           VARCHAR(20),
            avsc_ao           VARCHAR(20),
            avcc_od           VARCHAR(20),
            avcc_oi           VARCHAR(20),
            avcc_ao           VARCHAR(20),

            rx_od_esf         NUMERIC(5,2),
            rx_od_cil         NUMERIC(5,2),
            rx_od_eje         INTEGER,
            rx_od_add         NUMERIC(5,2),
            rx_od_av          VARCHAR(20),
            rx_oi_esf         NUMERIC(5,2),
            rx_oi_cil         NUMERIC(5,2),
            rx_oi_eje         INTEGER,
            rx_oi_add         NUMERIC(5,2),
            rx_oi_av          VARCHAR(20),

            pio_od            NUMERIC(4,1),
            pio_oi            NUMERIC(4,1),
            cover_test_vl     VARCHAR(100),
            cover_test_vp     VARCHAR(100),
            motilidad         VARCHAR(100),
            estereopsis       VARCHAR(100),

            seg_anterior_od   TEXT,
            seg_anterior_oi   TEXT,
            fondo_od          TEXT,
            fondo_oi          TEXT,

            diagnostico       TEXT,
            plan_tratamiento  TEXT,
            observaciones     TEXT,
            proximo_control   DATE,

            created_at        TIMESTAMP NOT NULL DEFAULT now(),
            updated_at        TIMESTAMP NOT NULL DEFAULT now()
        );

        CREATE INDEX ix_consultas_paciente_id ON consultas (paciente_id);

        CREATE TABLE recetas (
            id              SERIAL PRIMARY KEY,
            consulta_id     INTEGER NOT NULL REFERENCES consultas(id) ON DELETE CASCADE,
            tipo            VARCHAR(30) NOT NULL,

            lc_od_esf       NUMERIC(5,2),
            lc_od_cil       NUMERIC(5,2),
            lc_od_eje       INTEGER,
            lc_od_add       NUMERIC(5,2),
            lc_od_dnp       NUMERIC(4,1),
            lc_od_alt       NUMERIC(4,1),
            lc_oi_esf       NUMERIC(5,2),
            lc_oi_cil       NUMERIC(5,2),
            lc_oi_eje       INTEGER,
            lc_oi_add       NUMERIC(5,2),
            lc_oi_dnp       NUMERIC(4,1),
            lc_oi_alt       NUMERIC(4,1),
            tipo_lente      VARCHAR(100),
            tipo_armadura   VARCHAR(100),

            cl_od_marca     VARCHAR(100),
            cl_od_bc        NUMERIC(4,2),
            cl_od_diam      NUMERIC(4,2),
            cl_od_esf       NUMERIC(5,2),
            cl_od_cil       NUMERIC(5,2),
            cl_od_eje       INTEGER,
            cl_oi_marca     VARCHAR(100),
            cl_oi_bc        NUMERIC(4,2),
            cl_oi_diam      NUMERIC(4,2),
            cl_oi_esf       NUMERIC(5,2),
            cl_oi_cil       NUMERIC(5,2),
            cl_oi_eje       INTEGER,

            observaciones   TEXT,
            created_at      TIMESTAMP NOT NULL DEFAULT now()
        );

        CREATE INDEX ix_recetas_consulta_id ON recetas (consulta_id);
    """)


def downgrade() -> None:
    op.execute("""
        DROP TABLE IF EXISTS recetas;
        DROP TABLE IF EXISTS consultas;
        DROP INDEX IF EXISTS ix_pacientes_telefono;
        DROP INDEX IF EXISTS ix_pacientes_apellidos;
        DROP INDEX IF EXISTS ix_pacientes_nombres;
        DROP INDEX IF EXISTS ix_pacientes_cedula;
        DROP TABLE IF EXISTS pacientes;
    """)
