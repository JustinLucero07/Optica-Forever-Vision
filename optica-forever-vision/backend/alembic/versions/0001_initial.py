"""initial: users + configuraciones

Revision ID: 0001_initial
Revises:
Create Date: 2026-04-29

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TYPE user_role AS ENUM ('admin', 'optometrista', 'vendedor', 'cajero');

        CREATE TABLE users (
            id          SERIAL PRIMARY KEY,
            email       VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            full_name   VARCHAR(150) NOT NULL,
            role        user_role    NOT NULL,
            is_active   BOOLEAN      NOT NULL DEFAULT true,
            created_at  TIMESTAMP    NOT NULL DEFAULT now(),
            updated_at  TIMESTAMP    NOT NULL DEFAULT now()
        );

        CREATE UNIQUE INDEX ix_users_email ON users (email);

        CREATE TABLE configuraciones (
            id          SERIAL PRIMARY KEY,
            clave       VARCHAR(100) NOT NULL UNIQUE,
            valor       VARCHAR(500) NOT NULL DEFAULT '',
            descripcion VARCHAR(255)
        );

        CREATE UNIQUE INDEX ix_configuraciones_clave ON configuraciones (clave);
    """)


def downgrade() -> None:
    op.execute("""
        DROP INDEX IF EXISTS ix_configuraciones_clave;
        DROP TABLE IF EXISTS configuraciones;
        DROP INDEX IF EXISTS ix_users_email;
        DROP TABLE IF EXISTS users;
        DROP TYPE IF EXISTS user_role;
    """)
