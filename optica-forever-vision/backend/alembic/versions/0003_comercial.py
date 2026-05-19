"""fase2: categorias + productos + inventario + ventas

Revision ID: 0003_comercial
Revises: 0002_pacientes_consultas
Create Date: 2026-05-05

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0003_comercial"
down_revision: Union[str, None] = "0002_pacientes_consultas"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE categorias (
            id          SERIAL PRIMARY KEY,
            nombre      VARCHAR(100) NOT NULL UNIQUE,
            descripcion VARCHAR(255)
        );

        INSERT INTO categorias (nombre, descripcion) VALUES
            ('Monturas / Armaduras',         'Armazones y monturas para lentes'),
            ('Lentes Oftálmicos',            'Lentes de resina, policarbonato, vidrio'),
            ('Lentes de Contacto',           'Blandas, rígidas, desechables'),
            ('Soluciones y Accesorios LC',   'Líquidos, estuches y accesorios para LC'),
            ('Estuches y Accesorios',        'Estuches, correas, paños, limpiadores'),
            ('Servicios Optométricos',       'Examen visual, adaptación de LC, consulta'),
            ('Otros',                        'Artículos varios');

        CREATE TABLE productos (
            id              SERIAL PRIMARY KEY,
            codigo          VARCHAR(50) UNIQUE,
            nombre          VARCHAR(200) NOT NULL,
            descripcion     TEXT,
            categoria_id    INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
            precio_costo    NUMERIC(10,2) NOT NULL DEFAULT 0,
            precio_venta    NUMERIC(10,2) NOT NULL DEFAULT 0,
            stock_actual    NUMERIC(10,2) NOT NULL DEFAULT 0,
            stock_minimo    NUMERIC(10,2) NOT NULL DEFAULT 0,
            unidad          VARCHAR(30)  NOT NULL DEFAULT 'unidad',
            activo          BOOLEAN      NOT NULL DEFAULT true,
            created_at      TIMESTAMP    NOT NULL DEFAULT now(),
            updated_at      TIMESTAMP    NOT NULL DEFAULT now()
        );

        CREATE INDEX ix_productos_categoria ON productos (categoria_id);
        CREATE INDEX ix_productos_nombre    ON productos (nombre);

        CREATE TABLE movimientos_inventario (
            id              SERIAL PRIMARY KEY,
            producto_id     INTEGER NOT NULL REFERENCES productos(id)  ON DELETE RESTRICT,
            tipo            VARCHAR(20)   NOT NULL,
            cantidad        NUMERIC(10,2) NOT NULL,
            stock_antes     NUMERIC(10,2) NOT NULL,
            stock_despues   NUMERIC(10,2) NOT NULL,
            motivo          VARCHAR(255),
            referencia      VARCHAR(50),
            usuario_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            created_at      TIMESTAMP NOT NULL DEFAULT now()
        );

        CREATE INDEX ix_movimientos_producto ON movimientos_inventario (producto_id);

        CREATE TABLE ventas (
            id          SERIAL PRIMARY KEY,
            numero      VARCHAR(20)   NOT NULL UNIQUE,
            paciente_id INTEGER       REFERENCES pacientes(id) ON DELETE SET NULL,
            usuario_id  INTEGER       NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            fecha       DATE          NOT NULL,
            subtotal    NUMERIC(10,2) NOT NULL DEFAULT 0,
            descuento   NUMERIC(10,2) NOT NULL DEFAULT 0,
            total       NUMERIC(10,2) NOT NULL DEFAULT 0,
            estado      VARCHAR(20)   NOT NULL DEFAULT 'pendiente',
            notas       TEXT,
            created_at  TIMESTAMP     NOT NULL DEFAULT now(),
            updated_at  TIMESTAMP     NOT NULL DEFAULT now()
        );

        CREATE INDEX ix_ventas_paciente ON ventas (paciente_id);
        CREATE INDEX ix_ventas_fecha    ON ventas (fecha);

        CREATE TABLE venta_items (
            id              SERIAL PRIMARY KEY,
            venta_id        INTEGER       NOT NULL REFERENCES ventas(id)    ON DELETE CASCADE,
            producto_id     INTEGER       REFERENCES productos(id)          ON DELETE SET NULL,
            descripcion     VARCHAR(255)  NOT NULL,
            cantidad        NUMERIC(10,2) NOT NULL,
            precio_unitario NUMERIC(10,2) NOT NULL,
            descuento_pct   NUMERIC(5,2)  NOT NULL DEFAULT 0,
            subtotal        NUMERIC(10,2) NOT NULL
        );

        CREATE INDEX ix_venta_items_venta ON venta_items (venta_id);
    """)


def downgrade() -> None:
    op.execute("""
        DROP TABLE IF EXISTS venta_items;
        DROP TABLE IF EXISTS ventas;
        DROP TABLE IF EXISTS movimientos_inventario;
        DROP TABLE IF EXISTS productos;
        DROP TABLE IF EXISTS categorias;
    """)
