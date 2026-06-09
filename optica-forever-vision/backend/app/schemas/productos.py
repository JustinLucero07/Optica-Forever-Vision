from datetime import datetime

from pydantic import BaseModel


class CategoriaOut(BaseModel):
    id: int
    nombre: str
    descripcion: str | None
    model_config = {"from_attributes": True}


class CategoriaCreate(BaseModel):
    nombre: str
    descripcion: str | None = None


class ProveedorSimple(BaseModel):
    id: int
    nombre: str
    model_config = {"from_attributes": True}


class ProductoCreate(BaseModel):
    codigo: str | None = None
    nombre: str
    descripcion: str | None = None
    categoria_id: int | None = None
    proveedor_id: int | None = None
    precio_costo: float = 0
    precio_venta: float = 0
    stock_actual: float = 0
    stock_minimo: float = 0
    unidad: str = "unidad"


class ProductoUpdate(BaseModel):
    codigo: str | None = None
    nombre: str | None = None
    descripcion: str | None = None
    categoria_id: int | None = None
    proveedor_id: int | None = None
    precio_costo: float | None = None
    precio_venta: float | None = None
    stock_minimo: float | None = None
    unidad: str | None = None
    activo: bool | None = None


class ProductoOut(BaseModel):
    id: int
    codigo: str | None
    nombre: str
    descripcion: str | None
    categoria_id: int | None
    categoria: CategoriaOut | None
    proveedor_id: int | None = None
    proveedor: ProveedorSimple | None = None
    precio_costo: float
    precio_venta: float
    stock_actual: float
    stock_minimo: float
    unidad: str
    activo: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class ProductoListItem(BaseModel):
    id: int
    codigo: str | None
    nombre: str
    categoria: CategoriaOut | None
    proveedor_id: int | None = None
    proveedor: ProveedorSimple | None = None
    precio_costo: float = 0
    precio_venta: float = 0
    stock_actual: float = 0
    stock_minimo: float = 0
    unidad: str
    activo: bool
    model_config = {"from_attributes": True}


class EntradaStock(BaseModel):
    cantidad: float
    motivo: str | None = None


class AjusteStock(BaseModel):
    cantidad_nueva: float
    motivo: str
